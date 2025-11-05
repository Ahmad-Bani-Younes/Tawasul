using System.ComponentModel.DataAnnotations.Schema;

namespace Tawasul.Models
{
    public class Message
    {
        public long Id { get; set; }
        public long ConversationId { get; set; }
        public Conversation Conversation { get; set; } = default!;

        public string SenderId { get; set; } = default!;
        public ApplicationUser Sender { get; set; } = default!;

        public string? Text { get; set; }
        public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

        public bool IsEdited { get; set; } = false;
        public bool IsDeleted { get; set; } = false;

        public long? ReplyToMessageId { get; set; }

        [ForeignKey(nameof(ReplyToMessageId))]
        public Message? ReplyTo { get; set; }



        public ICollection<MessageAttachment> Attachments { get; set; } = new List<MessageAttachment>();
        public ICollection<UserMessageStatus> Statuses { get; set; } = new List<UserMessageStatus>();
    }
}
