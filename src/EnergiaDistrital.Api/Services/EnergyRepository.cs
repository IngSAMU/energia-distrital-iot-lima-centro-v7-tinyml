using EnergiaDistrital.Api.Models;

namespace EnergiaDistrital.Api.Services;

public sealed class EnergyRepository
{
    private const int MaximumReadings = 25_000;
    private const int MaximumAlerts = 500;
    private const double EnergyPricePenPerKwh = 0.68;
    private const double MapPaddingRatio = 0.1;
    private const double MinimumMapPaddingDegrees = 0.002;
    private const string HardwareModel = "ESP32-S3 + ATM90E32";
    private const string FirmwareVersion = "0.7.0-sim";
    private const double WarningLoadPercent = 70;
    private const double CriticalLoadPercent = 90;
    private static readonly TimeSpan LimaOffset = TimeSpan.FromHours(-5);
    private static readonly IReadOnlyDictionary<string, double> ZoneLoadMultipliers =
        new Dictionary<string, double>(StringComparer.OrdinalIgnoreCase)
        {
            ["distrito-lima"] = 1.35,
            ["distrito-barranco"] = 0.95,
            ["distrito-brena"] = 1.03,
            ["distrito-jesus-maria"] = 0.98,
            ["distrito-la-victoria"] = 1.55,
            ["distrito-lince"] = 1.05,
            ["distrito-magdalena"] = 0.92,
            ["distrito-miraflores"] = 1.18,
            ["distrito-pueblo-libre"] = 0.90,
            ["distrito-rimac"] = 1.08,
            ["distrito-san-borja"] = 0.96,
            ["distrito-san-isidro"] = 1.30,
            ["distrito-san-miguel"] = 0.88,
            ["distrito-surco"] = 1.12,
            ["distrito-surquillo"] = 1.06
        };

    private readonly object _gate = new();
    private readonly Random _random = new(20260831);
    private readonly District _district;
    private readonly Dictionary<string, Zone> _zones;
    private readonly Dictionary<string, Meter> _meters;
    private readonly List<FacilitySeed> _facilities;
    private readonly List<EnergyReading> _readings = [];
    private readonly List<EnergyAlert> _alerts = [];

