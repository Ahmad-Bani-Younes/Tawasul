namespace Tawasul.Models.ViewModels
{
    public class GroupDetailsViewModel
    {
        public long Id { get; set; }
        public string Title { get; set; } = "";
        public string CreatorId { get; set; } = "";
        public string CreatorName { get; set; } = "";
        public DateTime CreatedAtUtc { get; set; }

        public bool IsOwner { get; set; }
        public bool IsAdmin { get; set; }

        public List<GroupMemberItem> Members { get; set; } = new();
        public string CurrentUserId { get; set; } = default!;

    }

    public class GroupMemberItem
    {
        public string UserId { get; set; } = default!;
        public string DisplayName { get; set; } = default!;
        public string? PhotoUrl { get; set; }
        public bool IsOwner { get; set; }
        public bool IsAdmin { get; set; }
        public bool IsMuted { get; set; }
        public DateTime? MutedUntilUtc { get; set; }
        public DateTime JoinedAtUtc { get; set; }
        public string? InvitedByName { get; set; }

    }
}
