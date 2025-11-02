using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using Tawasul.Data;
using Tawasul.Models;

namespace Tawasul.Controllers
{
    [Authorize]
    public class GroupJoinRequestsController : Controller
    {
        private readonly TawasulDbContext _db;
        public GroupJoinRequestsController(TawasulDbContext db)
        {
            _db = db;
        }

        // ✅ عرض الطلبات المعلقة (للمالك أو الأدمن)
        [HttpGet]
        public async Task<IActionResult> GetPending(long groupId)
        {
            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);

            var group = await _db.Conversations
                .Include(c => c.Members)
                .FirstOrDefaultAsync(c => c.Id == groupId);

            if (group == null)
                return NotFound();

            var currentMember = group.Members.FirstOrDefault(m => m.UserId == currentUserId);
            bool isOwner = group.CreatedByUserId == currentUserId;
            bool isAdmin = currentMember?.IsAdmin == true;

            if (!isOwner && !isAdmin)
                return Forbid();

            var requests = await _db.GroupJoinRequests
                .Include(r => r.TargetUser)
                .Where(r => r.GroupId == groupId && r.Status == "Pending")
                .Select(r => new
                {
                    r.Id,
                    r.TargetUser.Email,
                    r.TargetUser.DisplayName,
                    r.TargetUser.PhotoUrl
                })
                .ToListAsync();

            return Json(requests);
        }

        // ✅ قبول الطلب
        [HttpPost]
        public async Task<IActionResult> Approve(long id)
        {
            var req = await _db.GroupJoinRequests.Include(r => r.TargetUser).FirstOrDefaultAsync(r => r.Id == id);
            if (req == null) return NotFound();

            req.Status = "Approved";
            _db.ConversationMembers.Add(new ConversationMember
            {
                ConversationId = req.GroupId,
                UserId = req.TargetUserId,
                JoinedAtUtc = DateTime.UtcNow,
                InvitedByUserId = req.RequestedByUserId // ✅ نعرف مين دعاه
            });
            await _db.SaveChangesAsync();

            return Ok();
        }

        // ✅ رفض الطلب
        [HttpPost]
        public async Task<IActionResult> Reject(long id)
        {
            var req = await _db.GroupJoinRequests.FirstOrDefaultAsync(r => r.Id == id);
            if (req == null) return NotFound();

            req.Status = "Rejected";
            await _db.SaveChangesAsync();
            return Ok();
        }
    }
}