    public EnergyRepository()
    {
        // Lima Centro se modela como el ámbito territorial principal.
        // Cada "Zone" representa un distrito para mantener compatibilidad con la API existente.
        _district = new District("lima-centro", "Lima Centro", 0, 0);

        _zones = new[]
        {
            new Zone("distrito-lima", _district.Id, "Lima (Cercado)", "Lima Centro", 520, "#2563eb"),
            new Zone("distrito-barranco", _district.Id, "Barranco", "Lima Centro", 250, "#0f766e"),
            new Zone("distrito-brena", _district.Id, "Breña", "Lima Centro", 280, "#7c3aed"),
            new Zone("distrito-jesus-maria", _district.Id, "Jesús María", "Lima Centro", 310, "#d97706"),
            new Zone("distrito-la-victoria", _district.Id, "La Victoria", "Lima Centro", 470, "#dc2626"),
            new Zone("distrito-lince", _district.Id, "Lince", "Lima Centro", 300, "#0891b2"),
            new Zone("distrito-magdalena", _district.Id, "Magdalena del Mar", "Lima Centro", 295, "#4f46e5"),
            new Zone("distrito-miraflores", _district.Id, "Miraflores", "Lima Centro", 430, "#059669"),
            new Zone("distrito-pueblo-libre", _district.Id, "Pueblo Libre", "Lima Centro", 275, "#9333ea"),
            new Zone("distrito-rimac", _district.Id, "Rímac", "Lima Centro", 350, "#ea580c"),
            new Zone("distrito-san-borja", _district.Id, "San Borja", "Lima Centro", 390, "#16a34a"),
            new Zone("distrito-san-isidro", _district.Id, "San Isidro", "Lima Centro", 460, "#0284c7"),
            new Zone("distrito-san-miguel", _district.Id, "San Miguel", "Lima Centro", 360, "#be123c"),
            new Zone("distrito-surco", _district.Id, "Santiago de Surco", "Lima Centro", 500, "#6d28d9"),
            new Zone("distrito-surquillo", _district.Id, "Surquillo", "Lima Centro", 330, "#b45309")
        }.ToDictionary(zone => zone.Id, StringComparer.OrdinalIgnoreCase);

        var installedAt = DateTimeOffset.UtcNow.AddYears(-2);
        _meters = new[]
        {
            CreateMeter("MTR-LIM-001", "distrito-lima", "Nodo IoT Cercado de Lima", -12.055245, -77.034670, 560, installedAt),
            CreateMeter("MTR-BAR-001", "distrito-barranco", "Nodo IoT Barranco", -12.148613, -77.020823, 290, installedAt.AddDays(12)),
            CreateMeter("MTR-BRE-001", "distrito-brena", "Nodo IoT Breña", -12.064976, -77.046985, 320, installedAt.AddDays(20)),
            CreateMeter("MTR-JMA-001", "distrito-jesus-maria", "Nodo IoT Jesús María", -12.085515, -77.050507, 350, installedAt.AddDays(28)),
            CreateMeter("MTR-LVI-001", "distrito-la-victoria", "Nodo IoT La Victoria", -12.069091, -77.021354, 510, installedAt.AddDays(36)),
            CreateMeter("MTR-LIN-001", "distrito-lince", "Nodo IoT Lince", -12.085694, -77.034694, 340, installedAt.AddDays(44)),
            CreateMeter("MTR-MAG-001", "distrito-magdalena", "Nodo IoT Magdalena", -12.092376, -77.070734, 335, installedAt.AddDays(52)),
            CreateMeter("MTR-MIR-001", "distrito-miraflores", "Nodo IoT Miraflores", -12.120293, -77.028462, 470, installedAt.AddDays(60)),
            CreateMeter("MTR-PUL-001", "distrito-pueblo-libre", "Nodo IoT Pueblo Libre", -12.072200, -77.059816, 315, installedAt.AddDays(68)),
            CreateMeter("MTR-RIM-001", "distrito-rimac", "Nodo IoT Rímac", -12.037017, -77.035127, 390, installedAt.AddDays(76)),
            CreateMeter("MTR-SBO-001", "distrito-san-borja", "Nodo IoT San Borja", -12.094105, -77.005077, 430, installedAt.AddDays(84)),
            CreateMeter("MTR-SIS-001", "distrito-san-isidro", "Nodo IoT San Isidro", -12.097116, -77.030010, 500, installedAt.AddDays(92)),
            CreateMeter("MTR-SMI-001", "distrito-san-miguel", "Nodo IoT San Miguel", -12.075837, -77.088351, 400, installedAt.AddDays(100), MeterStatus.Maintenance),
            CreateMeter("MTR-SUR-001", "distrito-surco", "Nodo IoT Santiago de Surco", -12.106936, -76.975279, 540, installedAt.AddDays(108)),
            CreateMeter("MTR-SQU-001", "distrito-surquillo", "Nodo IoT Surquillo", -12.113662, -77.005758, 370, installedAt.AddDays(116))
        }.ToDictionary(meter => meter.Id, StringComparer.OrdinalIgnoreCase);

        _facilities = new[]
        {
            CreateFacilitySeed("FAC-001", "distrito-lima", "Hospital Nacional Dos de Mayo", "minsa", "MINSA", "Parque Historia de la Medicina Peruana s/n, altura cdra. 13 Av. Grau, Cercado de Lima", -12.05587000, -77.01543000, 1650),
            CreateFacilitySeed("FAC-002", "distrito-lima", "Hospital Nacional Arzobispo Loayza", "minsa", "MINSA", "Av. Alfonso Ugarte 848, Cercado de Lima", -12.04955000, -77.04462000, 1800),
            CreateFacilitySeed("FAC-003", "distrito-lima", "Hospital Nacional Docente Madre Niño San Bartolomé", "minsa", "MINSA", "Av. Alfonso Ugarte 825, Cercado de Lima", -12.04977000, -77.04181000, 1200),
            CreateFacilitySeed("FAC-004", "distrito-lima", "Hospital de Emergencias Grau", "essalud", "EsSalud", "Av. Miguel Grau 351, Cercado de Lima", -12.05895710, -77.03127790, 1450),
            CreateFacilitySeed("FAC-005", "distrito-lima", "Clínica Internacional - Sede Lima", "clinic", "Clínica Internacional", "Av. Garcilaso de la Vega 1420, Cercado de Lima", -12.05834460, -77.03827910, 820),
            CreateFacilitySeed("FAC-006", "distrito-lima", "Clínica Maison de Santé - Sede Lima", "clinic", "Maison de Santé", "Jr. Miguel Aljovín 222, Cercado de Lima", -12.05744600, -77.03394400, 720),
            CreateFacilitySeed("FAC-007", "distrito-lima", "Real Plaza Centro Cívico", "mall", "Centro comercial", "Av. Garcilaso de la Vega 1337, Cercado de Lima", -12.05678000, -77.03733000, 2200),
            CreateFacilitySeed("FAC-008", "distrito-barranco", "Médica Ocular - Sede Barranco", "clinic", "Privada", "Av. Francisco Bolognesi 98, Barranco", -12.15109000, -77.01977000, 360),
            CreateFacilitySeed("FAC-009", "distrito-brena", "Instituto Nacional de Salud del Niño - Breña", "minsa", "MINSA", "Av. Brasil 600, Breña", -12.06512090, -77.04595470, 1350),
            CreateFacilitySeed("FAC-010", "distrito-brena", "La Rambla Brasil", "mall", "Centro comercial", "Av. Brasil 702-778, Breña", -12.06608620, -77.04695320, 1500),
            CreateFacilitySeed("FAC-011", "distrito-jesus-maria", "Hospital Nacional Edgardo Rebagliati Martins", "essalud", "EsSalud", "Av. Edgardo Rebagliati 490, Jesús María", -12.07836000, -77.03989000, 2600),
            CreateFacilitySeed("FAC-012", "distrito-jesus-maria", "Clínica San Felipe", "clinic", "Privada", "Av. Gregorio Escobedo 650, Jesús María", -12.08604000, -77.05434000, 950),
            CreateFacilitySeed("FAC-013", "distrito-jesus-maria", "Policlínico Peruano Japonés", "clinic", "Asociación Peruano Japonesa", "Av. Gregorio Escobedo 783, Jesús María", -12.08783000, -77.05507000, 520),
            CreateFacilitySeed("FAC-014", "distrito-jesus-maria", "Real Plaza Salaverry", "mall", "Centro comercial", "Av. Gral. Felipe Salaverry 2370, Jesús María", -12.08983000, -77.05273000, 2500),
            CreateFacilitySeed("FAC-015", "distrito-la-victoria", "Hospital Nacional Guillermo Almenara Irigoyen", "essalud", "EsSalud", "Av. Grau 800, La Victoria", -12.05958000, -77.02234000, 2400),
            CreateFacilitySeed("FAC-016", "distrito-la-victoria", "Hospital de Emergencias Pediátricas", "minsa", "MINSA", "Av. Miguel Grau 854, La Victoria", -12.05817080, -77.02172930, 1050),
            CreateFacilitySeed("FAC-017", "distrito-lince", "Clínica Risso", "clinic", "Privada", "Av. Arequipa 2030, Lince", -12.08498800, -77.03457760, 620),
            CreateFacilitySeed("FAC-018", "distrito-lince", "Centro Comercial Risso", "mall", "Centro comercial", "Av. Arequipa 2250, Lince", -12.08640000, -77.03481000, 950),
            CreateFacilitySeed("FAC-019", "distrito-magdalena", "Hospital Nacional Víctor Larco Herrera", "minsa", "MINSA", "Av. Augusto Pérez Araníbar 600, Magdalena del Mar", -12.09723000, -77.06555000, 1100),
            CreateFacilitySeed("FAC-020", "distrito-magdalena", "Clínica Virgen del Rosario", "clinic", "Privada", "Jr. Castilla 976, Magdalena del Mar", -12.08781700, -77.07237100, 480),
            CreateFacilitySeed("FAC-021", "distrito-miraflores", "Hospital de Emergencias José Casimiro Ulloa", "minsa", "MINSA", "Av. Roosevelt 6355-6357, Miraflores", -12.12810000, -77.01774000, 1200),
            CreateFacilitySeed("FAC-022", "distrito-miraflores", "Hospital III Suárez Angamos", "essalud", "EsSalud", "Av. Angamos Este 261, Miraflores", -12.11331000, -77.02814000, 1300),
            CreateFacilitySeed("FAC-023", "distrito-miraflores", "Clínica Delgado Auna", "clinic", "Auna", "Av. Angamos Oeste 450-490 / Calle General Borgoño, Miraflores", -12.11313000, -77.03300000, 1100),
            CreateFacilitySeed("FAC-024", "distrito-miraflores", "Clínica Good Hope", "clinic", "Privada", "Malecón Balta 956, Miraflores", -12.12562000, -77.03452000, 900),
            CreateFacilitySeed("FAC-025", "distrito-miraflores", "Larcomar", "mall", "Centro comercial", "Malecón de la Reserva 610, Miraflores", -12.13194000, -77.03006000, 1700),
            CreateFacilitySeed("FAC-026", "distrito-pueblo-libre", "Hospital Santa Rosa", "minsa", "MINSA", "Av. Simón Bolívar, cdra. 8, Pueblo Libre", -12.07207945, -77.06103691, 1350),
            CreateFacilitySeed("FAC-027", "distrito-pueblo-libre", "Clínica Centenario Peruano Japonesa", "clinic", "Asociación Peruano Japonesa", "Av. Paso de los Andes 675, Pueblo Libre", -12.07312430, -77.05912800, 950),
            CreateFacilitySeed("FAC-028", "distrito-pueblo-libre", "Clínica Stella Maris", "clinic", "Privada", "Av. Paso de los Andes 923, Pueblo Libre", -12.07139763, -77.05928362, 820),
            CreateFacilitySeed("FAC-029", "distrito-rimac", "Policlínico Francisco Pizarro", "essalud", "EsSalud", "Av. Francisco Pizarro 585, Rímac", -12.03701750, -77.03512710, 420),
            CreateFacilitySeed("FAC-030", "distrito-san-borja", "Instituto Nacional de Salud del Niño - San Borja", "minsa", "MINSA", "Av. Agustín de la Rosa Toro 1399 (Av. Javier Prado Este 3101), San Borja", -12.08564000, -76.99218000, 1500),
            CreateFacilitySeed("FAC-031", "distrito-san-borja", "SANNA Clínica San Borja", "clinic", "SANNA", "Av. Guardia Civil 337, San Borja", -12.09202000, -77.00834000, 780),
            CreateFacilitySeed("FAC-032", "distrito-san-borja", "Clínica Internacional - Sede San Borja", "clinic", "Clínica Internacional", "Av. Guardia Civil 385-433, San Borja", -12.09246393, -77.00883127, 1100),
            CreateFacilitySeed("FAC-033", "distrito-san-borja", "Clínica Santa Isabel", "clinic", "Privada", "Av. Guardia Civil 133, San Borja", -12.08939693, -77.00737837, 720),
            CreateFacilitySeed("FAC-034", "distrito-san-borja", "Clínica Vesalio", "clinic", "Privada", "Jr. Joseph Thompson 140, San Borja", -12.10637845, -77.00722390, 800),
            CreateFacilitySeed("FAC-035", "distrito-san-borja", "Clínica Oncosalud - Sede Hospitalaria", "clinic", "Auna / Oncosalud", "Av. Guardia Civil 227-229, San Borja", -12.09053000, -77.00780000, 1150),
            CreateFacilitySeed("FAC-036", "distrito-san-borja", "Oncosalud Auna - Sede Ambulatoria", "clinic", "Auna / Oncosalud", "Av. Guardia Civil 571, San Borja", -12.09536000, -77.01030000, 720),
            CreateFacilitySeed("FAC-037", "distrito-san-borja", "La Rambla San Borja", "mall", "Centro comercial", "Av. Javier Prado Este 2050, San Borja", -12.08949000, -77.00479000, 1900),
            CreateFacilitySeed("FAC-038", "distrito-san-borja", "Real Plaza Primavera", "mall", "Centro comercial", "Av. Aviación 2681, San Borja", -12.11029000, -77.00172000, 1800),
            CreateFacilitySeed("FAC-039", "distrito-san-isidro", "Clínica Anglo Americana", "clinic", "Privada", "C. Alfredo Salazar 350, San Isidro", -12.10922000, -77.03916000, 1050),
            CreateFacilitySeed("FAC-040", "distrito-san-isidro", "Clínica Ricardo Palma", "clinic", "Privada", "Av. Javier Prado Este 1066, San Isidro", -12.09071000, -77.01830000, 1150),
            CreateFacilitySeed("FAC-041", "distrito-san-isidro", "Auna Guardia Civil - Clínica", "clinic", "Auna", "Av. Guardia Civil 368, San Isidro", -12.09189611, -77.00903512, 800),
            CreateFacilitySeed("FAC-042", "distrito-san-isidro", "Clínica Javier Prado", "clinic", "Privada", "Av. Javier Prado Este 499, San Isidro", -12.09110000, -77.02845000, 900),
            CreateFacilitySeed("FAC-043", "distrito-san-isidro", "Clínica Internacional - Medicentro San Isidro", "clinic", "Clínica Internacional", "Av. Paseo de la República 3058, San Isidro", -12.09308000, -77.02396000, 650),
            CreateFacilitySeed("FAC-044", "distrito-san-isidro", "Centro Comercial Camino Real", "mall", "Centro comercial", "Av. Camino Real 479, San Isidro", -12.09707000, -77.03625000, 900),
            CreateFacilitySeed("FAC-045", "distrito-san-miguel", "Hospital I Octavio Mongrut Muñoz", "essalud", "EsSalud", "Av. Parque de las Leyendas 255, San Miguel", -12.06596120, -77.09458320, 920),
            CreateFacilitySeed("FAC-046", "distrito-san-miguel", "Clínica San Gabriel", "clinic", "Privada", "Av. de la Marina 2955, San Miguel", -12.07674000, -77.09574000, 950),
            CreateFacilitySeed("FAC-047", "distrito-san-miguel", "Plaza San Miguel", "mall", "Centro comercial", "Av. de la Marina 2000, San Miguel", -12.07691000, -77.08262000, 2600),
            CreateFacilitySeed("FAC-048", "distrito-san-miguel", "Open Plaza La Marina", "mall", "Centro comercial", "Av. de la Marina 2355, San Miguel", -12.07958300, -77.08869000, 1800),
            CreateFacilitySeed("FAC-049", "distrito-surco", "Policlínico EsSalud Próceres", "essalud", "EsSalud", "Av. Los Próceres 440, Santiago de Surco", -12.15066000, -76.98860000, 480),
            CreateFacilitySeed("FAC-050", "distrito-surco", "Clínica San Pablo - Sede Surco", "clinic", "San Pablo", "Av. El Polo 789, Santiago de Surco", -12.10016800, -76.97160700, 1150),
            CreateFacilitySeed("FAC-051", "distrito-surco", "Clínica Internacional - El Polo", "clinic", "Clínica Internacional", "Av. El Polo 461, Santiago de Surco", -12.10406000, -76.97292000, 760),
            CreateFacilitySeed("FAC-052", "distrito-surco", "Clínica Padre Luis Tezza", "clinic", "Privada", "Av. El Polo 570, Santiago de Surco", -12.10320000, -76.97201000, 850),
            CreateFacilitySeed("FAC-053", "distrito-surco", "Jockey Plaza", "mall", "Centro comercial", "Av. Javier Prado Este 4200, Santiago de Surco", -12.08645600, -76.97703600, 3200),
            CreateFacilitySeed("FAC-054", "distrito-surco", "El Polo Plaza Center", "mall", "Centro comercial", "Av. El Polo 759, Santiago de Surco", -12.10075000, -76.97180000, 900),
            CreateFacilitySeed("FAC-055", "distrito-surquillo", "Instituto Nacional de Enfermedades Neoplásicas - INEN", "minsa", "MINSA", "Av. Angamos Este 2520, Surquillo", -12.11261000, -76.99851000, 1800),
            CreateFacilitySeed("FAC-056", "distrito-surquillo", "Mallplaza Angamos", "mall", "Centro comercial", "Av. Angamos Este 1803 / cruce Tomás Marsano, Surquillo", -12.11144400, -77.01177800, 2100),
        }.ToList();

        SeedHistory();
        SeedAlerts();
    }

