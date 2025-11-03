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

            // ✅ جلب الرسائل + المرفقات
            var messages = await _db.Messages
                .Include(m => m.Sender)
                .Include(m => m.Attachments) // ⬅️ أضفنا هذا السطر
                .Where(m => m.ConversationId == id)
                .OrderBy(m => m.CreatedAtUtc)
                .Select(m => new
                {
                    m.Id,
                    m.Text,
                    m.CreatedAtUtc,
                    IsMine = (m.SenderId == userId),
                    Sender = m.Sender.DisplayName ?? m.Sender.UserName,
                    PhotoUrl = m.Sender.PhotoUrl,

                    // ⬅️ نرجع المرفق إن وجد
                    FileUrl = m.Attachments.FirstOrDefault() != null
                        ? m.Attachments.First().FilePath
                        : null,
                    FileType = m.Attachments.FirstOrDefault() != null
                        ? m.Attachments.First().ContentType
                        : null,
                    FileName = m.Attachments.FirstOrDefault() != null
                        ? m.Attachments.First().OriginalName
                        : null,
                    FileSize = m.Attachments.FirstOrDefault() != null
                        ? m.Attachments.First().SizeBytes
                        : 0
                })
                .ToListAsync();

            return Json(messages);
        }



        [HttpPost]
        public async Task<IActionResult> SendMessage(long conversationId, string? text, IFormFile? file)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (userId == null)
                return Unauthorized();

            if (string.IsNullOrWhiteSpace(text) && file == null)
                return BadRequest("لا يوجد محتوى للإرسال.");

            var sender = await _userManager.FindByIdAsync(userId);
            if (sender == null)
                return Unauthorized();

            // 🟦 إنشاء الرسالة
            var message = new Message
            {
                ConversationId = conversationId,
                SenderId = userId,
                Text = string.IsNullOrWhiteSpace(text) ? null : text.Trim(),
                CreatedAtUtc = DateTime.UtcNow
            };

            _db.Messages.Add(message);
            await _db.SaveChangesAsync();

            // 🟦 لو في ملف مرفق
            MessageAttachment? attachment = null;
            if (file != null && file.Length > 0)
            {
                // ✅ 1. التحقق من الحجم (مثلاً 25 ميجا)
                const long maxFileSize = 25 * 1024 * 1024;
                if (file.Length > maxFileSize)
                    return BadRequest("حجم الملف أكبر من المسموح به (25MB).");

                // ✅ 2. التحقق من الأنواع المسموح بها
                // ✅ 2. التحقق من الأنواع المسموح بها (مرن أكثر)
                // ✅ 2. التحقق من الأنواع المسموح بها (مرن)
                var allowedPrefixes = new[]
                {
            "image/", "video/", "audio/",
            "application/pdf",
            "application/zip",
            "application/msword",
            "application/vnd.openxmlformats-officedocument"
        };

                bool isAllowed = allowedPrefixes.Any(p => file.ContentType.StartsWith(p, StringComparison.OrdinalIgnoreCase));
                if (!isAllowed)
                    return BadRequest($"نوع الملف غير مدعوم: {file.ContentType}");

                // ✅ 3. مسار الحفظ
                var uploadsPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads", "chat");
                Directory.CreateDirectory(uploadsPath);

                // ✅ 4. حفظ الملف باسم فريد
                var uniqueName = $"{Guid.NewGuid()}{Path.GetExtension(file.FileName)}";
                var filePath = Path.Combine(uploadsPath, uniqueName);

                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }

                // ✅ 5. حفظ بيانات المرفق في قاعدة البيانات
                attachment = new MessageAttachment
                {
                    MessageId = message.Id,
                    FilePath = $"/uploads/chat/{uniqueName}",
                    ContentType = file.ContentType,
                    SizeBytes = file.Length,
                    OriginalName = file.FileName
                };

                _db.Add(attachment);
                await _db.SaveChangesAsync();
            }

            // 🟩 تجهيز الرسالة النهائية (لترسل عبر SignalR والـ JSON)
            var msgResponse = new
            {
                message.Id,
                message.Text,
                message.CreatedAtUtc,
                message.ConversationId,
                message.SenderId,
                IsMine = true,
                FileUrl = attachment?.FilePath,
                FileType = attachment?.ContentType,
                FileName = attachment?.OriginalName,
                FileSize = attachment?.SizeBytes
            };

            // 🟨 إرسالها للمستخدمين في نفس الغرفة
            var broadcastModel = new
            {
                message.Id,
                message.Text,
                message.CreatedAtUtc,
                message.ConversationId,
                message.SenderId,
                IsMine = false,
                FileUrl = attachment?.FilePath,
                FileType = attachment?.ContentType,
                FileName = attachment?.OriginalName,
                FileSize = attachment?.SizeBytes
            };

            await _hubContext.Clients.Group(conversationId.ToString())
                .SendAsync("ReceiveMessage", broadcastModel);

            return Json(msgResponse);
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


        // ... (داخل ChatController.cs)

        // ✅ إنشاء أو فتح محادثة خاصة (النسخة الصحيحة)
        [HttpPost]
        public async Task<IActionResult> StartChat(string targetUserId)
        {
            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(targetUserId) || currentUserId == targetUserId)
                return BadRequest();

            // 1. هل توجد محادثة (Type 0) بينهما من قبل؟
            // 🔽🔽 (هذا هو التعديل) 🔽🔽
            var existingConversation = await _db.Conversations
                .Include(c => c.Members) // ⬅️ (1) أضفنا Include
                .Where(c => c.Type == ConversationType.Direct && // ⬅️ (2) قارنا بـ Enum
                            c.Members.Any(m => m.UserId == currentUserId) &&
                            c.Members.Any(m => m.UserId == targetUserId))
                .FirstOrDefaultAsync();
            // 🔼🔼 (انتهى التعديل) 🔼🔼

            if (existingConversation != null)
            {
                // 2. إذا موجودة: أعد الـ ID الخاص بها
                return Json(new { conversationId = existingConversation.Id });
            }

            // 3. إذا غير موجودة: أنشئ واحدة جديدة
            var conversation = new Conversation
            {
                Type = ConversationType.Direct, // ⬅️ (3) استخدم Enum هنا أيضاً
                CreatedByUserId = currentUserId!,
                CreatedAtUtc = DateTime.UtcNow
            };

            // 4. أضف العضوين
            var members = new List<ConversationMember>
    {
        new ConversationMember { UserId = currentUserId!, JoinedAtUtc = DateTime.UtcNow },
        new ConversationMember { UserId = targetUserId, JoinedAtUtc = DateTime.UtcNow }
    };

            conversation.Members = members;

            _db.Conversations.Add(conversation);
            await _db.SaveChangesAsync();

            // 5. أعد الـ ID الجديد
            return Json(new { conversationId = conversation.Id });
        }



        [HttpPost]
        public async Task<IActionResult> EditMessage(long messageId, string newText)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (userId == null) return Unauthorized();

            var msg = await _db.Messages.FirstOrDefaultAsync(m => m.Id == messageId && !m.IsDeleted);
            if (msg == null) return NotFound("الرسالة غير موجودة.");
            if (msg.SenderId != userId) return Forbid();

            msg.Text = newText.Trim();
            msg.IsEdited = true;
            await _db.SaveChangesAsync();

            // بث التحديث إلى الجميع في نفس المحادثة
            await _hubContext.Clients.Group(msg.ConversationId.ToString())
                .SendAsync("MessageEdited", new
                {
                    msg.Id,
                    msg.ConversationId,
                    msg.Text,
                    msg.IsEdited
                });

            return Ok();
        }



        [HttpPost]
        public async Task<IActionResult> DeleteMessage(long messageId, bool deleteForAll = false)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (userId == null) return Unauthorized();

            var msg = await _db.Messages.FirstOrDefaultAsync(m => m.Id == messageId);
            if (msg == null) return NotFound();

            // 🔹 إذا حذف للجميع
            if (deleteForAll)
            {
                if (msg.SenderId != userId) return Forbid();

                msg.IsDeleted = true;
                msg.Text = "🚫 تم حذف هذه الرسالة";
                await _db.SaveChangesAsync();

                await _hubContext.Clients.Group(msg.ConversationId.ToString())
                    .SendAsync("MessageDeleted", new { msg.Id, msg.ConversationId, deleteForAll = true });
            }
            else
            {
                // 🔹 حذف من جهة المستخدم فقط (client-side)
                await _hubContext.Clients.User(userId)
                    .SendAsync("MessageDeleted", new { msg.Id, msg.ConversationId, deleteForAll = false });
            }

            return Ok();
        }


    }
}
