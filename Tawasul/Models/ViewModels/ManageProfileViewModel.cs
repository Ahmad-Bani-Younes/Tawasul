using System.ComponentModel.DataAnnotations;

namespace Tawasul.Models.ViewModels
{
    public class ManageProfileViewModel
    {
        [Display(Name = "الاسم الظاهر")]
        [Required(ErrorMessage = "الاسم مطلوب")]
        [StringLength(150)]
        public string? DisplayName { get; set; }

        // هذا لعرض الصورة الحالية
        public string? CurrentPhotoUrl { get; set; }

        // هذا لاستقبال الصورة الجديدة
        [Display(Name = "الصورة الرمزية")]
        public IFormFile? NewPhoto { get; set; }
    }
}