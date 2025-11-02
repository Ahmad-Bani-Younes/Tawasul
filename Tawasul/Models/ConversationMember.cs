namespace Tawasul.Models
{
    public class ConversationMember
    {
        public long ConversationId { get; set; }
        public Conversation Conversation { get; set; } = default!;

        public string UserId { get; set; } = default!;
        public ApplicationUser User { get; set; } = default!;

        public bool IsAdmin { get; set; } = false;
        public DateTime JoinedAtUtc { get; set; } = DateTime.UtcNow;


        public bool IsMuted { get; set; } = false;

        public DateTime? MutedUntilUtc { get; set; }

        public string? InvitedByUserId { get; set; }
        public ApplicationUser? InvitedByUser { get; set; }

        
    }
}
