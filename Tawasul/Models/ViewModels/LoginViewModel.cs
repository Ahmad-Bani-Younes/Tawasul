using System.ComponentModel.DataAnnotations;

namespace Tawasul.Models.ViewModels
{
    public class LoginViewModel
    {
        [Required, EmailAddress]
        public string? Email { get; set; }

        [Required, DataType(DataType.Password)]
        public string? Password { get; set; }
    }
}
