using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Tawasul.Models;
using Tawasul.Models.ViewModels;

[Authorize]
public class ManageController : Controller
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IWebHostEnvironment _webHostEnvironment; // لرفع الملفات

    public ManageController(UserManager<ApplicationUser> userManager, IWebHostEnvironment webHostEnvironment)
    {
        _userManager = userManager;
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
            CurrentPhotoUrl = user.PhotoUrl
        };
        return View(model);
    }

    // 2. حفظ التعديلات (POST)
    [HttpPost]
    public async Task<IActionResult> Index(ManageProfileViewModel model)
    {
        if (!ModelState.IsValid)
        {
            return View(model);
        }

        var user = await _userManager.GetUserAsync(User);
        if (user == null) return NotFound();

        // 1. تحديث الاسم
        user.DisplayName = model.DisplayName;

        // 2. تحديث الصورة (إذا تم رفع واحدة جديدة)
        if (model.NewPhoto != null)
        {
            // (يفضل حذف الصورة القديمة إذا موجودة)

            // حفظ الصورة الجديدة
            string uploadsFolder = Path.Combine(_webHostEnvironment.WebRootPath, "images/avatars");
            string uniqueFileName = Guid.NewGuid().ToString() + "_" + model.NewPhoto.FileName;
            string filePath = Path.Combine(uploadsFolder, uniqueFileName);

            using (var fileStream = new FileStream(filePath, FileMode.Create))
            {
                await model.NewPhoto.CopyToAsync(fileStream);
            }

            // تحديث رابط الصورة في الداتا بيس
            user.PhotoUrl = "/images/avatars/" + uniqueFileName;
        }

        // حفظ التغييرات
        var result = await _userManager.UpdateAsync(user);

        if (result.Succeeded)
        {
            // (يمكن إضافة رسالة نجاح)
            return RedirectToAction("Index");
        }

        return View(model);
    }
}