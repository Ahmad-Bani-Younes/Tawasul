using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Tawasul.Models;
using Tawasul.Models.ViewModels;

[Authorize]
public class ManageController : Controller
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly SignInManager<ApplicationUser> _signInManager;
    private readonly IWebHostEnvironment _webHostEnvironment;

    public ManageController(
        UserManager<ApplicationUser> userManager,
        SignInManager<ApplicationUser> signInManager,
        IWebHostEnvironment webHostEnvironment)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _webHostEnvironment = webHostEnvironment;
    }

    // 1. عرض الصفحة (GET)
    [HttpGet]
    public async Task<IActionResult> Index()
    {
        var user = await _userManager.GetUserAsync(User);
        if (user == null) return NotFound();

        var model = new ManageProfileViewModel
        {
            DisplayName = user.DisplayName ?? user.UserName,
            CurrentPhotoUrl = user.PhotoUrl,
            ShowOnlineStatus = user.ShowOnlineStatus,
            ShowLastSeen = user.ShowLastSeen,
            EnableNotifications = user.EnableNotifications,
            EnableSounds = user.EnableSounds
        };
        return View(model);
    }

    // 2. حفظ التعديلات (POST)
    [HttpPost]
    public async Task<IActionResult> Index(ManageProfileViewModel model, string? currentPassword, string? newPassword, string? confirmPassword)
    {
        var user = await _userManager.GetUserAsync(User);
        if (user == null) return NotFound();

        bool hasChanges = false;

        // 1. تحديث الاسم
        if (user.DisplayName != model.DisplayName)
        {
            user.DisplayName = model.DisplayName;
            hasChanges = true;
        }

        // 2. تحديث إعدادات الخصوصية
        if (user.ShowOnlineStatus != model.ShowOnlineStatus ||
            user.ShowLastSeen != model.ShowLastSeen ||
            user.EnableNotifications != model.EnableNotifications ||
            user.EnableSounds != model.EnableSounds)
        {
            user.ShowOnlineStatus = model.ShowOnlineStatus;
            user.ShowLastSeen = model.ShowLastSeen;
            user.EnableNotifications = model.EnableNotifications;
            user.EnableSounds = model.EnableSounds;
            hasChanges = true;
        }

        // 3. تحديث الصورة (إذا تم رفع واحدة جديدة)
        if (model.NewPhoto != null && model.NewPhoto.Length > 0)
        {
            // التحقق من نوع الملف
            var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".gif" };
            var extension = Path.GetExtension(model.NewPhoto.FileName).ToLowerInvariant();
            
            if (!allowedExtensions.Contains(extension))
            {
                ModelState.AddModelError("NewPhoto", "يرجى اختيار صورة بصيغة صحيحة (JPG, PNG, GIF)");
                return View(model);
            }

            // التحقق من حجم الملف (5 ميجا كحد أقصى)
            if (model.NewPhoto.Length > 5 * 1024 * 1024)
            {
                ModelState.AddModelError("NewPhoto", "حجم الصورة يجب أن لا يتجاوز 5 ميجابايت");
                return View(model);
            }

            // حذف الصورة القديمة إذا موجودة
            if (!string.IsNullOrEmpty(user.PhotoUrl) && !user.PhotoUrl.Contains("default-avatar"))
            {
                var oldImagePath = Path.Combine(_webHostEnvironment.WebRootPath, user.PhotoUrl.TrimStart('/'));
                if (System.IO.File.Exists(oldImagePath))
                {
                    try
                    {
                        System.IO.File.Delete(oldImagePath);
                    }
                    catch { /* تجاهل الخطأ إذا فشل الحذف */ }
                }
            }

            // حفظ الصورة الجديدة
            string uploadsFolder = Path.Combine(_webHostEnvironment.WebRootPath, "images", "avatars");
            Directory.CreateDirectory(uploadsFolder);
            
            string uniqueFileName = Guid.NewGuid().ToString() + extension;
            string filePath = Path.Combine(uploadsFolder, uniqueFileName);

            using (var fileStream = new FileStream(filePath, FileMode.Create))
            {
                await model.NewPhoto.CopyToAsync(fileStream);
            }

            user.PhotoUrl = "/images/avatars/" + uniqueFileName;
            hasChanges = true;
        }

        // 4. تغيير كلمة المرور (إذا تم إدخال كلمة مرور جديدة)
        if (!string.IsNullOrEmpty(newPassword))
        {
            if (string.IsNullOrEmpty(currentPassword))
            {
                ModelState.AddModelError("", "يرجى إدخال كلمة المرور الحالية");
                return View(model);
            }

            if (newPassword != confirmPassword)
            {
                ModelState.AddModelError("", "كلمة المرور الجديدة وتأكيدها غير متطابقين");
                return View(model);
            }

            var changePasswordResult = await _userManager.ChangePasswordAsync(user, currentPassword, newPassword);
            
            if (!changePasswordResult.Succeeded)
            {
                foreach (var error in changePasswordResult.Errors)
                {
                    ModelState.AddModelError("", error.Description);
                }
                return View(model);
            }

            hasChanges = true;
            
            // تسجيل دخول المستخدم مرة أخرى بعد تغيير كلمة المرور
            await _signInManager.RefreshSignInAsync(user);
        }

        // حفظ التغييرات
        if (hasChanges)
        {
            var result = await _userManager.UpdateAsync(user);

            if (result.Succeeded)
            {
                TempData["SuccessMessage"] = "✅ تم حفظ التغييرات بنجاح!";
                return RedirectToAction("Index");
            }
            else
            {
                foreach (var error in result.Errors)
                {
                    ModelState.AddModelError("", error.Description);
                }
            }
        }
        else
        {
            TempData["SuccessMessage"] = "ℹ️ لم يتم إجراء أي تغييرات";
            return RedirectToAction("Index");
        }

        return View(model);
    }
}