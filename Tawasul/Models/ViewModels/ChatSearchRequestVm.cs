using System.ComponentModel.DataAnnotations;

namespace Tawasul.Models.ViewModels
{
    public class ChatSearchRequestVm
    {
        public string? Q { get; set; }
        public long? ConversationId { get; set; }  // ابحث داخل محادثة معيّنة (اختياري)

        public bool InMessages { get; set; } = true;
        public bool InFiles { get; set; } = true;
        public bool InLinks { get; set; } = true;

        [Range(1, int.MaxValue)]
        public int Page { get; set; } = 1;

        [Range(1, 200)]
        public int PageSize { get; set; } = 20;
    }

    public class ChatSearchItemVm
    {
        public long MessageId { get; set; }
        public long ConversationId { get; set; }
        public string ConversationTitle { get; set; } = "";
        public string SenderDisplay { get; set; } = "";
        public DateTime CreatedAtUtc { get; set; }

        // kind: "message" | "file" | "link"
        public string Kind { get; set; } = "message";

        // للنص/الروابط
        public string? Snippet { get; set; }

        // للملفات
        public string? FileUrl { get; set; }
        public string? FileName { get; set; }
        public string? FileType { get; set; }
        public long? FileSize { get; set; }
    }

    public class ChatSearchResponseVm
    {
        public int Total { get; set; }
        public List<ChatSearchItemVm> Items { get; set; } = new();
    }
}
