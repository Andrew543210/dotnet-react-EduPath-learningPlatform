using EduPath.Api.Infrastructure;
using EduPath.Application.Administration;
using EduPath.Application.Authentication;
using EduPath.Application.Common;
using EduPath.Application.Courses;
using EduPath.Application.Notifications;
using EduPath.Application.Reviews;
using EduPath.Application.Teaching;
using EduPath.Domain.Courses;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EduPath.Api.Controllers;

[ApiController]
[Authorize(Roles = Roles.TeacherOrAdmin)]
[Route("api/teach")]
public sealed class TeachController(
    CourseAuthoringService authoring,
    TeachingAnalyticsService analytics,
    NotificationService notifications) : ControllerBase
{
    [HttpGet("overview")]
    public Task<TeacherOverviewDto> Overview(CancellationToken ct) => analytics.GetOverviewAsync(ct);

    [HttpGet("courses")]
    public Task<IReadOnlyList<CourseCardDto>> Courses(CancellationToken ct) => authoring.GetMyCoursesAsync(ct);

    [HttpPost("courses")]
    public async Task<ActionResult<CourseEditorDto>> Create(UpsertCourseRequest request, CancellationToken ct)
    {
        var course = await authoring.CreateCourseAsync(request, ct);
        return CreatedAtAction(nameof(Course), new { id = course.Id }, course);
    }

    [HttpGet("courses/{id:int}")]
    public Task<CourseEditorDto> Course(int id, CancellationToken ct) => authoring.GetEditorAsync(id, ct);

    [HttpPut("courses/{id:int}")]
    public Task<CourseEditorDto> Update(int id, UpsertCourseRequest request, CancellationToken ct) =>
        authoring.UpdateCourseAsync(id, request, ct);

    [HttpDelete("courses/{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        await authoring.DeleteCourseAsync(id, ct);
        return NoContent();
    }

    [HttpPost("courses/{id:int}/archive")]
    public Task<CourseEditorDto> Archive(int id, CancellationToken ct) => authoring.ArchiveCourseAsync(id, ct);

    [HttpPost("courses/{id:int}/submit")]
    public Task<CourseEditorDto> Submit(int id, CancellationToken ct) => authoring.SubmitForReviewAsync(id, ct);

    [HttpGet("courses/{id:int}/students")]
    public Task<CourseStudentsDto> Students(int id, CancellationToken ct) => analytics.GetCourseStudentsAsync(id, ct);

    [HttpPost("courses/{id:int}/notify")]
    public async Task<SentDto> Notify(int id, CourseMessageRequest request, CancellationToken ct) =>
        new(await notifications.SendToCourseStudentsAsync(id, request.Message, ct));

    [HttpPost("courses/{id:int}/lessons")]
    public Task<CourseEditorDto> AddLesson(int id, UpsertLessonRequest request, CancellationToken ct) =>
        authoring.AddLessonAsync(id, request, ct);

    [HttpPut("lessons/{id:int}")]
    public Task<CourseEditorDto> UpdateLesson(int id, UpsertLessonRequest request, CancellationToken ct) =>
        authoring.UpdateLessonAsync(id, request, ct);

    [HttpPost("lessons/{id:int}/move")]
    public Task<CourseEditorDto> MoveLesson(int id, MoveLessonRequest request, CancellationToken ct) =>
        authoring.MoveLessonAsync(id, request, ct);

    [HttpDelete("lessons/{id:int}")]
    public Task<CourseEditorDto> DeleteLesson(int id, CancellationToken ct) => authoring.DeleteLessonAsync(id, ct);

    [HttpPost("lessons/{id:int}/material")]
    [RequestSizeLimit(CourseAuthoringService.MaxMaterialBytes + 1024 * 1024)]
    public async Task<CourseEditorDto> UploadMaterial(int id, IFormFile file, CancellationToken ct)
    {
        await using var stream = file.OpenReadStream();
        return await authoring.UploadMaterialAsync(id, file.FileName, stream, file.Length, ct);
    }

    [HttpDelete("lessons/{id:int}/material")]
    public Task<CourseEditorDto> RemoveMaterial(int id, CancellationToken ct) => authoring.RemoveMaterialAsync(id, ct);

    [HttpPost("lessons/{id:int}/tests")]
    public Task<CourseEditorDto> CreateTest(int id, UpsertTestRequest request, CancellationToken ct) =>
        authoring.CreateTestAsync(id, request, ct);

    [HttpPut("tests/{id:int}")]
    public Task<CourseEditorDto> UpdateTest(int id, UpsertTestRequest request, CancellationToken ct) =>
        authoring.UpdateTestAsync(id, request, ct);

    [HttpDelete("tests/{id:int}")]
    public Task<CourseEditorDto> DeleteTest(int id, CancellationToken ct) => authoring.DeleteTestAsync(id, ct);
}

[ApiController]
[Authorize(Roles = Roles.Admin)]
[Route("api/admin")]
public sealed class AdminController(AdminService admin, ReviewService reviews, NotificationService notifications) : ControllerBase
{
    [HttpGet("overview")]
    public Task<AdminOverviewDto> Overview(CancellationToken ct) => admin.GetOverviewAsync(ct);

    [HttpGet("users")]
    public Task<PagedResult<AdminUserDto>> Users([FromQuery] UserQuery query, CancellationToken ct) => admin.GetUsersAsync(query, ct);

    [HttpPut("users/{id:int}/role")]
    public Task<UserDto> ChangeRole(int id, ChangeRoleRequest request, CancellationToken ct) => admin.ChangeRoleAsync(id, request.Role, ct);

    [HttpPut("users/{id:int}/block")]
    public Task<UserDto> Block(int id, BlockUserRequest request, CancellationToken ct) => admin.SetBlockedAsync(id, request.Blocked, ct);

    [HttpGet("moderation")]
    public Task<IReadOnlyList<ModerationItemDto>> Moderation([FromQuery] CourseStatus? status, CancellationToken ct) =>
        admin.GetModerationQueueAsync(status, ct);

    [HttpPost("moderation/{id:int}/approve")]
    public async Task<IActionResult> Approve(int id, CancellationToken ct)
    {
        await admin.ApproveAsync(id, ct);
        return NoContent();
    }

    [HttpPost("moderation/{id:int}/reject")]
    public async Task<IActionResult> Reject(int id, ModerationRequest request, CancellationToken ct)
    {
        await admin.RejectAsync(id, request.Comment, ct);
        return NoContent();
    }

    [HttpPost("categories")]
    public Task<CategoryDto> CreateCategory(UpsertCategoryRequest request, CancellationToken ct) => admin.UpsertCategoryAsync(null, request, ct);

    [HttpPut("categories/{id:int}")]
    public Task<CategoryDto> UpdateCategory(int id, UpsertCategoryRequest request, CancellationToken ct) =>
        admin.UpsertCategoryAsync(id, request, ct);

    [HttpDelete("categories/{id:int}")]
    public async Task<IActionResult> DeleteCategory(int id, CancellationToken ct)
    {
        await admin.DeleteCategoryAsync(id, ct);
        return NoContent();
    }

    [HttpGet("settings")]
    public Task<SettingsDto> Settings(CancellationToken ct) => admin.GetSettingsAsync(ct);

    [HttpPut("settings")]
    public Task<SettingsDto> UpdateSettings(SettingsDto request, CancellationToken ct) => admin.UpdateSettingsAsync(request, ct);

    [HttpPost("broadcast")]
    public async Task<SentDto> Broadcast(SendNotificationRequest request, CancellationToken ct) =>
        new(await notifications.BroadcastAsync(request, ct));

    [HttpGet("reviews")]
    public Task<PagedResult<AdminReviewDto>> Reviews([FromQuery] int? page, [FromQuery] int? pageSize, CancellationToken ct) =>
        reviews.GetRecentAsync(page, pageSize, ct);

    [HttpDelete("reviews/{id:int}")]
    public async Task<IActionResult> DeleteReview(int id, CancellationToken ct)
    {
        await reviews.DeleteAsync(id, ct);
        return NoContent();
    }
}

public sealed record CourseMessageRequest(string Message);

public sealed record SentDto(int Recipients);
