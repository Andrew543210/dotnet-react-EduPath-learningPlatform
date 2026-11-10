using EduPath.Domain.Common;

namespace EduPath.Domain.Courses;

public enum TrailColor
{
    Blue,
    Red,
    Green,
    Yellow,
}

public class Category : Entity
{
    private readonly List<Course> _courses = [];

    private Category() { }

    public string Name { get; private set; } = "";
    public string Slug { get; private set; } = "";
    public string Description { get; private set; } = "";
    public TrailColor Trail { get; private set; }

    public IReadOnlyCollection<Course> Courses => _courses;

    public static Category Create(string name, string slug, string? description, TrailColor trail)
    {
        var category = new Category();
        category.Update(name, slug, description, trail);
        return category;
    }

    public void Update(string name, string slug, string? description, TrailColor trail)
    {
        Name = Guard.NotEmpty(name, "Вкажіть назву категорії", 80);
        Slug = Guard.NotEmpty(slug, "Вкажіть slug категорії", 80).ToLowerInvariant();
        Description = description?.Trim() ?? "";
        Trail = trail;
    }

    public IEnumerable<Course> GetCourses() => _courses.Where(c => c.IsAvailable());
}
