using System.Diagnostics;
using EnergiaDistrital.Api.Models;

namespace EnergiaDistrital.Api.Services;

/// <summary>
/// Laboratorio TinyML experimental para preparar la Seccion II del informe.
/// IMPORTANTE: este servicio NO representa todavia una inferencia ejecutada en ESP32-S3.
/// El modelo fue entrenado con un dataset sintetico reproducible derivado del comportamiento
/// del simulador y cuantizado experimentalmente en pesos INT8. Las mediciones de TFLite Micro,
/// SRAM, Flash, corriente y latencia en el dispositivo permanecen pendientes.
/// </summary>
public sealed class TinyMlLabService
{
    private readonly EnergyRepository _repository;

    private static readonly string[] FeatureNames =
    {
        "loadPercent", "voltageV", "currentPercent", "powerFactor", "frequencyHz", "temperatureC"
    };

    private static readonly string[] ClassNames = { "normal", "warning", "critical" };

    private static readonly float[] Mean = { 71.832279f, 223.752867f, 73.047119f, 0.924937877f, 59.998553f, 48.1288355f };
    private static readonly float[] Std = { 19.8446696f, 11.3084668f, 21.8385891f, 0.0523846481f, 0.10931146f, 11.4118409f };

    private static readonly QuantizedLayer[] Layers =
    {
        new QuantizedLayer(
            6, 12, 0.00822236737f,
            new sbyte[] { 59, 81, 66, 9, -70, -75, -98, 66, 25, 24, -94, 71, 17, -53, -57, -18, -14, 22, 14, -51, 19, -62, -13, -11, 45, 36, -23, 6, -4, -67, -9, -37, -40, 70, 38, 43, -97, -89, -32, -28, -6, 106, 32, 25, -68, 10, 0, -24, -3, -49, 87, 32, 38, 11, -7, 83, -27, -39, -44, -54, 67, 17, 86, -14, -66, -82, -127, 63, -44, 71, 11, -26 },
            new float[] { -0.666324749f, -0.102523623f, 0.544685773f, 0.911042903f, 0.633491469f, 0.022590025f, 0.227984091f, -0.430608658f, 1.01815197f, 0.651028647f, -0.254987922f, -0.387652167f }),
        new QuantizedLayer(
            12, 8, 0.00818229945f,
            new sbyte[] { -34, -25, 127, -50, 106, -44, -106, 110, 29, -1, 71, -21, -1, -18, -59, 9, -66, 7, 12, -5, 46, -20, 7, 94, -40, -62, -73, 27, 41, 90, 79, 103, 37, -45, 25, 60, 23, 92, 2, -24, 0, 0, 51, 121, -79, 51, -77, -105, -49, -21, 61, 48, -15, 80, -82, 11, 58, -40, 55, -58, -28, -57, -24, 43, -63, -37, 27, 10, -68, 21, 118, 15, 17, 26, -14, 46, -24, 23, 42, 63, -59, 36, -4, -58, -63, 2, 11, 1, -5, -47, 58, -45, 29, -24, 30, 9 },
            new float[] { -0.231416533f, -0.499313643f, 0.159386898f, 0.8729396f, -0.421840424f, 0.482350231f, 0.826099533f, 0.540322528f }),
        new QuantizedLayer(
            8, 3, 0.00961149641f,
            new sbyte[] { -1, -41, -57, 56, 56, 26, -19, -57, 51, 114, 69, -17, 12, -86, -14, 100, 8, -124, -85, 89, -125, -127, 46, 60 },
            new float[] { 0.128033729f, -0.0630751492f, 0.0573669947f })
    };

    private static readonly IReadOnlyList<TinyMlClassMetric> ValidationMetrics = new[]
    {
        new TinyMlClassMetric("normal", 0.996594778661, 0.994337485844, 0.995464852608, 883),
        new TinyMlClassMetric("warning", 0.984154929577, 0.991134751773, 0.987632508834, 564),
        new TinyMlClassMetric("critical", 0.994301994302, 0.988668555241, 0.991477272727, 353)
    };

    private static readonly int[][] ConfusionMatrix =
    {
        new[] { 878, 5, 0 },
        new[] { 3, 559, 2 },
        new[] { 0, 4, 349 }
    };

    public TinyMlLabService(EnergyRepository repository)
    {
        _repository = repository;
    }

