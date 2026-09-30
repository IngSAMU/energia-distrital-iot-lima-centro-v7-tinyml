using System.Text.Json;
using System.Text.Json.Serialization;
using EnergiaDistrital.Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    options.SerializerOptions.DictionaryKeyPolicy = JsonNamingPolicy.CamelCase;
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase));
});
builder.Services.AddSingleton<EnergyRepository>();
builder.Services.AddSingleton<TinyMlLabService>();
builder.Services.AddHostedService<ReadingSimulationService>();

// Mantiene el host disponible aunque una iteración aislada del simulador falle.
// ReadingSimulationService también captura sus propias excepciones y continúa.
builder.Services.Configure<HostOptions>(options =>
{
    options.BackgroundServiceExceptionBehavior = BackgroundServiceExceptionBehavior.Ignore;
});

var app = builder.Build();

// Evita que el navegador reutilice una versión antigua del dashboard cuando se cambia
// entre iteraciones locales que usan el mismo puerto localhost.
app.Use(async (context, next) =>
{
    context.Response.OnStarting(() =>
    {
        var path = context.Request.Path.Value ?? string.Empty;
        if (path == "/" ||
            path.EndsWith(".html", StringComparison.OrdinalIgnoreCase) ||
            path.EndsWith(".js", StringComparison.OrdinalIgnoreCase) ||
            path.EndsWith(".css", StringComparison.OrdinalIgnoreCase))
        {
            context.Response.Headers.CacheControl = "no-store, no-cache, must-revalidate, max-age=0";
            context.Response.Headers.Pragma = "no-cache";
            context.Response.Headers.Expires = "0";
        }
        return Task.CompletedTask;
    });

    await next();
});

app.UseDefaultFiles();
app.UseStaticFiles();

app.MapGet("/health", () => Results.Ok(new
{
    status = "healthy",
    service = "EnergiaDistrital.Api",
    version = "0.7.0",
    timestampUtc = DateTimeOffset.UtcNow
}));

app.MapGet("/api/health", () => Results.Ok(new
{
    status = "healthy",
    service = "EnergiaDistrital.Api",
    version = "0.7.0",
    timestampUtc = DateTimeOffset.UtcNow
}));

app.MapGet("/api/dashboard", (EnergyRepository repository) =>
    Results.Ok(repository.GetDashboard(DateTimeOffset.UtcNow)));

app.MapGet("/api/zones", (EnergyRepository repository) =>
    Results.Ok(repository.GetZones(DateTimeOffset.UtcNow)));

app.MapGet("/api/meters", (EnergyRepository repository) =>
    Results.Ok(repository.GetMeters()));

app.MapGet("/api/map", (EnergyRepository repository) =>
    Results.Ok(repository.GetMap(DateTimeOffset.UtcNow)));

app.MapGet("/api/infrastructure", (EnergyRepository repository) =>
    Results.Ok(repository.GetInfrastructure(DateTimeOffset.UtcNow)));

app.MapGet("/api/tinyml", (string? zoneId, TinyMlLabService tinyMl) =>
    Results.Ok(tinyMl.GetSnapshot(zoneId, DateTimeOffset.UtcNow)));


app.MapGet("/api/readings", (int? limit, EnergyRepository repository) =>
{
    var requestedLimit = limit ?? 50;
    return requestedLimit is < 1 or > 500
        ? Results.BadRequest(new { error = "El parametro 'limit' debe estar entre 1 y 500." })
        : Results.Ok(repository.GetReadings(requestedLimit));
});

app.MapGet("/api/alerts", (EnergyRepository repository) =>
    Results.Ok(repository.GetAlerts()));

app.MapPost("/api/simulator/tick", (EnergyRepository repository) =>
    Results.Ok(repository.SimulateTick(DateTimeOffset.UtcNow)));

app.MapFallbackToFile("index.html");

app.Run();

public partial class Program
{
}
