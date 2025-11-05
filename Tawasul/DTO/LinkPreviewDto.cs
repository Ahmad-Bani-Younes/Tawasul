namespace Tawasul.DTO
{
    public sealed class LinkPreviewDto
    {
        public string Url { get; set; } = "";
        public string Domain { get; set; } = "";
        public string? Title { get; set; }
        public string? Description { get; set; }
        public string? Image { get; set; }
        public string? Favicon { get; set; }
        public bool Safe { get; set; } = true;
        public string Risk { get; set; } = "safe"; // safe|warn|dang
        public List<string> Reasons { get; set; } = new();
    }

}
