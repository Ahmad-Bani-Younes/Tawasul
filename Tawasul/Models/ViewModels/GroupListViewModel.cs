namespace Tawasul.Models.ViewModels
{
    public class GroupListViewModel
    {
        public long Id { get; set; }
        public string? Title { get; set; }
        public string? CreatorName { get; set; }
        public int MembersCount { get; set; }
        public DateTime CreatedAtUtc { get; set; }
    }
}
