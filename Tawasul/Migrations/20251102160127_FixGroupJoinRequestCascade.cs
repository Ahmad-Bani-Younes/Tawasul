using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tawasul.Migrations
{
    /// <inheritdoc />
    public partial class FixGroupJoinRequestCascade : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_tc.GroupJoinRequests_AspNetUsers_TargetUserId",
                table: "tc.GroupJoinRequests");

            migrationBuilder.AddForeignKey(
                name: "FK_tc.GroupJoinRequests_AspNetUsers_TargetUserId",
                table: "tc.GroupJoinRequests",
                column: "TargetUserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_tc.GroupJoinRequests_AspNetUsers_TargetUserId",
                table: "tc.GroupJoinRequests");

            migrationBuilder.AddForeignKey(
                name: "FK_tc.GroupJoinRequests_AspNetUsers_TargetUserId",
                table: "tc.GroupJoinRequests",
                column: "TargetUserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
