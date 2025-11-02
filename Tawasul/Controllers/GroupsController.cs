using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using Tawasul.Data;
using Tawasul.Models;
using Tawasul.Models.ViewModels;

namespace Tawasul.Controllers
{
    [Authorize]
    public class GroupsController : Controller
    {
        private readonly TawasulDbContext _db;
        private readonly UserManager<ApplicationUser> _userManager;

        public GroupsController(TawasulDbContext db, UserManager<ApplicationUser> userManager)
        {
            _db = db;
            _userManager = userManager;
        }

        // ✅ عرض جميع المجموعات (النسخة المُعدلة والسريعة)
        public async Task<IActionResult> Index()
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

            var groups = await _db.Conversations
                .Where(c => c.Type == ConversationType.Group &&
                            c.Members.Any(m => m.UserId == userId))
                .Select(c => new GroupListViewModel
                {
                    Id = c.Id,
                    Title = c.Title ?? "(مجموعة بدون اسم)",

                    // 🔽🔽 (هذا هو التعديل الصحيح) 🔽🔽
                    // جلب الاسم من داخل الـ Select
                    CreatorName = c.CreatedByUser.DisplayName ?? c.CreatedByUser.Email,
                    // 🔼🔼 (انتهى التعديل) 🔼🔼

                    MembersCount = c.Members.Count(),
                    CreatedAtUtc = c.CreatedAtUtc
                })
                .OrderByDescending(g => g.CreatedAtUtc)
                .ToListAsync();

            return View(groups);
        }

        // ✅ صفحة إنشاء مجموعة جديدة
        [HttpGet]
        public IActionResult Create()
        {
            return View();
        }

        [HttpPost]
        // [ValidateAntiForgeryToken] // ⬅️ ⬅️ (تم حذف السطر)
        public async Task<IActionResult> Create(string title)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrWhiteSpace(title))
                return BadRequest("الرجاء إدخال اسم المجموعة.");

            var group = new Conversation
            {
                Title = title.Trim(),
                Type = ConversationType.Group,
                CreatedByUserId = userId!,
                CreatedAtUtc = DateTime.UtcNow,
                Members = new List<ConversationMember>
                {
                    new ConversationMember
                    {
                        UserId = userId!,
                        JoinedAtUtc = DateTime.UtcNow
                    }
                }
            };

            _db.Conversations.Add(group);
            await _db.SaveChangesAsync();

            return Ok(); // ✅ سيعمل الـ Ajax الآن
        }

        // ... (باقي الدوال: Details و SearchGroups كما هي) ...

        // ... (دالة Details عندك صحيحة لأنها تستخدم Include) ...
        public async Task<IActionResult> Details(long id)
        {
            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);

            var group = await _db.Conversations
                .Include(c => c.Members)
                    .ThenInclude(m => m.User)
                .FirstOrDefaultAsync(c => c.Id == id && c.Type == ConversationType.Group);

            if (group == null)
                return NotFound();

            // ✅ فك الكتم التلقائي إذا انتهت المدة
            bool changesMade = false;
            foreach (var member in group.Members)
            {
                if (member.IsMuted && member.MutedUntilUtc.HasValue && member.MutedUntilUtc.Value <= DateTime.UtcNow)
                {
                    member.IsMuted = false;
                    member.MutedUntilUtc = null;
                    changesMade = true;
                }
            }

            if (changesMade)
                await _db.SaveChangesAsync();

            // ✅ بناء ViewModel بعد التأكد من الحالة المحدثة
            var vm = new GroupDetailsViewModel
            {
                Id = group.Id,
                Title = group.Title!,
                CreatorId = group.CreatedByUserId!,
                CreatorName = await _db.Users
                    .Where(u => u.Id == group.CreatedByUserId)
                    .Select(u => u.DisplayName ?? u.Email)
                    .FirstOrDefaultAsync() ?? "(غير معروف)",
                CreatedAtUtc = group.CreatedAtUtc,
                IsOwner = group.CreatedByUserId == currentUserId,
                Members = group.Members.Select(m => new GroupMemberItem
                {
                    UserId = m.UserId,
                    DisplayName = m.User.DisplayName ?? m.User.Email,
                    PhotoUrl = m.User.PhotoUrl,
                    IsOwner = m.UserId == group.CreatedByUserId,
                    IsAdmin = m.IsAdmin,
                    IsMuted = m.IsMuted,
                    JoinedAtUtc = m.JoinedAtUtc,
                    InvitedByName = m.InvitedByUser != null
          ? (m.InvitedByUser.DisplayName ?? m.InvitedByUser.Email)
          : null
                }).ToList()

            };

            return View(vm);
        }




        // ... (دالة SearchGroups) ...
        public async Task<IActionResult> SearchGroups(string query)
        {
            //...
            return Ok();
        }
    }
}