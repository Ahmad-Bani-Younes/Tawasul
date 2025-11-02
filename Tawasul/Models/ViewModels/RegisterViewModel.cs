using System.ComponentModel.DataAnnotations;

namespace Tawasul.Models.ViewModels
{
    public class RegisterViewModel
    {
        [Required, EmailAddress]
        public string? Email { get; set; }

        [Required]
        public string? DisplayName { get; set; }

        [Required, DataType(DataType.Password)]
        public string? Password { get; set; }
    }
}
