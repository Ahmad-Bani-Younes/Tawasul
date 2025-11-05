using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using Tawasul.Data;
using Tawasul.DTO;
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


        [HttpGet("Chat/LoadMessages/{id:long}")]
        public async Task<IActionResult> LoadMessages(
      long id,
      [FromQuery] int take = 60,                 // كم رسالة نرجّع بأول فتح/دفعة
      [FromQuery] long? beforeId = null,         // للـ infinite scroll: رجّع رسائل أقدم من رسالة معيّنة
      CancellationToken ct = default)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (userId == null) return Unauthorized();

            // (اختياري لكنه آمن): تأكد إن المستخدم ضمن المحادثة
            bool isMember = await _db.Conversations
                .AnyAsync(c => c.Id == id && c.Members.Any(m => m.UserId == userId), ct);
            if (!isMember) return Forbid();

            // ✅ حد علوي معقول
            if (take <= 0) take = 60;
            if (take > 200) take = 200;

            // ✅ لو بدك "حمّل أقدم": جيب تاريخ الرسالة المرجعية
            DateTime? cutoffUtc = null;
            if (beforeId.HasValue)
            {
                cutoffUtc = await _db.Messages
                    .Where(x => x.Id == beforeId.Value && x.ConversationId == id)
                    .Select(x => (DateTime?)x.CreatedAtUtc)
                    .FirstOrDefaultAsync(ct);
            }

            // ✅ تحديث حالة القراءة للمستخدم الحالي فقط (من دون جلب صفوف)
            await _db.UserMessageStatuses
                .Where(ums => ums.ConversationId == id && ums.UserId == userId && !ums.HasSeen)
                .ExecuteUpdateAsync(
                    updates => updates
                        .SetProperty(ums => ums.HasSeen, true)
                        .SetProperty(ums => ums.SeenAtUtc, DateTime.UtcNow),
                    ct);

            // ✅ الاستعلام: نرتّب تنازلي (الأحدث أولاً) + نقيّد بالـ cutoff إن وُجد + نأخذ فقط take
            var query = _db.Messages
                .AsNoTracking()
                .Where(m => m.ConversationId == id && !m.IsDeleted);

            if (cutoffUtc.HasValue)
                query = query.Where(m => m.CreatedAtUtc < cutoffUtc.Value);

            var listDesc = await query
                .OrderByDescending(m => m.CreatedAtUtc)
                .Take(take)
                .Select(m => new
                {
                    m.Id,
                    m.Text,
                    m.CreatedAtUtc,
                    m.IsDeleted,
                    m.IsEdited,
                    m.ConversationId,

                    SenderId = m.SenderId,
                    IsMine = (m.SenderId == userId),

                    Sender = m.Sender.DisplayName ?? m.Sender.UserName,
                    PhotoUrl = m.Sender.PhotoUrl,

                    // أول مرفق (مطابق لاستخدامك الحالي)
                    FileUrl = m.Attachments.Select(a => a.FilePath).FirstOrDefault(),
                    FileType = m.Attachments.Select(a => a.ContentType).FirstOrDefault(),
                    FileName = m.Attachments.Select(a => a.OriginalName).FirstOrDefault(),
                    FileSize = m.Attachments.Select(a => (long?)a.SizeBytes).FirstOrDefault() ?? 0,

                    // بيانات الرسالة المُشار إليها (إن وُجدت)
                    ReplyTo = _db.Messages
                        .Where(x => x.Id == m.ReplyToMessageId)
                        .Select(x => new
                        {
                            x.Id,
                            x.Text,
                            FileName = x.Attachments.Select(a => a.OriginalName).FirstOrDefault()
                        })
                        .FirstOrDefault()
                })
                .ToListAsync(ct);

            // ✅ رجّع تصاعدي للعرض (الأقدم أولاً داخل الدفعة)
            listDesc.Reverse();

            return Json(listDesc);
        }



        [HttpPost]
        public async Task<IActionResult> SendMessage(long conversationId, string? text, IFormFile? file, long? replyToId)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (userId == null) return Unauthorized();

            if (string.IsNullOrWhiteSpace(text) && file == null)
                return BadRequest("لا يوجد محتوى للإرسال.");

            var sender = await _userManager.FindByIdAsync(userId);
            if (sender == null) return Unauthorized();

            // 🟦 إنشاء الرسالة
            var message = new Message
            {
                ConversationId = conversationId,
                SenderId = userId,
                Text = string.IsNullOrWhiteSpace(text) ? null : text.Trim(),
                CreatedAtUtc = DateTime.UtcNow,
                ReplyToMessageId = replyToId // ✅ الجديد هنا
            };

            _db.Messages.Add(message);
            await _db.SaveChangesAsync();

            // 🟩 لو في ملف
            MessageAttachment? attachment = null;
            if (file != null && file.Length > 0)
            {
                const long maxFileSize = 25 * 1024 * 1024;
                if (file.Length > maxFileSize)
                    return BadRequest("حجم الملف أكبر من المسموح به (25MB).");

                var uploadsPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads", "chat");
                Directory.CreateDirectory(uploadsPath);
                var uniqueName = $"{Guid.NewGuid()}{Path.GetExtension(file.FileName)}";
                var filePath = Path.Combine(uploadsPath, uniqueName);

                using (var stream = new FileStream(filePath, FileMode.Create))
                    await file.CopyToAsync(stream);

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

            // 🟪 تحميل بيانات الرسالة التي تم الرد عليها (إن وجدت)
            object? replyData = null;
            if (replyToId.HasValue)
            {
                replyData = await _db.Messages
                    .Where(x => x.Id == replyToId)
                    .Select(x => new
                    {
                        x.Id,
                        x.Text,
                        FileName = x.Attachments.Select(a => a.OriginalName).FirstOrDefault()
                    })
                    .FirstOrDefaultAsync();
            }

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
                FileSize = attachment?.SizeBytes,
                ReplyTo = replyData // ✅
            };

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
                FileSize = attachment?.SizeBytes,
                ReplyTo = replyData // ✅
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
        public async Task<IActionResult> EditMessage(
    long messageId,
    [FromForm] string? newText,
    [FromForm] IFormFile? file,
    [FromForm] bool removeAttachment = false
)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (userId == null) return Unauthorized();

            var msg = await _db.Messages
                .Include(m => m.Attachments)
                .FirstOrDefaultAsync(m => m.Id == messageId && !m.IsDeleted);

            if (msg == null) return NotFound("الرسالة غير موجودة.");
            if (msg.SenderId != userId) return Forbid();

            newText = string.IsNullOrWhiteSpace(newText) ? null : newText!.Trim();

            var hasNewFile = file is { Length: > 0 };
            var hadAnyAttachment = msg.Attachments != null && msg.Attachments.Any();

            if (newText == msg.Text && !hasNewFile && !removeAttachment)
                return BadRequest("لا يوجد أي تغيير.");

            // 1) تحديث النص
            msg.Text = newText;

            // 2) حذف المرفق الحالي إذا طُلب
            if (removeAttachment && hadAnyAttachment)
            {
                foreach (var at in msg.Attachments.ToList())
                {
                    if (!string.IsNullOrWhiteSpace(at.FilePath))
                    {
                        var phys = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot",
                            at.FilePath.TrimStart('/').Replace("/", Path.DirectorySeparatorChar.ToString()));
                        if (System.IO.File.Exists(phys))
                            System.IO.File.Delete(phys);
                    }
                    _db.MessageAttachments.Remove(at);
                }
            }

            // 3) استبدال/إضافة مرفق جديد (نحافظ على مرفق واحد للرسالة بعد التعديل)
            if (hasNewFile)
            {
                // امسح القديم أولاً
                foreach (var at in msg.Attachments.ToList())
                {
                    if (!string.IsNullOrWhiteSpace(at.FilePath))
                    {
                        var phys = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot",
                            at.FilePath.TrimStart('/').Replace("/", Path.DirectorySeparatorChar.ToString()));
                        if (System.IO.File.Exists(phys))
                            System.IO.File.Delete(phys);
                    }
                    _db.MessageAttachments.Remove(at);
                }

                var uploadsRoot = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads", "chatfiles");
                Directory.CreateDirectory(uploadsRoot);

                var savedName = $"{Guid.NewGuid():N}{Path.GetExtension(file!.FileName)}";
                var fullPath = Path.Combine(uploadsRoot, savedName);

                await using (var fs = new FileStream(fullPath, FileMode.Create))
                    await file.CopyToAsync(fs);

                var relativePath = $"/uploads/chatfiles/{savedName}";

                msg.Attachments.Add(new MessageAttachment
                {
                    FilePath = relativePath,
                    ContentType = file.ContentType,
                    SizeBytes = file.Length,
                    OriginalName = file.FileName
                });
            }

            msg.IsEdited = true;
            await _db.SaveChangesAsync();

            // جهّز المرفق (إن وُجد) بنفس أسماء المفاتيح التي يستخدمها الفرونت
            var atc = msg.Attachments.FirstOrDefault();

            await _hubContext.Clients.Group(msg.ConversationId.ToString())
                .SendAsync("MessageEdited", new
                {
                    id = msg.Id,
                    conversationId = msg.ConversationId,
                    text = msg.Text,
                    isEdited = msg.IsEdited,
                    fileUrl = atc?.FilePath,           // يتوافق مع appendMessage()
                    fileName = atc?.OriginalName,
                    fileType = atc?.ContentType,
                    fileSize = atc?.SizeBytes
                });

            return Ok();
        }




        [HttpPost]
        public async Task<IActionResult> DeleteMessage(long messageId, bool deleteForAll = false)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (userId == null) return Unauthorized();

            var msg = await _db.Messages
                .Include(m => m.Attachments)
                .FirstOrDefaultAsync(m => m.Id == messageId);

            if (msg == null) return NotFound("الرسالة غير موجودة.");

            if (deleteForAll)
            {
                if (msg.SenderId != userId) return Forbid();

                if (msg.Attachments != null && msg.Attachments.Any())
                {
                    foreach (var at in msg.Attachments)
                    {
                        if (!string.IsNullOrWhiteSpace(at.FilePath))
                        {
                            var phys = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot",
                                at.FilePath.TrimStart('/').Replace("/", Path.DirectorySeparatorChar.ToString()));
                            if (System.IO.File.Exists(phys))
                                System.IO.File.Delete(phys);
                        }
                    }
                    _db.MessageAttachments.RemoveRange(msg.Attachments);
                }

                _db.Messages.Remove(msg);
                await _db.SaveChangesAsync();

                await _hubContext.Clients.Group(msg.ConversationId.ToString())
                    .SendAsync("MessageDeleted", new
                    {
                        id = msg.Id,
                        conversationId = msg.ConversationId,
                        deletedCompletely = true
                    });
            }
            else
            {
                // حذف من جهة المستخدم فقط
                await _hubContext.Clients.User(userId)
                    .SendAsync("MessageDeleted", new
                    {
                        id = msg.Id,
                        conversationId = msg.ConversationId,
                        deletedCompletely = false
                    });
            }

            return Ok();
        }


        // ✅ جلب حالة المستخدم (Online/Offline + آخر ظهور)
        [HttpGet]
        public async Task<IActionResult> GetUserStatus(long conversationId)
        {
            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (currentUserId == null) return Unauthorized();

            // جلب المستخدم الآخر في المحادثة
            var otherUserId = await _db.ConversationMembers
                .Where(cm => cm.ConversationId == conversationId && cm.UserId != currentUserId)
                .Select(cm => cm.UserId)
                .FirstOrDefaultAsync();

            if (otherUserId == null) 
                return Json(new { isOnline = false, lastSeenAt = (DateTime?)null });

            var user = await _db.Users.FindAsync(otherUserId);
            if (user == null) 
                return Json(new { isOnline = false, lastSeenAt = (DateTime?)null });

            return Json(new { 
                isOnline = user.IsOnline,
                lastSeenAt = user.LastSeenAt.HasValue ? (DateTime?)user.LastSeenAt.Value.UtcDateTime : null
            });
        }



        [HttpGet]
        public async Task<IActionResult> GetPeerProfile(long conversationId)
        {
            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (currentUserId == null) return Unauthorized();

            var otherUser = await _db.ConversationMembers
                .Where(cm => cm.ConversationId == conversationId && cm.UserId != currentUserId)
                .Select(cm => cm.User)
                .FirstOrDefaultAsync();

            if (otherUser == null) return NotFound();

            string? lastSeenText = null;
            if (otherUser.LastSeenAt.HasValue && !otherUser.IsOnline)
            {
                var last = otherUser.LastSeenAt.Value.UtcDateTime;
                var diff = DateTime.UtcNow - last;
                if (diff.TotalMinutes < 1) lastSeenText = "آخر ظهور منذ لحظات";
                else if (diff.TotalHours < 1) lastSeenText = $"آخر ظهور منذ {Math.Floor(diff.TotalMinutes)} دقيقة";
                else if (diff.TotalDays < 1) lastSeenText = $"آخر ظهور منذ {Math.Floor(diff.TotalHours)} ساعة";
                else lastSeenText = $"آخر ظهور منذ {Math.Floor(diff.TotalDays)} يوم";
            }

            // مرفقات
            var attachQuery = _db.Messages
                .Where(m => m.ConversationId == conversationId && !m.IsDeleted && m.Attachments.Any());

            var attachTotal = await attachQuery.CountAsync();

            var attachPage = await attachQuery
                .OrderByDescending(m => m.CreatedAtUtc)
                .Take(200)
                .Select(m => new
                {
                    m.CreatedAtUtc,
                    Items = m.Attachments.Select(a => new { url = a.FilePath, type = a.ContentType })
                })
                .ToListAsync();

            var attachmentItems = attachPage
                .SelectMany(x => x.Items.Select(i => new {
                    url = i.url,
                    type = i.type,
                    kind = i.type.StartsWith("image/") ? "image"
                         : i.type.StartsWith("video/") ? "video"
                         : i.type.StartsWith("audio/") ? "audio"
                         : "file",
                    createdAtUtc = x.CreatedAtUtc
                }))
                .ToList();

            // روابط داخل النصوص
            var linkCandidates = await _db.Messages
                .Where(m => m.ConversationId == conversationId && !m.IsDeleted && m.Text != null && EF.Functions.Like(m.Text, "%http%"))
                .OrderByDescending(m => m.CreatedAtUtc)
                .Take(200)
                .Select(m => new { m.Text, m.CreatedAtUtc })
                .ToListAsync();

            var linkItems = new List<object>();
            var urlRegex = new System.Text.RegularExpressions.Regex(@"https?:\/\/[^\s]+", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            foreach (var row in linkCandidates)
                foreach (System.Text.RegularExpressions.Match mt in urlRegex.Matches(row.Text ?? ""))
                    linkItems.Add(new { url = mt.Value, type = "text/uri", kind = "link", createdAtUtc = row.CreatedAtUtc });

            var recentMedia = attachmentItems.Concat(linkItems)
                .OrderByDescending(x => ((DateTime)x.GetType().GetProperty("createdAtUtc")!.GetValue(x)!))
                .Take(200)
                .Select(x => new {
                    url = (string)x.GetType().GetProperty("url")!.GetValue(x)!,
                    type = (string)x.GetType().GetProperty("type")!.GetValue(x)!,
                    kind = (string)x.GetType().GetProperty("kind")!.GetValue(x)!
                })
                .ToList();

            var mediaTotal = attachTotal + linkItems.Count;

            return Json(new
            {
                displayName = otherUser.DisplayName ?? otherUser.UserName ?? "(مستخدم)",
                photoUrl = string.IsNullOrWhiteSpace(otherUser.PhotoUrl) ? null : otherUser.PhotoUrl,
                isOnline = otherUser.IsOnline,
                lastSeenText,
                email = otherUser.Email,
                phone = otherUser.PhoneNumber,
                recentMedia,
                mediaTotal
            });
        }


        [HttpGet]
        public async Task<IActionResult> GetConversationMedia(
     long conversationId, int page = 1, int pageSize = 24, string? kind = null)
        {
            if (page < 1) page = 1;
            if (pageSize < 1) pageSize = 24;
            int skip = (page - 1) * pageSize;

            var k = (kind ?? "all").Trim().ToLowerInvariant();
            // تحصين القيم المسموحة
            var allowed = new HashSet<string> { "all", "image", "video", "audio", "file", "link" };
            if (!allowed.Contains(k))
                return BadRequest("Invalid kind");

            // ============ المرفقات (من قاعدة البيانات) ============
            // نبني الاستعلام بطريقة تُترجم لِـ SQL بالكامل
            var attachQuery = _db.Messages
                .Where(m => m.ConversationId == conversationId && !m.IsDeleted && m.Attachments.Any())
                .SelectMany(m => m.Attachments.Select(a => new
                {
                    url = a.FilePath,
                    type = a.ContentType,
                    createdAtUtc = m.CreatedAtUtc,
                    // نتعامل مع null قبل StartsWith
                    kind = ((a.ContentType ?? "").StartsWith("image/")) ? "image" :
                           ((a.ContentType ?? "").StartsWith("video/")) ? "video" :
                           ((a.ContentType ?? "").StartsWith("audio/")) ? "audio" : "file"
                }));

            if (k != "all" && k != "link") // لو طلب نوع وسائط محدد، صفّيه هنا
                attachQuery = attachQuery.Where(x => x.kind == k);

            var attachList = await attachQuery
                .OrderByDescending(x => x.createdAtUtc)
                .ToListAsync(); // لحد الآن كلّه على السيرفر

            // ============ الروابط (مستخرجة من النص) ============
            // نحمّل الرسائل النصية إلى الذاكرة ثم نُخرج الروابط بـ Regex
            var linkList = new List<(string url, string type, string kind, DateTime createdAtUtc)>();

            if (k == "all" || k == "link")
            {
                var linkRows = await _db.Messages
                    .Where(m => m.ConversationId == conversationId
                                && !m.IsDeleted
                                && m.Text != null
                                && EF.Functions.Like(m.Text, "%http%"))
                    .Select(m => new { m.Text, m.CreatedAtUtc })
                    .ToListAsync(); // تحميل للذاكرة

                var urlRegex = new System.Text.RegularExpressions.Regex(
                    @"https?:\/\/[^\s]+",
                    System.Text.RegularExpressions.RegexOptions.IgnoreCase);

                foreach (var r in linkRows)
                {
                    foreach (System.Text.RegularExpressions.Match mt in urlRegex.Matches(r.Text ?? ""))
                    {
                        linkList.Add((mt.Value, "text/uri", "link", r.CreatedAtUtc));
                    }
                }
            }

            // ============ الدمج + الترتيب + الحساب ============
            // ندمج في الذاكرة (هيك نتجنب Concat بين مزوّدين)
            var all = attachList
                .Select(x => new { x.url, type = x.type ?? "", kind = x.kind, x.createdAtUtc })
                .Concat(linkList.Select(x => new { x.url, type = x.type, kind = x.kind, createdAtUtc = x.createdAtUtc }))
                .OrderByDescending(x => x.createdAtUtc)
                .ToList();

            var total = all.Count;

            var items = all
                .Skip(skip)
                .Take(pageSize)
                .Select(x => new { x.url, x.type, x.kind })
                .ToList();

            return Json(new { total, items });
        }





        [HttpGet]
        public async Task<IActionResult> LinkPreview([FromQuery] string url)
        {
            if (string.IsNullOrWhiteSpace(url)) return BadRequest();

            if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) || !(uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps))
                return BadRequest();

            var dto = new LinkPreviewDto { Url = uri.ToString(), Domain = uri.Host.ToLowerInvariant() };

            // هيوريستكس أمان خفيفة (سيرفر)
            var reasons = new List<string>();
            string risk = "safe";

            if (System.Text.RegularExpressions.Regex.IsMatch(dto.Domain, @"^(?:\d{1,3}\.){3}\d{1,3}$"))
            { reasons.Add("رابط إلى IP مباشرة"); risk = "warn"; }

            if (dto.Domain.StartsWith("xn--"))
            { reasons.Add("دومين مموّه (Punycode)"); risk = "warn"; }

            if (dto.Url.Length > 300) { reasons.Add("رابط طويل جداً"); if (risk != "dang") risk = "warn"; }

            try
            {
                using var http = new HttpClient(new HttpClientHandler
                {
                    AllowAutoRedirect = true,
                    MaxAutomaticRedirections = 5
                });
                http.Timeout = TimeSpan.FromSeconds(4);

                // طلب GET خفيف
                using var resp = await http.GetAsync(uri, HttpCompletionOption.ResponseHeadersRead);
                var ctype = resp.Content.Headers.ContentType?.MediaType ?? "";
                string html = "";

                if (ctype.Contains("text/html"))
                {
                    // نقرأ أول ~120KB فقط
                    var bytes = await resp.Content.ReadAsByteArrayAsync();
                    var slice = bytes.Length > 120_000 ? bytes.AsSpan(0, 120_000).ToArray() : bytes;
                    html = System.Text.Encoding.UTF8.GetString(slice);
                }

                // استخراج OG/Twitter/Title سريع بـ Regex
                string GetMeta(string name)
                {
                    // og:name
                    var m1 = System.Text.RegularExpressions.Regex.Match(html, $"<meta[^>]+property=[\"']og:{name}[\"'][^>]*content=[\"']([^\"']+)[\"'][^>]*>", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                    if (m1.Success) return m1.Groups[1].Value;

                    // twitter:name
                    var m2 = System.Text.RegularExpressions.Regex.Match(html, $"<meta[^>]+name=[\"']twitter:{name}[\"'][^>]*content=[\"']([^\"']+)[\"'][^>]*>", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                    if (m2.Success) return m2.Groups[1].Value;

                    return "";
                }

                var title = GetMeta("title");
                var desc = GetMeta("description");

                if (string.IsNullOrWhiteSpace(title))
                {
                    var mt = System.Text.RegularExpressions.Regex.Match(html, "<title>([^<]{1,180})</title>", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                    if (mt.Success) title = System.Net.WebUtility.HtmlDecode(mt.Groups[1].Value.Trim());
                }

                var img = GetMeta("image");
                string fav = $"https://www.google.com/s2/favicons?domain={dto.Domain}&sz=64";

                dto.Title = string.IsNullOrWhiteSpace(title) ? null : title;
                dto.Description = string.IsNullOrWhiteSpace(desc) ? null : desc;
                dto.Image = string.IsNullOrWhiteSpace(img) ? null : img;
                dto.Favicon = fav;

                dto.Risk = risk;
                dto.Safe = risk == "safe";
                dto.Reasons = reasons;
            }
            catch
            {
                dto.Risk = risk == "safe" ? "warn" : risk;
                dto.Safe = dto.Risk == "safe";
                dto.Reasons = reasons;
                // نترك العنوان/الوصف فارغين في حال الفشل
            }

            return Json(dto);
        }



   
[HttpGet]
    public async Task<IActionResult> Search([FromQuery] ChatSearchRequestVm rq, CancellationToken ct)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId == null) return Unauthorized();

        var page = rq.Page <= 0 ? 1 : rq.Page;
        var pageSize = rq.PageSize <= 0 ? 20 : Math.Min(rq.PageSize, 200);
        var skip = (page - 1) * pageSize;

        var q = (rq.Q ?? string.Empty).Trim();
        var hasQ = q.Length > 0;

        // ابحث فقط ضمن محادثات المستخدم
        IQueryable<Message> baseMsgs = _db.Messages
            .AsNoTracking()
            .Where(m => !m.IsDeleted &&
                        m.Conversation.Members.Any(cm => cm.UserId == userId));

        // تقييد بمحادثة معيّنة (اختياري)
        if (rq.ConversationId.HasValue)
        {
            var convId = rq.ConversationId.Value;
            var isMember = await _db.Conversations
                .AnyAsync(c => c.Id == convId && c.Members.Any(cm => cm.UserId == userId), ct);
            if (!isMember) return Forbid();
            baseMsgs = baseMsgs.Where(m => m.ConversationId == convId);
        }

        // سنبني اتحاد الاستعلامات
        IQueryable<ChatSearchItemVm>? union = null;

        // ================== النصوص ==================
        if (rq.InMessages)
        {
            var q1 = baseMsgs
                .Where(m => m.Text != null && (!hasQ || EF.Functions.Like(m.Text!, $"%{q}%")))
                .Select(m => new ChatSearchItemVm
                {
                    MessageId = m.Id,
                    ConversationId = m.ConversationId,

                    ConversationTitle = m.Conversation.Type == ConversationType.Group
                        ? (m.Conversation.Title ?? "(محادثة)")
                        : (
                            m.Conversation.Members
                             .Where(mm => mm.UserId != userId)
                             .Select(mm => mm.User.DisplayName ?? mm.User.Email ?? "(مستخدم)")
                             .FirstOrDefault() ?? "(مستخدم)"
                          ),

                    SenderDisplay = m.Sender.DisplayName ?? m.Sender.UserName ?? m.Sender.Email ?? "(مستخدم)",
                    CreatedAtUtc = m.CreatedAtUtc,
                    Kind = "message",
                    Snippet = m.Text,
                    FileUrl = null,
                    FileName = null,
                    FileType = null,
                    FileSize = 0
                });

            union ??= q1;
            if (union != q1) union = union.Concat(q1);
        }

        // ================== الملفات ==================
        if (rq.InFiles)
        {
            var q2 = baseMsgs
                .Where(m => m.Attachments.Any())
                .SelectMany(m => m.Attachments.Select(a => new { m, a }))
                .Where(x => !hasQ || EF.Functions.Like(x.a.OriginalName ?? "", $"%{q}%"))
                .Select(x => new ChatSearchItemVm
                {
                    MessageId = x.m.Id,
                    ConversationId = x.m.ConversationId,

                    ConversationTitle = x.m.Conversation.Type == ConversationType.Group
                        ? (x.m.Conversation.Title ?? "(محادثة)")
                        : (
                            x.m.Conversation.Members
                              .Where(mm => mm.UserId != userId)
                              .Select(mm => mm.User.DisplayName ?? mm.User.Email ?? "(مستخدم)")
                              .FirstOrDefault() ?? "(مستخدم)"
                          ),

                    SenderDisplay = x.m.Sender.DisplayName ?? x.m.Sender.UserName ?? x.m.Sender.Email ?? "(مستخدم)",
                    CreatedAtUtc = x.m.CreatedAtUtc,
                    Kind = "file",
                    Snippet = null,
                    FileUrl = x.a.FilePath,
                    FileName = x.a.OriginalName,
                    FileType = x.a.ContentType,
                    FileSize = x.a.SizeBytes
                });

            union ??= q2;
            if (union != q2) union = union.Concat(q2);
        }

        // ================== الروابط ==================
        if (rq.InLinks)
        {
            var q3 = baseMsgs
                .Where(m => m.Text != null &&
                            EF.Functions.Like(m.Text!, "%http%") &&
                            (!hasQ || EF.Functions.Like(m.Text!, $"%{q}%")))
                .Select(m => new ChatSearchItemVm
                {
                    MessageId = m.Id,
                    ConversationId = m.ConversationId,

                    ConversationTitle = m.Conversation.Type == ConversationType.Group
                        ? (m.Conversation.Title ?? "(محادثة)")
                        : (
                            m.Conversation.Members
                             .Where(mm => mm.UserId != userId)
                             .Select(mm => mm.User.DisplayName ?? mm.User.Email ?? "(مستخدم)")
                             .FirstOrDefault() ?? "(مستخدم)"
                          ),

                    SenderDisplay = m.Sender.DisplayName ?? m.Sender.UserName ?? m.Sender.Email ?? "(مستخدم)",
                    CreatedAtUtc = m.CreatedAtUtc,
                    Kind = "link",
                    Snippet = m.Text,
                    FileUrl = null,
                    FileName = null,
                    FileType = null,
                    FileSize = 0
                });

            union ??= q3;
            if (union != q3) union = union.Concat(q3);
        }

        if (union == null)
        {
            return Json(new ChatSearchResponseVm { Total = 0, Items = new List<ChatSearchItemVm>() });
        }

        var total = await union.CountAsync(ct);

        var items = await union
            .OrderByDescending(x => x.CreatedAtUtc)
            .Skip(skip)
            .Take(pageSize)
            .ToListAsync(ct);

        // قصّ الـSnippet بعد الجلب
        for (int i = 0; i < items.Count; i++)
        {
            var s = items[i].Snippet;
            if (!string.IsNullOrEmpty(s) && s.Length > 240)
                items[i].Snippet = s.Substring(0, 240) + "…";
        }

        return Json(new ChatSearchResponseVm { Total = total, Items = items });
    }





}
}
