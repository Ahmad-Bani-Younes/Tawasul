namespace Tawasul.Models.ViewModels
{
    public class GroupMemberViewModel
    {
        public string UserId { get; set; } = default!;
        public string DisplayName { get; set; } = default!;
        public string JoinedAt { get; set; } = default!;
        public bool IsOwner { get; set; }

        public DateTime? MutedUntilUtc { get; set; }

    }
}