    public TinyMlLabResponse GetSnapshot(string? zoneId, DateTimeOffset nowUtc)
    {
        var dashboard = _repository.GetDashboard(nowUtc);
        var zones = dashboard.ConsumptionByZone;
        var selected = !string.IsNullOrWhiteSpace(zoneId) && !zoneId.Equals("all", StringComparison.OrdinalIgnoreCase)
            ? zones.FirstOrDefault(zone => zone.Id.Equals(zoneId, StringComparison.OrdinalIgnoreCase))
            : zones.OrderByDescending(zone => zone.LoadPercent).FirstOrDefault();

        selected ??= zones.FirstOrDefault();

        var recent = _repository.GetReadings(500);
        var zoneReadings = selected is null
            ? Array.Empty<EnergyReading>()
            : recent.Where(reading => reading.ZoneId.Equals(selected.Id, StringComparison.OrdinalIgnoreCase))
                .OrderByDescending(reading => reading.TimestampUtc)
                .Take(4)
                .ToArray();

        var latest = zoneReadings.FirstOrDefault();
        var loadPercent = selected?.LoadPercent ?? 0;
        var voltage = latest?.VoltageV ?? dashboard.Kpis.AverageVoltageV;
        var powerFactor = latest?.PowerFactor ?? dashboard.Kpis.AveragePowerFactor;
        var frequency = latest?.FrequencyHz ?? 60d;
        var currentPercent = Math.Clamp(loadPercent * (0.96d + Math.Max(0, 0.96d - powerFactor) * 0.45d), 10d, 135d);
        var deterministicOffset = selected is null ? 0 : (selected.Id.Sum(character => (int)character) % 7) - 3;
        var temperature = Math.Clamp(30.5d + (loadPercent * 0.30d) + deterministicOffset, 24d, 86d);

        var features = new TinyMlFeatureVector(
            Round(loadPercent, 2),
            Round(voltage, 2),
            Round(currentPercent, 2),
            Round(powerFactor, 4),
            Round(frequency, 3),
            Round(temperature, 2));

        var stopwatch = Stopwatch.StartNew();
        TinyMlPrediction prediction = default!;
        const int hostBenchmarkIterations = 2000;
        for (var index = 0; index < hostBenchmarkIterations; index++)
        {
            prediction = Predict(features);
        }
        stopwatch.Stop();
        var hostAverageUs = stopwatch.Elapsed.TotalMilliseconds * 1000d / hostBenchmarkIterations;

        return new TinyMlLabResponse(
            nowUtc,
            "TinyML Lab V0.7",
            "MLP 6-12-8-3",
            "experimental-int8-weights",
            "backend-local-lab",
            true,
            "Dataset sintetico reproducible generado para laboratorio a partir de perfiles energeticos del simulador V0.6. No corresponde aun a telemetria fisica de las instalaciones.",
            9000,
            7200,
            1800,
            368,
            Round(368d / 1024d, 3),
            0.992222222222,
            0.991683900847,
            0.991380264286,
            0.991524878056,
            ValidationMetrics,
            ConfusionMatrix,
            selected?.Id ?? "all",
            selected?.Name ?? "Lima Centro",
            selected?.EnergyStatus ?? "normal",
            features,
            prediction,
            Round(hostAverageUs, 3),
            new[]
            {
                new TinyMlResourceStatus("Payload experimental INT8", $"{368d / 1024d:0.000} KB", "measured-lab", "Pesos INT8 + escalado + sesgos en formato binario experimental."),
                new TinyMlResourceStatus("Modelo TFLite Micro final", "Pendiente", "pending-device", "Se medira tras conversion full-integer y despliegue en ESP32-S3."),
                new TinyMlResourceStatus("Tensor Arena", "Pendiente", "pending-device", "Se ajustara al minimo estable durante la integracion de TFLite Micro."),
                new TinyMlResourceStatus("Flash ESP32-S3", "Pendiente", "pending-device", "Se obtendra con idf.py size / size-components."),
                new TinyMlResourceStatus("SRAM estatica/dinamica", "Pendiente", "pending-device", "Se medira con heap_caps y mapa de enlazado."),
                new TinyMlResourceStatus("Latencia ESP32-S3", "Pendiente", "pending-device", "La cifra host no sustituye la medicion con esp_timer_get_time()."),
                new TinyMlResourceStatus("Consumo de corriente", "Pendiente", "pending-device", "Se medira por estado: adquisicion, inferencia, Wi-Fi y sleep.")
            });
    }

    public TinyMlPrediction Predict(TinyMlFeatureVector vector)
    {
        var activations = new float[]
        {
            (float)vector.LoadPercent,
            (float)vector.VoltageV,
            (float)vector.CurrentPercent,
            (float)vector.PowerFactor,
            (float)vector.FrequencyHz,
            (float)vector.TemperatureC
        };

        for (var index = 0; index < activations.Length; index++)
        {
            activations[index] = (activations[index] - Mean[index]) / Std[index];
        }

        for (var layerIndex = 0; layerIndex < Layers.Length; layerIndex++)
        {
            var layer = Layers[layerIndex];
            var output = new float[layer.Cols];
            for (var column = 0; column < layer.Cols; column++)
            {
                var sum = layer.Biases[column];
                for (var row = 0; row < layer.Rows; row++)
                {
                    var weight = layer.Weights[(row * layer.Cols) + column] * layer.Scale;
                    sum += activations[row] * weight;
                }

                output[column] = layerIndex < Layers.Length - 1 ? MathF.Max(0f, sum) : sum;
            }
            activations = output;
        }

        var max = activations.Max();
        var exponentials = activations.Select(value => Math.Exp(value - max)).ToArray();
        var total = exponentials.Sum();
        var probabilities = exponentials.Select(value => value / total).ToArray();
        var predictedIndex = Array.IndexOf(probabilities, probabilities.Max());

        return new TinyMlPrediction(
            ClassNames[predictedIndex],
            Round(probabilities[0], 6),
            Round(probabilities[1], 6),
            Round(probabilities[2], 6));
    }

    private sealed record QuantizedLayer(int Rows, int Cols, float Scale, sbyte[] Weights, float[] Biases);

    private static double Round(double value, int digits = 2) =>
        Math.Round(value, digits, MidpointRounding.AwayFromZero);
}