    public DashboardResponse GetDashboard(DateTimeOffset nowUtc)
    {
        lock (_gate)
        {
            var latest = GetLatestReadingsUnsafe();
            var todayStartUtc = GetLimaDayStartUtc(nowUtc);
            var todayReadings = _readings.Where(reading => reading.TimestampUtc >= todayStartUtc).ToArray();
            var activeAlerts = _alerts.Where(alert => alert.IsActive).ToArray();

            var currentDemand = latest.Values.Sum(reading => reading.PowerKw);
            var energyToday = todayReadings.Sum(reading => reading.EnergyKwh);
            var currentReadings = latest.Values.ToArray();

            var kpis = new DashboardKpis(
                Round(currentDemand),
                Round(energyToday),
                Round(currentReadings.Length == 0 ? 0 : currentReadings.Average(reading => reading.VoltageV), 1),
                Round(currentReadings.Length == 0 ? 0 : currentReadings.Average(reading => reading.PowerFactor), 3),
                _meters.Values.Count(meter => meter.Status == MeterStatus.Online),
                _meters.Count,
                activeAlerts.Length,
                Round(energyToday * EnergyPricePenPerKwh),
                "PEN");

            var zoneSummaries = BuildZoneSummariesUnsafe(latest, todayReadings, activeAlerts, currentDemand);
            var demandTrend = BuildDemandTrendUnsafe(nowUtc);
            var demandTrendByZone = BuildDemandTrendByZoneUnsafe(nowUtc);
            var recentAlerts = _alerts
                .OrderByDescending(alert => alert.CreatedAtUtc)
                .Take(6)
                .ToArray();

            return new DashboardResponse(
                _district,
                nowUtc,
                kpis,
                zoneSummaries,
                demandTrend,
                demandTrendByZone,
                recentAlerts);
        }
    }

