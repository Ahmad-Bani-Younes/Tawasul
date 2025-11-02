namespace Tawasul.Models
{
    public class MessageAttachment
    {
        public long Id { get; set; }
        public long MessageId { get; set; }
        public Message Message { get; set; } = default!;

        public string FilePath { get; set; } = default!;
        public string ContentType { get; set; } = default!;
        public long SizeBytes { get; set; }
        public string? OriginalName { get; set; }
    }
}
