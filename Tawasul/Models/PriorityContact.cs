namespace Tawasul.Models
{
    public class PriorityContact
    {
        public string UserId { get; set; } = default!;
        public ApplicationUser User { get; set; } = default!;

        public string PriorityUserId { get; set; } = default!;
        public ApplicationUser PriorityUser { get; set; } = default!;
    }
}
