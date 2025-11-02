using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using Tawasul.Data;
using Tawasul.Models;

namespace Tawasul.Controllers
{
    [Authorize]
    public class GroupMembersController : Controller
    {
        private readonly TawasulDbContext _db;
        private readonly UserManager<ApplicationUser> _userManager;

        public GroupMembersController(TawasulDbContext db, UserManager<ApplicationUser> userManager)
        {
            _db = db;
            _userManager = userManager;
        }

        [HttpPost]
        public async Task<IActionResult> AddMember(long groupId, string userId)
        {
            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);

            var group = await _db.Conversations
                .Include(c => c.Members)
                .FirstOrDefaultAsync(c => c.Id == groupId && c.Type == ConversationType.Group);

            if (group == null)
                return NotFound();

            var currentMember = group.Members.FirstOrDefault(m => m.UserId == currentUserId);
            bool isOwner = group.CreatedByUserId == currentUserId;
            bool isAdmin = currentMember?.IsAdmin == true;

            bool already = await _db.ConversationMembers
                .AnyAsync(m => m.ConversationId == groupId && m.UserId == userId);
            if (already)
                return BadRequest("المستخدم موجود بالفعل.");

            if (isOwner || isAdmin)
            {
                _db.ConversationMembers.Add(new ConversationMember
                {
                    ConversationId = groupId,
                    UserId = userId,
                    JoinedAtUtc = DateTime.UtcNow,
                    InvitedByUserId = currentUserId // ✅ جديد
                });
                await _db.SaveChangesAsync();
                return Ok("تمت إضافة العضو بنجاح ✅");
            }


            // ✅ إذا كان عضو عادي → إنشاء طلب انضمام Pending
            var existingRequest = await _db.GroupJoinRequests
                .FirstOrDefaultAsync(r => r.GroupId == groupId && r.TargetUserId == userId && r.Status == "Pending"); // ✅ هنا غيّرنا ConversationId → GroupId

            if (existingRequest != null)
                return BadRequest("طلب الانضمام قيد المراجعة بالفعل.");

            _db.GroupJoinRequests.Add(new GroupJoinRequest
            {
                GroupId = groupId, // ✅ غيّرنا الاسم
                RequestedByUserId = currentUserId,
                TargetUserId = userId,
                Status = "Pending",
                CreatedAtUtc = DateTime.UtcNow
            });

            await _db.SaveChangesAsync();
            return Ok("تم إرسال طلب الانضمام، بانتظار موافقة الإدارة ✅");
        }


        // ✅ إزالة عضو (صلاحيات حسب الدور)
        [HttpPost]
        public async Task<IActionResult> RemoveMember(long groupId, string userId)
        {
            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var group = await _db.Conversations
                .Include(c => c.Members)
                .FirstOrDefaultAsync(c => c.Id == groupId && c.Type == ConversationType.Group);

            if (group == null)
                return NotFound();

            bool isOwner = group.CreatedByUserId == currentUserId;
            var currentMember = group.Members.FirstOrDefault(m => m.UserId == currentUserId);
            var target = group.Members.FirstOrDefault(m => m.UserId == userId);

            if (target == null)
                return NotFound();

            // 🚫 لا يمكن إزالة المالك
            if (target.UserId == group.CreatedByUserId)
                return Forbid();

            // 🚫 الأدمن لا يمكنه إزالة أدمن آخر أو المالك
            if (!isOwner && currentMember?.IsAdmin == true && (target.IsAdmin || target.UserId == group.CreatedByUserId))
                return Forbid();

            // ✅ المالك أو الأدمن فقط
            if (!isOwner && currentMember?.IsAdmin != true)
                return Forbid();

            _db.ConversationMembers.Remove(target);
            await _db.SaveChangesAsync();
            return Ok();
        }

