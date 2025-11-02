using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tawasul.Migrations
{
    /// <inheritdoc />
    public partial class AddInvitedByToConversationMembers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "InvitedByUserId",
                table: "ConversationMembers",
                type: "nvarchar(450)",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_ConversationMembers_InvitedByUserId",
                table: "ConversationMembers",
                column: "InvitedByUserId");

            migrationBuilder.AddForeignKey(
                name: "FK_ConversationMembers_AspNetUsers_InvitedByUserId",
                table: "ConversationMembers",
                column: "InvitedByUserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.NoAction);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ConversationMembers_AspNetUsers_InvitedByUserId",
                table: "ConversationMembers");

            migrationBuilder.DropIndex(
                name: "IX_ConversationMembers_InvitedByUserId",
                table: "ConversationMembers");

            migrationBuilder.DropColumn(
                name: "InvitedByUserId",
                table: "ConversationMembers");
        }
    }
}
