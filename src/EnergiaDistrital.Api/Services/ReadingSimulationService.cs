namespace EnergiaDistrital.Api.Services;

public sealed class ReadingSimulationService(
    EnergyRepository repository,
    IConfiguration configuration,
    ILogger<ReadingSimulationService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var configuredSeconds = configuration.GetValue("Simulation:IntervalSeconds", 5);
        var interval = TimeSpan.FromSeconds(Math.Clamp(configuredSeconds, 1, 300));

        logger.LogInformation("Simulador IoT iniciado. Intervalo: {IntervalSeconds} segundos.", interval.TotalSeconds);

        using var timer = new PeriodicTimer(interval);
        try
        {
            while (await timer.WaitForNextTickAsync(stoppingToken))
            {
                try
                {
                    var result = repository.SimulateTick(DateTimeOffset.UtcNow);
                    logger.LogDebug(
                        "Tick IoT: {ReadingsGenerated} lecturas, {ActiveAlerts} alertas activas.",
                        result.ReadingsGenerated,
                        result.ActiveAlerts);
                }
                catch (Exception exception)
                {
                    // Un fallo de una lectura simulada no debe detener ASP.NET Core ni dejar
                    // el dashboard sin API. La siguiente iteración vuelve a intentarlo.
                    logger.LogError(exception, "Error en un ciclo del simulador IoT; el servicio continuará activo.");
                }
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            logger.LogInformation("Simulador IoT detenido.");
        }
    }
}