        // ✅ ترقية / إلغاء أدمن (المالك فقط)
        [HttpPost]
        public async Task<IActionResult> ToggleAdmin(long groupId, string userId)
        {
            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var group = await _db.Conversations
                .Include(c => c.Members)
                .FirstOrDefaultAsync(c => c.Id == groupId && c.Type == ConversationType.Group);

            if (group == null)
                return NotFound();

            bool isOwner = group.CreatedByUserId == currentUserId;
            if (!isOwner)
                return Forbid();

            var member = group.Members.FirstOrDefault(m => m.UserId == userId);
            if (member == null || member.UserId == group.CreatedByUserId)
                return Forbid();

            member.IsAdmin = !member.IsAdmin;
            await _db.SaveChangesAsync();
            return Ok();
        }

        // ✅ كتم عضو (المالك أو الأدمن)
        [HttpPost]
        public async Task<IActionResult> MuteMember(long groupId, string userId, int hours)
        {
            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var group = await _db.Conversations
                .Include(c => c.Members)
                .FirstOrDefaultAsync(c => c.Id == groupId && c.Type == ConversationType.Group);

            if (group == null)
                return NotFound();

            bool isOwner = group.CreatedByUserId == currentUserId;
            var currentMember = group.Members.FirstOrDefault(m => m.UserId == currentUserId);
            var target = group.Members.FirstOrDefault(m => m.UserId == userId);

            if (target == null)
                return NotFound();

            if (target.UserId == group.CreatedByUserId)
                return Forbid();

            if (!isOwner && currentMember?.IsAdmin == true && (target.IsAdmin || target.UserId == group.CreatedByUserId))
                return Forbid();

            if (!isOwner && currentMember?.IsAdmin != true)
                return Forbid();

            target.IsMuted = true;
            target.MutedUntilUtc = DateTime.UtcNow.AddHours(hours);

            await _db.SaveChangesAsync();
            return Ok();
        }

        // ✅ فك الكتم
        [HttpPost]
        public async Task<IActionResult> UnmuteMember(long groupId, string userId)
        {
            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var group = await _db.Conversations
                .Include(c => c.Members)
                .FirstOrDefaultAsync(c => c.Id == groupId && c.Type == ConversationType.Group);

            if (group == null)
                return NotFound();

            bool isOwner = group.CreatedByUserId == currentUserId;
            var currentMember = group.Members.FirstOrDefault(m => m.UserId == currentUserId);
            var target = group.Members.FirstOrDefault(m => m.UserId == userId);

            if (target == null)
                return NotFound();

            if (!isOwner && currentMember?.IsAdmin != true)
                return Forbid();

            if (!isOwner && currentMember?.IsAdmin == true && (target.IsAdmin || target.UserId == group.CreatedByUserId))
                return Forbid();

            target.IsMuted = false;
            target.MutedUntilUtc = null;
            await _db.SaveChangesAsync();
            return Ok();
        }

        // ✅ البحث عن المستخدمين (نسخة سريعة باستعلام واحد)
        [HttpGet]
        public async Task<IActionResult> Search(string query, long? groupId)
        {
            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrWhiteSpace(query))
                return Json(new List<object>());

            var normalizedQuery = query.Trim().ToUpper();

            // 🔽🔽 (هذا هو التحسين) 🔽🔽
            // دمجنا الاستعلامين في استعلام واحد يُنفذ بالكامل في SQL
            var usersQuery = _db.Users
                .Where(u => u.Id != currentUserId &&
                            (
                                (u.NormalizedEmail != null && u.NormalizedEmail.Contains(normalizedQuery)) ||
                                (u.PhoneNumber != null && u.PhoneNumber.Contains(query))
                            ));

            // إذا كان هناك (groupId)، قم بفلترة الأعضاء الموجودين مسبقاً
            if (groupId.HasValue)
            {
                usersQuery = usersQuery
                    .Where(u => !_db.ConversationMembers.Any(cm => cm.ConversationId == groupId.Value && cm.UserId == u.Id));
            }
            // 🔼🔼 (انتهى التحسين) 🔼🔼

            var users = await usersQuery
                .Select(u => new
                {
                    u.Id,
                    u.DisplayName,
                    u.PhotoUrl,
                    u.Email
                })
                .Take(5)
                .ToListAsync();

            return Json(users);
        }
    }
}
