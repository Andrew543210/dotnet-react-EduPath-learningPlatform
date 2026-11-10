using Microsoft.EntityFrameworkCore;

namespace EduPath.Application.Common;

public sealed record PagedResult<T>(IReadOnlyList<T> Items, int Page, int PageSize, int TotalCount)
{
    public int TotalPages => PageSize == 0 ? 0 : (int)Math.Ceiling(TotalCount / (double)PageSize);
}

public static class PagingExtensions
{
    public const int MaxPageSize = 100;

    public static (int Page, int PageSize) Normalize(int? page, int? pageSize, int defaultSize = 12) =>
        (Math.Max(1, page ?? 1), Math.Clamp(pageSize ?? defaultSize, 1, MaxPageSize));

    public static async Task<PagedResult<T>> ToPagedAsync<T>(this IQueryable<T> query, int? page, int? pageSize,
        CancellationToken ct, int defaultSize = 12)
    {
        var (p, size) = Normalize(page, pageSize, defaultSize);
        var total = await query.CountAsync(ct);
        var items = await query.Skip((p - 1) * size).Take(size).ToListAsync(ct);
        return new PagedResult<T>(items, p, size, total);
    }
}
