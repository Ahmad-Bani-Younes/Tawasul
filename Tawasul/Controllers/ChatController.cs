using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using Tawasul.Data;
using Tawasul.Hubs;
using Tawasul.Models;
using Tawasul.Models.ViewModels;

namespace Tawasul.Controllers
{
    [Authorize]
    public class ChatController : Controller
    {
        private readonly TawasulDbContext _db;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly IHubContext<ChatHub> _hubContext;

        public ChatController(
            TawasulDbContext db,
            UserManager<ApplicationUser> userManager,
            IHubContext<ChatHub> hubContext)
        {
            _db = db;
            _userManager = userManager;
            _hubContext = hubContext;
        }

        public async Task<IActionResult> Index()
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (userId == null)
                return RedirectToAction("Login", "Account");

            // هذا الاستعلام بالكامل سيتحول إلى SQL واحد سريع
            var conversations = await _db.ConversationMembers
                .Where(cm => cm.UserId == userId)
                .Select(cm => new ConversationListViewModel
                {
                    ConversationId = cm.ConversationId,
                    Type = cm.Conversation.Type == ConversationType.Group ? "Group" : "Chat",


                    // 🟦 يجلب العنوان الصحيح
                    DisplayTitle = (cm.Conversation.Type == ConversationType.Group)
                        ? cm.Conversation.Title ?? "(مجموعة)"
                        : cm.Conversation.Members
                              .Where(m => m.UserId != userId)
                              .Select(m => m.User.DisplayName ?? m.User.Email)
                              .FirstOrDefault() ?? "(مستخدم غير معروف)",

                    // 🟦 يجلب الصورة الصحيحة
                    PhotoUrl = (cm.Conversation.Type == ConversationType.Group)
                        ? null
                        : cm.Conversation.Members
                              .Where(m => m.UserId != userId)
                              .Select(m => m.User.PhotoUrl)
                              .FirstOrDefault(),

                    // 🟢 حالة الاتصال (IsOnline)
                    IsOnline = (cm.Conversation.Type == ConversationType.Group)
                        ? false
                        : cm.Conversation.Members
                              .Where(m => m.UserId != userId)
                              .Select(m => m.User.IsOnline)
                              .FirstOrDefault(),

                    // ⏰ آخر ظهور
                    LastSeenAt = (cm.Conversation.Type == ConversationType.Group)
                        ? null
                        : cm.Conversation.Members
                              .Where(m => m.UserId != userId)
                              .Select(m => m.User.LastSeenAt.HasValue
                                  ? (DateTime?)m.User.LastSeenAt.Value.UtcDateTime
                                  : (DateTime?)null)
                              .FirstOrDefault(),

                    // 📨 آخر رسالة
                    LastMessage = cm.Conversation.Messages
                        .OrderByDescending(m => m.CreatedAtUtc)
                        .Select(m => m.Text)
                        .FirstOrDefault(),

                    // 🕒 وقت آخر رسالة
                    LastMessageTime = cm.Conversation.Messages
                        .OrderByDescending(m => m.CreatedAtUtc)
                        .Select(m => m.CreatedAtUtc)
                        .FirstOrDefault(),

                    // 🔵 عدد الرسائل غير المقروءة
                    UnreadCount = _db.UserMessageStatuses
                        .Count(ums =>
                            ums.ConversationId == cm.ConversationId &&
                            ums.UserId == userId &&
                            ums.HasSeen == false)
                })
                .OrderByDescending(c => c.LastMessageTime)
                .ToListAsync();

            ViewBag.OpenConversationId = Request.Query["open"].ToString();

            return View(conversations);
        }


        // ✅ تحميل رسائل محادثة معينة
        [HttpGet("Chat/LoadMessages/{id}")]
        public async Task<IActionResult> LoadMessages(long id)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (userId == null) return Unauthorized();

            // ✅ تحديث حالة القراءة
            await _db.UserMessageStatuses
                .Where(ums => ums.ConversationId == id &&
                              ums.UserId == userId &&
                              ums.HasSeen == false)
                .ExecuteUpdateAsync(updates =>
                    updates.SetProperty(ums => ums.HasSeen, true)
                           .SetProperty(ums => ums.SeenAtUtc, DateTime.UtcNow));

            // ✅ جلب الرسائل
            var messages = await _db.Messages
                .Include(m => m.Sender)
                .Where(m => m.ConversationId == id)
                .OrderBy(m => m.CreatedAtUtc)
                .Select(m => new
                {
                    m.Id,
                    m.Text,
                    Sender = m.Sender.DisplayName ?? m.Sender.UserName,
                    m.CreatedAtUtc,
                    IsMine = (m.SenderId == userId),
                    PhotoUrl = m.Sender.PhotoUrl // ⬅️ ⬅️ (أضف هذا السطر)
                })
                .ToListAsync();

