using Microsoft.AspNetCore.Identity;

namespace Tawasul.Models
{
    public class ApplicationUser : IdentityUser
    {
        public string? DisplayName { get; set; }
        public string? PhotoUrl { get; set; }
        public DateTimeOffset? LastSeenAt { get; set; }
        public bool IsOnline { get; set; } = false;

        // إعدادات الخصوصية
        public bool ShowOnlineStatus { get; set; } = true;
        public bool ShowLastSeen { get; set; } = true;
        public bool EnableNotifications { get; set; } = true;
        public bool EnableSounds { get; set; } = true;

        public bool ShowEmailToOthers { get; set; } = false;
        public bool ShowPhoneToOthers { get; set; } = false;

        public ICollection<ConversationMember> Conversations { get; set; } = new List<ConversationMember>();
        public ICollection<Message> Messages { get; set; } = new List<Message>();
    }
}