    public IReadOnlyList<ZoneSummary> GetZones(DateTimeOffset nowUtc)
    {
        lock (_gate)
        {
            var latest = GetLatestReadingsUnsafe();
            var todayStartUtc = GetLimaDayStartUtc(nowUtc);
            var todayReadings = _readings.Where(reading => reading.TimestampUtc >= todayStartUtc).ToArray();
            var activeAlerts = _alerts.Where(alert => alert.IsActive).ToArray();
            var currentDemand = latest.Values.Sum(reading => reading.PowerKw);

            return BuildZoneSummariesUnsafe(latest, todayReadings, activeAlerts, currentDemand);
        }
    }

    public IReadOnlyList<MeterSummary> GetMeters()
    {
        lock (_gate)
        {
            var latest = GetLatestReadingsUnsafe();

            return _meters.Values
                .OrderBy(meter => _zones[meter.ZoneId].Name)
                .ThenBy(meter => meter.Name)
                .Select(meter =>
                {
                    latest.TryGetValue(meter.Id, out var reading);
                    return new MeterSummary(
                        meter.Id,
                        meter.ZoneId,
                        _zones[meter.ZoneId].Name,
                        meter.SerialNumber,
                        meter.Name,
                        meter.Status,
                        meter.InstalledAtUtc,
                        meter.Latitude,
                        meter.Longitude,
                        meter.RatedPowerKw,
                        reading is null ? null : Round(reading.PowerKw),
                        reading is null ? null : Round(reading.VoltageV, 1),
                        reading is null ? null : Round(reading.PowerFactor, 3),
                        reading?.TimestampUtc);
                })
                .ToArray();
        }
    }

