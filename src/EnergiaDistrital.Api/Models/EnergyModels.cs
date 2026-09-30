namespace EnergiaDistrital.Api.Models;

public enum MeterStatus
{
    Online,
    Offline,
    Maintenance
}

public enum AlertType
{
    HighConsumption,
    VoltageAnomaly,
    LowPowerFactor,
    MeterOffline
}

public enum AlertSeverity
{
    Info,
    Warning,
    Critical
}

public sealed record District(
    string Id,
    string Name,
    int Population,
    double AreaKm2);

public sealed record Zone(
    string Id,
    string DistrictId,
    string Name,
    string Sector,
    double TypicalDemandKw,
    string Color);

public sealed record Meter(
    string Id,
    string ZoneId,
    string SerialNumber,
    string Name,
    MeterStatus Status,
    DateTimeOffset InstalledAtUtc,
    double Latitude,
    double Longitude,
    double RatedPowerKw);

public sealed record EnergyReading(
    Guid Id,
    string MeterId,
    string ZoneId,
    DateTimeOffset TimestampUtc,
    double PowerKw,
    double EnergyKwh,
    double VoltageV,
    double CurrentA,
    double PowerFactor,
    double FrequencyHz);

public sealed record EnergyAlert(
    Guid Id,
    string MeterId,
    string ZoneId,
    AlertType Type,
    AlertSeverity Severity,
    string Message,
    double Value,
    double Threshold,
    DateTimeOffset CreatedAtUtc,
    bool IsActive,
    DateTimeOffset? ResolvedAtUtc);

public sealed record DashboardKpis(
    double CurrentDemandKw,
    double EnergyTodayKwh,
    double AverageVoltageV,
    double AveragePowerFactor,
    int ActiveMeters,
    int TotalMeters,
    int ActiveAlerts,
    double EstimatedCostToday,
    string Currency);

public sealed record ZoneSummary(
    string Id,
    string DistrictId,
    string Name,
    string Sector,
    string Color,
    int MeterCount,
    int ActiveMeters,
    double CurrentDemandKw,
    double EnergyTodayKwh,
    double ReferenceDemandKw,
    double LoadPercent,
    string EnergyStatus,
    double SharePercent,
    int ActiveAlerts);

public sealed record MeterSummary(
    string Id,
    string ZoneId,
    string ZoneName,
    string SerialNumber,
    string Name,
    MeterStatus Status,
    DateTimeOffset InstalledAtUtc,
    double Latitude,
    double Longitude,
    double RatedPowerKw,
    double? CurrentPowerKw,
    double? VoltageV,
    double? PowerFactor,
    DateTimeOffset? LastReadingUtc);

public sealed record DemandPoint(
    DateTimeOffset TimestampUtc,
    double PowerKw);

public sealed record DashboardResponse(
    District District,
    DateTimeOffset GeneratedAtUtc,
    DashboardKpis Kpis,
    IReadOnlyList<ZoneSummary> ConsumptionByZone,
    IReadOnlyList<DemandPoint> DemandTrend,
    IReadOnlyDictionary<string, IReadOnlyList<DemandPoint>> DemandTrendByZone,
    IReadOnlyList<EnergyAlert> RecentAlerts);

public sealed record MapViewport(
    double CenterLatitude,
    double CenterLongitude,
    double MinLatitude,
    double MinLongitude,
    double MaxLatitude,
    double MaxLongitude);

public sealed record MapZoneSummary(
    string Id,
    string Name,
    string Sector,
    string Color,
    double CenterLatitude,
    double CenterLongitude,
    double CurrentDemandKw,
    double ReferenceDemandKw,
    double LoadPercent,
    string EnergyStatus,
    int ActiveAlerts);

public sealed record MapMeterSummary(
    string Id,
    string Name,
    string ZoneId,
    string ZoneName,
    double Latitude,
    double Longitude,
    MeterStatus Status,
    double? CurrentPowerKw,
    double? VoltageV,
    double? PowerFactor,
    DateTimeOffset? LastReadingUtc,
    string HardwareModel,
    string FirmwareVersion);

public sealed record MapResponse(
    District District,
    DateTimeOffset GeneratedAtUtc,
    MapViewport Viewport,
    IReadOnlyList<MapZoneSummary> Zones,
    IReadOnlyList<MapMeterSummary> Meters,
    IReadOnlyList<InfrastructureFacility> Facilities);


public sealed record InfrastructureFacility(
    string Id,
    string ZoneId,
    string ZoneName,
    string Name,
    string Category,
    string Network,
    string Address,
    double Latitude,
    double Longitude,
    double RatedPowerKw,
    double CurrentDemandKw,
    double LoadPercent,
    string EnergyStatus,
    string ConnectionStatus,
    bool IsSimulated,
    string LocationNote);

public sealed record SimulationResult(
    DateTimeOffset TimestampUtc,
    int ReadingsGenerated,
    int AlertsCreated,
    int ActiveAlerts,
    double CurrentDemandKw);

public sealed record TinyMlFeatureVector(
    double LoadPercent,
    double VoltageV,
    double CurrentPercent,
    double PowerFactor,
    double FrequencyHz,
    double TemperatureC);

public sealed record TinyMlPrediction(
    string PredictedClass,
    double NormalProbability,
    double WarningProbability,
    double CriticalProbability);

public sealed record TinyMlClassMetric(
    string ClassName,
    double Precision,
    double Recall,
    double F1Score,
    int Support);

public sealed record TinyMlResourceStatus(
    string Label,
    string Value,
    string Status,
    string Note);

public sealed record TinyMlLabResponse(
    DateTimeOffset GeneratedAtUtc,
    string LabVersion,
    string ModelName,
    string OptimizationMode,
    string DeploymentMode,
    bool IsSyntheticValidation,
    string DataNote,
    int DatasetCount,
    int TrainingCount,
    int TestCount,
    int ExperimentalPayloadBytes,
    double ExperimentalPayloadKb,
    double Accuracy,
    double MacroPrecision,
    double MacroRecall,
    double MacroF1,
    IReadOnlyList<TinyMlClassMetric> PerClassMetrics,
    int[][] ConfusionMatrix,
    string SelectedZoneId,
    string SelectedZoneName,
    string RuleReferenceClass,
    TinyMlFeatureVector CurrentFeatures,
    TinyMlPrediction CurrentPrediction,
    double HostReferenceLatencyUs,
    IReadOnlyList<TinyMlResourceStatus> ResourceStatus);
