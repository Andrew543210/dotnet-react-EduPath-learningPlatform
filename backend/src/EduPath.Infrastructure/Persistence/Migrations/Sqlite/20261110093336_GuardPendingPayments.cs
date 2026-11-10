using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EduPath.Infrastructure.Persistence.Migrations.Sqlite
{
    public partial class GuardPendingPayments : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_Payments_PendingPerCourse",
                table: "Payments",
                columns: new[] { "UserId", "CourseId" },
                unique: true,
                filter: "\"Status\" = 'Pending'");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Payments_PendingPerCourse",
                table: "Payments");
        }
    }
}