    public MapResponse GetMap(DateTimeOffset nowUtc)
    {
        lock (_gate)
        {
            var latest = GetLatestReadingsUnsafe();
            var activeAlerts = _alerts.Where(alert => alert.IsActive).ToArray();
            var meters = _meters.Values
                .OrderBy(meter => _zones[meter.ZoneId].Name)
                .ThenBy(meter => meter.Name)
                .ToArray();

            var mapMeters = meters
                .Select(meter =>
                {
                    latest.TryGetValue(meter.Id, out var reading);

                    return new MapMeterSummary(
                        meter.Id,
                        meter.Name,
                        meter.ZoneId,
                        _zones[meter.ZoneId].Name,
                        meter.Latitude,
                        meter.Longitude,
                        meter.Status,
                        reading is null ? null : Round(reading.PowerKw),
                        reading is null ? null : Round(reading.VoltageV, 1),
                        reading is null ? null : Round(reading.PowerFactor, 3),
                        reading?.TimestampUtc,
                        HardwareModel,
                        FirmwareVersion);
                })
                .ToArray();

            var mapZones = _zones.Values
                .OrderBy(zone => zone.Name)
                .Select(zone =>
                {
                    var zoneMeters = meters.Where(meter => meter.ZoneId == zone.Id).ToArray();
                    var centerLatitude = zoneMeters.Length == 0
                        ? 0
                        : zoneMeters.Average(meter => meter.Latitude);
                    var centerLongitude = zoneMeters.Length == 0
                        ? 0
                        : zoneMeters.Average(meter => meter.Longitude);
                    var currentDemand = latest.Values
                        .Where(reading => reading.ZoneId == zone.Id)
                        .Sum(reading => reading.PowerKw);
                    var loadPercent = CalculateLoadPercent(currentDemand, zone.TypicalDemandKw);

                    return new MapZoneSummary(
                        zone.Id,
                        zone.Name,
                        zone.Sector,
                        zone.Color,
                        Round(centerLatitude, 6),
                        Round(centerLongitude, 6),
                        Round(currentDemand),
                        Round(zone.TypicalDemandKw),
                        Round(loadPercent, 1),
                        GetEnergyStatus(loadPercent),
                        activeAlerts.Count(alert => alert.ZoneId == zone.Id));
                })
                .ToArray();

            return new MapResponse(
                _district,
                nowUtc,
                BuildMapViewport(meters),
                mapZones,
                mapMeters,
                BuildFacilitiesUnsafe(latest));
        }
    }


    public IReadOnlyList<InfrastructureFacility> GetInfrastructure(DateTimeOffset nowUtc)
    {
        lock (_gate)
        {
            return BuildFacilitiesUnsafe(GetLatestReadingsUnsafe());
        }
    }

    public IReadOnlyList<EnergyReading> GetReadings(int limit)
    {
        lock (_gate)
        {
            return _readings
                .OrderByDescending(reading => reading.TimestampUtc)
                .ThenBy(reading => reading.MeterId)
                .Take(limit)
                .ToArray();
        }
    }

    public IReadOnlyList<EnergyAlert> GetAlerts()
    {
        lock (_gate)
        {
            return _alerts
                .OrderByDescending(alert => alert.IsActive)
                .ThenByDescending(alert => alert.CreatedAtUtc)
                .ToArray();
        }
    }

