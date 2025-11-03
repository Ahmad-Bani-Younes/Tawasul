namespace Tawasul.Models
{
    public class MessageAttachment
    {
        public long Id { get; set; }
        public long MessageId { get; set; }
        public Message Message { get; set; } = default!;

        // 🗂️ مسار الملف داخل wwwroot/uploads/chatfiles
        public string FilePath { get; set; } = default!;

        // 🎨 نوع المحتوى (image/png أو video/mp4 ...)
        public string ContentType { get; set; } = default!;

        // ⚖️ الحجم بالبايت
        public long SizeBytes { get; set; }

        // 🏷️ الاسم الأصلي للملف
        public string? OriginalName { get; set; }

        // 🆕 (اختياري) رابط مباشر للاستخدام في الواجهة
        public string FileUrl => FilePath.StartsWith("/")
            ? FilePath
            : $"/{FilePath.Replace("\\", "/")}";
    }
}
