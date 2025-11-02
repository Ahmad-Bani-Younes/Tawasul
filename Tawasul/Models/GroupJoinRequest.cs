using System;
using System.ComponentModel.DataAnnotations.Schema;

namespace Tawasul.Models
{
    [Table("tc.GroupJoinRequests")]
    public class GroupJoinRequest
    {
        public long Id { get; set; }
        public long GroupId { get; set; }                 

        public long ConversationId { get; set; }

        public string RequestedByUserId { get; set; } = null!;

        public string TargetUserId { get; set; } = null!;

        public string? InvitedByUserId { get; set; }   // ✅ جديد


        public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

        public string Status { get; set; } = "Pending"; // Pending / Approved / Rejected
        public ApplicationUser? RequestedByUser { get; set; }
        public ApplicationUser? TargetUser { get; set; }   // 👈 أضف هذه السطر

        public ApplicationUser? InvitedByUser { get; set; } // ✅ جديد

    }
}