    public SimulationResult SimulateTick(DateTimeOffset timestampUtc)
    {
        lock (_gate)
        {
            var alertsBefore = _alerts.Count;
            var generated = 0;

            foreach (var meter in _meters.Values)
            {
                if (meter.Status != MeterStatus.Online)
                {
                    EnsureAlertUnsafe(
                        meter,
                        AlertType.MeterOffline,
                        AlertSeverity.Warning,
                        "El medidor no esta enviando lecturas.",
                        0,
                        1,
                        timestampUtc);
                    continue;
                }

                ResolveAlertUnsafe(meter.Id, AlertType.MeterOffline, timestampUtc);
                var previous = _readings.LastOrDefault(reading => reading.MeterId.Equals(meter.Id, StringComparison.OrdinalIgnoreCase));
                var elapsedHours = previous is null
                    ? 5d / 3600d
                    : Math.Clamp((timestampUtc - previous.TimestampUtc).TotalHours, 1d / 3600d, 0.25d);
                var reading = CreateReading(meter, timestampUtc, elapsedHours, includeRareAnomalies: true);
                _readings.Add(reading);
                generated++;

                var voltageAnomaly = reading.VoltageV is < 210 or > 240;
                SetAlertStateUnsafe(
                    meter,
                    AlertType.VoltageAnomaly,
                    voltageAnomaly,
                    AlertSeverity.Warning,
                    "Voltaje fuera del rango operativo de 210-240 V.",
                    reading.VoltageV,
                    reading.VoltageV < 210 ? 210 : 240,
                    timestampUtc);

                var lowPowerFactor = reading.PowerFactor < 0.88;
                SetAlertStateUnsafe(
                    meter,
                    AlertType.LowPowerFactor,
                    lowPowerFactor,
                    AlertSeverity.Warning,
                    "Factor de potencia por debajo del valor recomendado.",
                    reading.PowerFactor,
                    0.88,
                    timestampUtc);
            }

            RefreshDemandAlertsUnsafe(timestampUtc);

            var alertsCreated = _alerts.Count - alertsBefore;
            TrimHistoryUnsafe();
            var latest = GetLatestReadingsUnsafe();

            return new SimulationResult(
                timestampUtc,
                generated,
                alertsCreated,
                _alerts.Count(alert => alert.IsActive),
                Round(latest.Values.Sum(reading => reading.PowerKw)));
        }
    }

    private static Meter CreateMeter(
        string id,
        string zoneId,
        string name,
        double latitude,
        double longitude,
        double ratedPowerKw,
        DateTimeOffset installedAtUtc,
        MeterStatus status = MeterStatus.Online) =>
        new(id, zoneId, id.Replace("-", string.Empty), name, status, installedAtUtc, latitude, longitude, ratedPowerKw);


    private static FacilitySeed CreateFacilitySeed(
        string id,
        string zoneId,
        string name,
        string category,
        string network,
        string address,
        double latitude,
        double longitude,
        double ratedPowerKw) =>
        new(
            id,
            zoneId,
            name,
            category,
            network,
            address,
            Round(latitude, 6),
            Round(longitude, 6),
            ratedPowerKw);

    private IReadOnlyList<InfrastructureFacility> BuildFacilitiesUnsafe(
        IReadOnlyDictionary<string, EnergyReading> latest)
    {
        var zoneLoad = _zones.Values.ToDictionary(
            zone => zone.Id,
            zone =>
            {
                var demand = latest.Values
                    .Where(reading => reading.ZoneId.Equals(zone.Id, StringComparison.OrdinalIgnoreCase))
                    .Sum(reading => reading.PowerKw);
                return CalculateLoadPercent(demand, zone.TypicalDemandKw);
            },
            StringComparer.OrdinalIgnoreCase);

        return _facilities
            .OrderBy(facility => _zones[facility.ZoneId].Name)
            .ThenBy(facility => facility.Category)
            .ThenBy(facility => facility.Name)
            .Select(facility =>
            {
                var baseLoad = zoneLoad.TryGetValue(facility.ZoneId, out var load) ? load : 0;
                var categoryFactor = facility.Category switch
                {
                    "minsa" => 1.08,
                    "essalud" => 1.10,
                    "mall" => 1.05,
                    _ => 0.96
                };
                var deterministicOffset = (facility.Id.Sum(character => (int)character) % 11) - 5;
                var loadPercent = Math.Clamp(baseLoad * categoryFactor + deterministicOffset, 28, 112);
                var currentDemand = facility.RatedPowerKw * loadPercent / 100d;

                return new InfrastructureFacility(
                    facility.Id,
                    facility.ZoneId,
                    _zones[facility.ZoneId].Name,
                    facility.Name,
                    facility.Category,
                    facility.Network,
                    facility.Address,
                    facility.Latitude,
                    facility.Longitude,
                    Round(facility.RatedPowerKw),
                    Round(currentDemand),
                    Round(loadPercent, 1),
                    GetEnergyStatus(loadPercent),
                    "online",
                    true,
                    "Catálogo curado V6: establecimiento priorizado por relevancia y distrito verificado con fuentes institucionales/cartográficas; la telemetría energética continúa siendo simulada hasta instalar el nodo IoT físico.");
            })
            .ToArray();
    }

    private void SeedHistory()
    {
        var end = DateTimeOffset.UtcNow;
        var start = end.AddHours(-24);

        for (var timestamp = start; timestamp <= end; timestamp = timestamp.AddMinutes(15))
        {
            foreach (var meter in _meters.Values.Where(meter => meter.Status == MeterStatus.Online))
            {
                _readings.Add(CreateReading(meter, timestamp, 0.25, includeRareAnomalies: false));
            }
        }
    }

    private void SeedAlerts()
    {
        var now = DateTimeOffset.UtcNow;
        var maintenanceMeter = _meters["MTR-SMI-001"];
        EnsureAlertUnsafe(
            maintenanceMeter,
            AlertType.MeterOffline,
            AlertSeverity.Warning,
            "Nodo IoT de San Miguel en mantenimiento programado; no envía lecturas.",
            0,
            1,
            now.AddMinutes(-28));

        _alerts.Add(new EnergyAlert(
            Guid.NewGuid(),
            "MTR-MIR-001",
            "distrito-miraflores",
            AlertType.VoltageAnomaly,
            AlertSeverity.Warning,
            "Evento de bajo voltaje en Miraflores normalizado.",
            207.4,
            210,
            now.AddHours(-3),
            false,
            now.AddHours(-2).AddMinutes(42)));

        RefreshDemandAlertsUnsafe(now);
    }

