namespace Tawasul.Models
{
    public enum ConversationType { Direct = 0, Group = 1 }
    public enum ExpiryAction { None = 0, Archive = 1, Delete = 2 }

    public class Conversation
    {
        public long Id { get; set; }
        public ConversationType Type { get; set; }
        public string? Title { get; set; }

        public string CreatedByUserId { get; set; } = default!;
        public ApplicationUser CreatedByUser { get; set; } = default!;
        public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

        // Ephemeral
        public DateTime? ExpiresAtUtc { get; set; }
        public ExpiryAction ExpiryAction { get; set; } = ExpiryAction.None;

        public ICollection<ConversationMember> Members { get; set; } = new List<ConversationMember>();
        public ICollection<Message> Messages { get; set; } = new List<Message>();
    }
}
