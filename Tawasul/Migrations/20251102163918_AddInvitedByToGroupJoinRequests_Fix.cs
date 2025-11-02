using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tawasul.Migrations
{
    /// <inheritdoc />
    public partial class AddInvitedByToGroupJoinRequests_Fix : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_tc.GroupJoinRequests_AspNetUsers_RequestedByUserId",
                table: "tc.GroupJoinRequests");

            migrationBuilder.AddColumn<string>(
                name: "InvitedByUserId",
                table: "tc.GroupJoinRequests",
                type: "nvarchar(450)",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_tc.GroupJoinRequests_InvitedByUserId",
                table: "tc.GroupJoinRequests",
                column: "InvitedByUserId");

            migrationBuilder.AddForeignKey(
                name: "FK_tc.GroupJoinRequests_AspNetUsers_InvitedByUserId",
                table: "tc.GroupJoinRequests",
                column: "InvitedByUserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_tc.GroupJoinRequests_AspNetUsers_RequestedByUserId",
                table: "tc.GroupJoinRequests",
                column: "RequestedByUserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_tc.GroupJoinRequests_AspNetUsers_InvitedByUserId",
                table: "tc.GroupJoinRequests");

            migrationBuilder.DropForeignKey(
                name: "FK_tc.GroupJoinRequests_AspNetUsers_RequestedByUserId",
                table: "tc.GroupJoinRequests");

            migrationBuilder.DropIndex(
                name: "IX_tc.GroupJoinRequests_InvitedByUserId",
                table: "tc.GroupJoinRequests");

            migrationBuilder.DropColumn(
                name: "InvitedByUserId",
                table: "tc.GroupJoinRequests");

            migrationBuilder.AddForeignKey(
                name: "FK_tc.GroupJoinRequests_AspNetUsers_RequestedByUserId",
                table: "tc.GroupJoinRequests",
                column: "RequestedByUserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