    private EnergyReading CreateReading(
        Meter meter,
        DateTimeOffset timestampUtc,
        double elapsedHours,
        bool includeRareAnomalies)
    {
        var zone = _zones[meter.ZoneId];
        var meterCount = _meters.Values.Count(candidate => candidate.ZoneId == meter.ZoneId);
        var localHour = timestampUtc.ToOffset(LimaOffset).Hour;
        var hourlyFactor = localHour switch
        {
            < 6 => 0.42,
            < 9 => 0.72,
            < 17 => 0.84,
            < 22 => 1.08,
            _ => 0.62
        };

        var districtMultiplier = ZoneLoadMultipliers.TryGetValue(zone.Id, out var configuredMultiplier)
            ? configuredMultiplier
            : 1.0;
        var noise = 0.90 + (_random.NextDouble() * 0.20);
        var powerKw = Math.Min(
            meter.RatedPowerKw * 0.98,
            (zone.TypicalDemandKw / meterCount) * hourlyFactor * districtMultiplier * noise);
        var voltage = 220 + NextGaussian(0, 3.2);
        var powerFactor = Math.Clamp(0.93 + NextGaussian(0, 0.018), 0.82, 0.99);

        if (includeRareAnomalies && _random.NextDouble() < 0.015)
        {
            powerKw = meter.RatedPowerKw * (0.93 + _random.NextDouble() * 0.05);
        }

        if (includeRareAnomalies && _random.NextDouble() < 0.01)
        {
            voltage = _random.NextDouble() < 0.5
                ? 204 + (_random.NextDouble() * 5)
                : 241 + (_random.NextDouble() * 5);
        }

        if (includeRareAnomalies && _random.NextDouble() < 0.01)
        {
            powerFactor = 0.82 + (_random.NextDouble() * 0.05);
        }

        var currentA = powerKw * 1000 / (Math.Sqrt(3) * voltage * powerFactor);
        var frequencyHz = 60 + NextGaussian(0, 0.025);

        return new EnergyReading(
            Guid.NewGuid(),
            meter.Id,
            meter.ZoneId,
            timestampUtc,
            Round(powerKw),
            Round(powerKw * elapsedHours, 4),
            Round(voltage, 1),
            Round(currentA, 1),
            Round(powerFactor, 3),
            Round(frequencyHz, 2));
    }

    private IReadOnlyList<ZoneSummary> BuildZoneSummariesUnsafe(
        IReadOnlyDictionary<string, EnergyReading> latest,
        IReadOnlyCollection<EnergyReading> todayReadings,
        IReadOnlyCollection<EnergyAlert> activeAlerts,
        double districtCurrentDemand)
    {
        return _zones.Values
            .OrderBy(zone => zone.Name)
            .Select(zone =>
            {
                var meters = _meters.Values.Where(meter => meter.ZoneId == zone.Id).ToArray();
                var meterIds = meters.Select(meter => meter.Id).ToHashSet(StringComparer.OrdinalIgnoreCase);
                var currentDemand = latest.Values
                    .Where(reading => reading.ZoneId == zone.Id)
                    .Sum(reading => reading.PowerKw);
                var energyToday = todayReadings
                    .Where(reading => reading.ZoneId == zone.Id)
                    .Sum(reading => reading.EnergyKwh);
                var loadPercent = CalculateLoadPercent(currentDemand, zone.TypicalDemandKw);

                return new ZoneSummary(
                    zone.Id,
                    zone.DistrictId,
                    zone.Name,
                    zone.Sector,
                    zone.Color,
                    meters.Length,
                    meters.Count(meter => meter.Status == MeterStatus.Online),
                    Round(currentDemand),
                    Round(energyToday),
                    Round(zone.TypicalDemandKw),
                    Round(loadPercent, 1),
                    GetEnergyStatus(loadPercent),
                    districtCurrentDemand <= 0 ? 0 : Round(currentDemand / districtCurrentDemand * 100, 1),
                    activeAlerts.Count(alert => meterIds.Contains(alert.MeterId)));
            })
            .ToArray();
    }

    private IReadOnlyList<DemandPoint> BuildDemandTrendUnsafe(DateTimeOffset nowUtc, string? zoneId = null)
    {
        var start = nowUtc.AddHours(-24);
        var source = _readings.Where(reading => reading.TimestampUtc >= start);

        if (!string.IsNullOrWhiteSpace(zoneId))
        {
            source = source.Where(reading => reading.ZoneId.Equals(zoneId, StringComparison.OrdinalIgnoreCase));
        }

        return source
            .GroupBy(reading => new DateTimeOffset(
                reading.TimestampUtc.Year,
                reading.TimestampUtc.Month,
                reading.TimestampUtc.Day,
                reading.TimestampUtc.Hour,
                reading.TimestampUtc.Minute / 15 * 15,
                0,
                TimeSpan.Zero))
            .OrderBy(group => group.Key)
            .Select(group => new DemandPoint(
                group.Key,
                Round(group
                    .GroupBy(reading => reading.MeterId, StringComparer.OrdinalIgnoreCase)
                    .Sum(meterReadings => meterReadings.MaxBy(reading => reading.TimestampUtc)!.PowerKw))))
            .ToArray();
    }

    private IReadOnlyDictionary<string, IReadOnlyList<DemandPoint>> BuildDemandTrendByZoneUnsafe(DateTimeOffset nowUtc)
    {
        return _zones.Keys.ToDictionary(
            zoneId => zoneId,
            zoneId => BuildDemandTrendUnsafe(nowUtc, zoneId),
            StringComparer.OrdinalIgnoreCase);
    }

