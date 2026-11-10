# Шпаргалка: CancellationToken

1. Приймайте `CancellationToken ct` останнім параметром публічного асинхронного методу.
2. Передавайте `ct` у кожен асинхронний виклик: EF Core, `HttpClient`, `Task.Delay`, `Channel.Reader.ReadAsync`.
3. Тайм-аут поверх токена запиту:

   ```csharp
   using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
   cts.CancelAfter(TimeSpan.FromSeconds(5));
   await client.GetAsync(url, cts.Token);
   ```

4. Не перехоплюйте `OperationCanceledException` без потреби: скасування — не помилка.
5. У циклах обчислень викликайте `ct.ThrowIfCancellationRequested()` між ітераціями.
6. Не передавайте `CancellationToken.None` «про всяк випадок» — так скасування губиться на півдорозі.