            return Json(messages);
        }


        // ✅ إرسال رسالة جديدة (مع البث عبر SignalR)
        [HttpPost]
        public async Task<IActionResult> SendMessage(long conversationId, string text)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrWhiteSpace(text) || userId == null)
                return BadRequest();

            // جلب اسم المرسل
            var sender = await _userManager.FindByIdAsync(userId);
            var senderName = sender?.DisplayName ?? sender?.UserName ?? "مستخدم";
            var senderPhoto = sender?.PhotoUrl; // ⬅️ ⬅️ (أضف هذا السطر)

            // إنشاء الرسالة
            var message = new Message
            {
                ConversationId = conversationId,
                SenderId = userId,
                Text = text.Trim(),
                CreatedAtUtc = DateTime.UtcNow
            };

            _db.Messages.Add(message);
            await _db.SaveChangesAsync();

            // 🔽🔽 (هذا هو التعديل) 🔽🔽

            // 1. حضّر الموديل الذي سيُرسل "للآخرين" (عبر SignalR)
            var broadcastModel = new
            {
                message.Id,
                message.Text,
                Sender = senderName,
                message.CreatedAtUtc,
                IsMine = false, // ⬅️ أهم تعديل: الطرف الآخر يراها كـ "other"
                ConversationId = message.ConversationId,
                PhotoUrl = senderPhoto, // ⬅️ ⬅️ (أضف هذا السطر)
                SenderId = message.SenderId // ⬅️ إضافة مهمة للفلترة في الجافاسكربت
            };

            // 2. حضّر الموديل الذي سيُرجع "لك" (عبر JSON)
            var jsonResult = new
            {
                message.Id,
                message.Text,
                Sender = senderName,
                message.CreatedAtUtc,
                IsMine = true, // ⬅️ أنت تراها كـ "me"
                ConversationId = message.ConversationId,
                PhotoUrl = senderPhoto, // ⬅️ ⬅️ (أضف هذا السطر)
                SenderId = message.SenderId
            };

            // 3. بثّ الموديل (الخاص بالآخرين) إلى الغرفة
            await _hubContext.Clients
                .Group(conversationId.ToString())
                .SendAsync("ReceiveMessage", broadcastModel); // ⬅️ إرسال broadcastModel

            // 4. إعادة الرد (الخاص بك) للمرسل
            return Json(jsonResult); // ⬅️ إرجاع jsonResult
        }


        // ... (داخل ChatController)

        // ✅ البحث عن مستخدمين (للاضافة)
        [HttpGet]
        public async Task<IActionResult> SearchUsers(string query)
        {
            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrWhiteSpace(query))
                return Json(new List<object>()); // أعد قائمة فارغة

            // جعل البحث (Case-Insensitive)
            var normalizedQuery = query.ToUpper().Trim();

            var users = await _db.Users
                .Where(u => u.Id != currentUserId && // لا تظهر المستخدم نفسه
                            (u.NormalizedEmail.Contains(normalizedQuery) ||
                             u.PhoneNumber.Contains(query))) // رقم الهاتف لا يحتاج (Normalized)
                .Select(u => new
                {
                    // نرسل فقط ما نحتاجه للواجهة
                    u.Id,
                    u.DisplayName,
                    u.PhotoUrl,
                    u.Email
                })
                .Take(5) // حدد النتائج بـ 5 فقط
                .ToListAsync();

            return Json(users);
        }


        // ✅ إنشاء أو فتح محادثة خاصة
[HttpPost]
public async Task<IActionResult> StartChat(string targetUserId)
{
    var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
    if (string.IsNullOrEmpty(targetUserId) || currentUserId == targetUserId)
        return BadRequest();

    // 1. هل توجد محادثة (Type 0) بينهما من قبل؟
    // (هذا الاستعلام معقد قليلاً لكنه دقيق)
    var existingConversation = await _db.Conversations
        .Where(c => c.Type == 0 && // 0 = محادثة خاصة
                    c.Members.Any(m => m.UserId == currentUserId) &&
                    c.Members.Any(m => m.UserId == targetUserId))
        .FirstOrDefaultAsync();

    if (existingConversation != null)
    {
        // 2. إذا موجودة: أعد الـ ID الخاص بها
        return Json(new { conversationId = existingConversation.Id });
    }

    // 3. إذا غير موجودة: أنشئ واحدة جديدة
    var conversation = new Conversation
    {
        Type = 0, // محادثة خاصة
        CreatedByUserId = currentUserId,
        CreatedAtUtc = DateTime.UtcNow
    };

    // 4. أضف العضوين
    var members = new List<ConversationMember>
    {
        new ConversationMember { UserId = currentUserId, JoinedAtUtc = DateTime.UtcNow },
        new ConversationMember { UserId = targetUserId, JoinedAtUtc = DateTime.UtcNow }
    };

    conversation.Members = members;

    _db.Conversations.Add(conversation);
    await _db.SaveChangesAsync();

    // 5. أعد الـ ID الجديد
    return Json(new { conversationId = conversation.Id });
}
    }
}