    private void RefreshDemandAlertsUnsafe(DateTimeOffset timestampUtc)
    {
        var latest = GetLatestReadingsUnsafe();

        foreach (var zone in _zones.Values)
        {
            var representativeMeter = _meters.Values.FirstOrDefault(meter => meter.ZoneId == zone.Id);
            if (representativeMeter is null)
            {
                continue;
            }

            var currentDemand = latest.Values
                .Where(reading => reading.ZoneId == zone.Id)
                .Sum(reading => reading.PowerKw);
            var loadPercent = CalculateLoadPercent(currentDemand, zone.TypicalDemandKw);
            var triggered = loadPercent >= WarningLoadPercent;
            var severity = loadPercent >= CriticalLoadPercent ? AlertSeverity.Critical : AlertSeverity.Warning;
            var level = loadPercent >= CriticalLoadPercent ? "crítico" : "de atención";
            var message = $"{zone.Name} en nivel {level}: demanda {Round(loadPercent, 1)}% de la referencia distrital ({Round(currentDemand)} de {Round(zone.TypicalDemandKw)} kW).";

            SetAlertStateUnsafe(
                representativeMeter,
                AlertType.HighConsumption,
                triggered,
                severity,
                message,
                currentDemand,
                zone.TypicalDemandKw * WarningLoadPercent / 100d,
                timestampUtc);
        }
    }

    private static double CalculateLoadPercent(double currentDemandKw, double referenceDemandKw) =>
        referenceDemandKw <= 0 ? 0 : currentDemandKw / referenceDemandKw * 100d;

    private static string GetEnergyStatus(double loadPercent) =>
        loadPercent >= CriticalLoadPercent ? "critical" :
        loadPercent >= WarningLoadPercent ? "warning" :
        "normal";

    private Dictionary<string, EnergyReading> GetLatestReadingsUnsafe()
    {
        return _readings
            .GroupBy(reading => reading.MeterId, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(
                group => group.Key,
                group => group.MaxBy(reading => reading.TimestampUtc)!,
                StringComparer.OrdinalIgnoreCase);
    }

    private static MapViewport BuildMapViewport(IReadOnlyCollection<Meter> meters)
    {
        if (meters.Count == 0)
        {
            return new MapViewport(0, 0, 0, 0, 0, 0);
        }

        var minLatitude = meters.Min(meter => meter.Latitude);
        var maxLatitude = meters.Max(meter => meter.Latitude);
        var minLongitude = meters.Min(meter => meter.Longitude);
        var maxLongitude = meters.Max(meter => meter.Longitude);
        var latitudePadding = Math.Max((maxLatitude - minLatitude) * MapPaddingRatio, MinimumMapPaddingDegrees);
        var longitudePadding = Math.Max((maxLongitude - minLongitude) * MapPaddingRatio, MinimumMapPaddingDegrees);

        return new MapViewport(
            Round((minLatitude + maxLatitude) / 2, 6),
            Round((minLongitude + maxLongitude) / 2, 6),
            Round(minLatitude - latitudePadding, 6),
            Round(minLongitude - longitudePadding, 6),
            Round(maxLatitude + latitudePadding, 6),
            Round(maxLongitude + longitudePadding, 6));
    }

    private void SetAlertStateUnsafe(
        Meter meter,
        AlertType type,
        bool isTriggered,
        AlertSeverity severity,
        string message,
        double value,
        double threshold,
        DateTimeOffset timestampUtc)
    {
        if (isTriggered)
        {
            EnsureAlertUnsafe(meter, type, severity, message, value, threshold, timestampUtc);
        }
        else
        {
            ResolveAlertUnsafe(meter.Id, type, timestampUtc);
        }
    }

    private void EnsureAlertUnsafe(
        Meter meter,
        AlertType type,
        AlertSeverity severity,
        string message,
        double value,
        double threshold,
        DateTimeOffset timestampUtc)
    {
        var activeIndex = _alerts.FindIndex(alert => alert.MeterId == meter.Id && alert.Type == type && alert.IsActive);
        if (activeIndex >= 0)
        {
            var existing = _alerts[activeIndex];
            _alerts[activeIndex] = existing with
            {
                Severity = severity,
                Message = message,
                Value = Round(value, 3),
                Threshold = Round(threshold, 3)
            };
            return;
        }

        _alerts.Add(new EnergyAlert(
            Guid.NewGuid(),
            meter.Id,
            meter.ZoneId,
            type,
            severity,
            message,
            Round(value, 3),
            Round(threshold, 3),
            timestampUtc,
            true,
            null));
    }

    private void ResolveAlertUnsafe(string meterId, AlertType type, DateTimeOffset timestampUtc)
    {
        for (var index = 0; index < _alerts.Count; index++)
        {
            var alert = _alerts[index];
            if (alert.MeterId == meterId && alert.Type == type && alert.IsActive)
            {
                _alerts[index] = alert with { IsActive = false, ResolvedAtUtc = timestampUtc };
            }
        }
    }

    private void TrimHistoryUnsafe()
    {
        if (_readings.Count > MaximumReadings)
        {
            _readings.RemoveRange(0, _readings.Count - MaximumReadings);
        }

        if (_alerts.Count > MaximumAlerts)
        {
            _alerts.RemoveRange(0, _alerts.Count - MaximumAlerts);
        }
    }

    private double NextGaussian(double mean, double standardDeviation)
    {
        var first = 1.0 - _random.NextDouble();
        var second = 1.0 - _random.NextDouble();
        var standardNormal = Math.Sqrt(-2.0 * Math.Log(first)) * Math.Sin(2.0 * Math.PI * second);
        return mean + (standardDeviation * standardNormal);
    }

    private static DateTimeOffset GetLimaDayStartUtc(DateTimeOffset timestampUtc)
    {
        var lima = timestampUtc.ToOffset(LimaOffset);
        return new DateTimeOffset(lima.Year, lima.Month, lima.Day, 0, 0, 0, LimaOffset).ToUniversalTime();
    }


    private sealed record FacilitySeed(
        string Id,
        string ZoneId,
        string Name,
        string Category,
        string Network,
        string Address,
        double Latitude,
        double Longitude,
        double RatedPowerKw);

    private static double Round(double value, int digits = 2) => Math.Round(value, digits, MidpointRounding.AwayFromZero);
}
