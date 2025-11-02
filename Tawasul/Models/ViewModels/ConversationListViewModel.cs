namespace Tawasul.Models.ViewModels
{
    public class ConversationListViewModel
    {
        public long ConversationId { get; set; }
        public string DisplayTitle { get; set; } = string.Empty;
        public string? LastMessage { get; set; }
        public DateTime? LastMessageTime { get; set; }
        public int UnreadCount { get; set; }

        public string? PhotoUrl { get; set; }

        public bool IsOnline { get; set; }
        public DateTime? LastSeenAt { get; set; }

        public string Type { get; set; } = "Chat"; // أو "Group"


    }
}
