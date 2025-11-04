using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tawasul.Migrations
{
    /// <inheritdoc />
    public partial class AddPrivacySettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "EnableNotifications",
                table: "AspNetUsers",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "EnableSounds",
                table: "AspNetUsers",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "ShowLastSeen",
                table: "AspNetUsers",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "ShowOnlineStatus",
                table: "AspNetUsers",
                type: "bit",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EnableNotifications",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "EnableSounds",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "ShowLastSeen",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "ShowOnlineStatus",
                table: "AspNetUsers");
        }
    }
}
