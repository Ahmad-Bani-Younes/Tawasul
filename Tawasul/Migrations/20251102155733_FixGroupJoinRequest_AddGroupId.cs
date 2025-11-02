using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tawasul.Migrations
{
    /// <inheritdoc />
    public partial class FixGroupJoinRequest_AddGroupId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "TargetUserId",
                table: "tc.GroupJoinRequests",
                type: "nvarchar(450)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AlterColumn<string>(
                name: "RequestedByUserId",
                table: "tc.GroupJoinRequests",
                type: "nvarchar(450)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AddColumn<long>(
                name: "GroupId",
                table: "tc.GroupJoinRequests",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.CreateIndex(
                name: "IX_tc.GroupJoinRequests_RequestedByUserId",
                table: "tc.GroupJoinRequests",
                column: "RequestedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_tc.GroupJoinRequests_TargetUserId",
                table: "tc.GroupJoinRequests",
                column: "TargetUserId");

            migrationBuilder.AddForeignKey(
                name: "FK_tc.GroupJoinRequests_AspNetUsers_RequestedByUserId",
                table: "tc.GroupJoinRequests",
                column: "RequestedByUserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
      name: "FK_tc.GroupJoinRequests_AspNetUsers_TargetUserId",
      table: "tc.GroupJoinRequests",
      column: "TargetUserId",
      principalTable: "AspNetUsers",
      principalColumn: "Id",
      onDelete: ReferentialAction.NoAction); // ⬅️ ⬅️ هذا هو الحل
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_tc.GroupJoinRequests_AspNetUsers_RequestedByUserId",
                table: "tc.GroupJoinRequests");

            migrationBuilder.DropForeignKey(
                name: "FK_tc.GroupJoinRequests_AspNetUsers_TargetUserId",
                table: "tc.GroupJoinRequests");

            migrationBuilder.DropIndex(
                name: "IX_tc.GroupJoinRequests_RequestedByUserId",
                table: "tc.GroupJoinRequests");

            migrationBuilder.DropIndex(
                name: "IX_tc.GroupJoinRequests_TargetUserId",
                table: "tc.GroupJoinRequests");

            migrationBuilder.DropColumn(
                name: "GroupId",
                table: "tc.GroupJoinRequests");

            migrationBuilder.AlterColumn<string>(
                name: "TargetUserId",
                table: "tc.GroupJoinRequests",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(450)");

            migrationBuilder.AlterColumn<string>(
                name: "RequestedByUserId",
                table: "tc.GroupJoinRequests",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(450)");
        }
    }
}
