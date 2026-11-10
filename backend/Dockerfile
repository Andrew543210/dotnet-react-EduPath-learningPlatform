FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY Directory.Build.props Directory.Packages.props EduPath.sln ./
COPY src/EduPath.Domain/EduPath.Domain.csproj src/EduPath.Domain/
COPY src/EduPath.Application/EduPath.Application.csproj src/EduPath.Application/
COPY src/EduPath.Infrastructure/EduPath.Infrastructure.csproj src/EduPath.Infrastructure/
COPY src/EduPath.Api/EduPath.Api.csproj src/EduPath.Api/
RUN dotnet restore src/EduPath.Api/EduPath.Api.csproj

COPY src/ src/
RUN dotnet publish src/EduPath.Api/EduPath.Api.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app ./

RUN mkdir -p /app/App_Data/files && chown -R app:app /app/App_Data
USER app

ENV ASPNETCORE_URLS=http://+:8080 \
    ASPNETCORE_ENVIRONMENT=Production
EXPOSE 8080
VOLUME ["/app/App_Data"]

ENTRYPOINT ["dotnet", "EduPath.Api.dll"]
