namespace Tawasul.Models
{
    public class UserMessageStatus
    {
        public long MessageId { get; set; }
        public Message Message { get; set; } = default!;

        public string UserId { get; set; } = default!;
        public ApplicationUser User { get; set; } = default!;

        public long ConversationId { get; set; }       // denormalized
        public bool HasSeen { get; set; } = false;
        public DateTime? SeenAtUtc { get; set; }
    }
}
