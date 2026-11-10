using EduPath.Domain.Assessment;
using EduPath.Domain.Common;

namespace EduPath.Domain.Settings;

public class SystemSettings
{
    public const int SingletonId = 1;

    public int Id { get; private set; } = SingletonId;
    public string PlatformName { get; private set; } = "EduPath";
    public string SupportEmail { get; private set; } = "support@edupath.dev";
    public int DefaultPassingScore { get; private set; } = Test.DefaultPassingScore;
    public bool AllowTeacherRegistration { get; private set; } = true;
    public bool RequireCourseModeration { get; private set; } = true;

    public void Update(string platformName, string supportEmail, int defaultPassingScore, bool allowTeacherRegistration,
        bool requireCourseModeration)
    {
        PlatformName = Guard.NotEmpty(platformName, "Вкажіть назву платформи", 60);
        SupportEmail = Users.User.NormalizeEmail(supportEmail);
        DefaultPassingScore = Guard.InRange(defaultPassingScore, 1, 100, "Поріг має бути від 1 до 100 %");
        AllowTeacherRegistration = allowTeacherRegistration;
        RequireCourseModeration = requireCourseModeration;
    }
}
