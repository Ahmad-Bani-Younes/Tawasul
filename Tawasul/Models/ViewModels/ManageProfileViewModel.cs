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

        // إعدادات الخصوصية
        [Display(Name = "إظهار حالة الاتصال")]
        public bool ShowOnlineStatus { get; set; }

        [Display(Name = "إظهار آخر ظهور")]
        public bool ShowLastSeen { get; set; }

        [Display(Name = "تفعيل الإشعارات")]
        public bool EnableNotifications { get; set; }

        [Display(Name = "تفعيل الأصوات")]
        public bool EnableSounds { get; set; }
    }
}