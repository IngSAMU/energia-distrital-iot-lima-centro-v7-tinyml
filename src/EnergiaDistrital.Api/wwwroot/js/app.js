(function () {
  "use strict";

  const ENDPOINTS = {
    dashboard: "/api/dashboard",
    zones: "/api/zones",
    meters: "/api/meters",
    readings: "/api/readings?limit=24",
    alerts: "/api/alerts",
    map: "/api/map",
    infrastructure: "/api/infrastructure",
    tinyml: "/api/tinyml",
    simulate: "/api/simulator/tick",
    health: "/api/health"
  };

  const POLL_INTERVAL_MS = 5000;
  const REQUEST_TIMEOUT_MS = 8000;
  const TELEMETRY_FRESH_MS = 15000;
  const numberFormat = new Intl.NumberFormat("es-PE", { maximumFractionDigits: 1 });
  const integerFormat = new Intl.NumberFormat("es-PE", { maximumFractionDigits: 0 });
  const timeFormat = new Intl.DateTimeFormat("es-PE", { hour: "2-digit", minute: "2-digit" });
  const dateTimeFormat = new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

  const state = {
    dashboard: {},
    zones: [],
    meters: [],
    readings: [],
    alerts: [],
    facilities: [],
    tinyml: null,
    mapData: { district: "", generatedAt: null, viewport: null, zones: [], meters: [], facilities: [] },
    selectedZone: "all",
    selectedFacilityType: "all",
    selectedMapMeterId: "",
    selectedMapFacilityId: "",
    initialized: false,
    loading: false,
    apiStatus: "initializing",
    lastUpdated: null,
    chartPoints: [],
    chartPositions: [],
    chartFocus: -1,
    mapMode: null,
    mapInstance: null,
    mapLayer: null,
    mapTileLayer: null,
    mapFramedZone: null,
    mapFallbackReason: "",
    toastTimer: null
  };

  const el = {};

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    [
      "connectionState", "connectionLabel", "lastUpdated", "zoneSelect", "simulateButton",
      "retryButton", "dataBanner", "dataBannerTitle", "dataBannerMessage", "currentDemand",
      "demandTrend", "energyToday", "energyMeta", "onlineMeters", "metersMeta", "activeAlerts",
      "alertsMeta", "peakDemand", "averageDemand", "demandChart", "chartWrap", "chartTooltip",
      "chartEmpty", "chartDataTable", "alertList", "alertsCount", "zoneBars", "zonesTotal",
      "metersBody", "metersCount", "districtMap", "mapCount", "mapDetail", "chartLegendLabel", "toast",
      "facilityTypeSelect", "facilitiesBody", "facilityCount", "facilityMinsaCount", "facilityEssaludCount", "facilityClinicCount", "facilityMallCount",
      "tinymlStatusBadge", "tinymlModelName", "tinymlDatasetCount", "tinymlAccuracy", "tinymlCriticalRecall", "tinymlPredictionZone", "tinymlPrediction",
      "tinymlProbNormal", "tinymlProbWarning", "tinymlProbCritical", "tinymlBarNormal", "tinymlBarWarning", "tinymlBarCritical", "tinymlFeatures", "tinymlRuleClass",
      "tinymlTestCount", "tinymlConfusion", "tinymlClassMetricsBody", "tinymlHostLatency", "tinymlResources", "tinymlDataNote"
    ].forEach(function (id) { el[id] = document.getElementById(id); });

    el.zoneSelect.addEventListener("change", function () {
      state.selectedZone = el.zoneSelect.value;
      state.chartFocus = -1;
      state.mapFramedZone = null;
      renderAll();
      refreshTinyMlSelection();
    });
    el.facilityTypeSelect.addEventListener("change", function () {
      state.selectedFacilityType = el.facilityTypeSelect.value;
      state.selectedMapFacilityId = "";
      state.mapFramedZone = null;
      renderAll();
    });
    el.simulateButton.addEventListener("click", simulateReading);
    el.retryButton.addEventListener("click", function () { loadData(true); });
    el.demandChart.addEventListener("pointermove", onChartPointerMove);
    el.demandChart.addEventListener("pointerleave", hideChartTooltip);
    el.demandChart.addEventListener("focus", onChartFocus);
    el.demandChart.addEventListener("blur", hideChartTooltip);
    el.demandChart.addEventListener("keydown", onChartKeydown);

    if ("ResizeObserver" in window) {
      const resizeObserver = new ResizeObserver(function () {
        window.requestAnimationFrame(drawChart);
        if (state.mapInstance) window.requestAnimationFrame(function () { state.mapInstance.invalidateSize(false); });
      });
      resizeObserver.observe(el.chartWrap);
      resizeObserver.observe(el.districtMap);
    } else {
      window.addEventListener("resize", drawChart);
    }

    loadData(false);
    window.setInterval(function () {
      if (!document.hidden) loadData(false);
    }, POLL_INTERVAL_MS);
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden && Date.now() - (state.lastUpdated ? state.lastUpdated.getTime() : 0) > POLL_INTERVAL_MS) {
        loadData(false);
      }
    });
  }

  async function loadData(userInitiated) {
    if (state.loading) return;
    state.loading = true;
    setConnection("updating", state.initialized ? "Actualizando" : "Conectando");

    const requests = await Promise.all([
      requestJson(ENDPOINTS.dashboard),
      requestJson(ENDPOINTS.zones),
      requestJson(ENDPOINTS.meters),
      requestJson(ENDPOINTS.readings),
      requestJson(ENDPOINTS.alerts),
      requestJson(ENDPOINTS.map),
      requestJson(ENDPOINTS.infrastructure),
      requestJson(ENDPOINTS.tinyml + "?zoneId=" + encodeURIComponent(state.selectedZone))
    ]);

    const names = ["dashboard", "zones", "meters", "readings", "alerts", "map", "infrastructure", "tinyml"];
    let successCount = 0;
    const failed = [];

    requests.forEach(function (result, index) {
      const name = names[index];
      if (result.ok) {
        successCount += 1;
        if (name === "dashboard") state.dashboard = unwrapObject(result.data, ["dashboard", "summary", "overview"]);
        if (name === "zones") state.zones = normalizeZones(result.data);
        if (name === "meters") state.meters = normalizeMeters(result.data);
        if (name === "readings") state.readings = normalizeReadings(result.data);
        if (name === "alerts") state.alerts = normalizeAlerts(result.data);
        if (name === "map") state.mapData = normalizeMap(result.data);
        if (name === "infrastructure") state.facilities = normalizeFacilities(result.data);
        if (name === "tinyml") state.tinyml = unwrapObject(result.data, ["tinyml", "lab", "model"]);
      } else {
        failed.push(endpointLabel(name));
      }
    });

    const dashboardZones = readValue(state.dashboard, ["consumptionByZone"], [], false);
    const dashboardAlerts = readValue(state.dashboard, ["recentAlerts"], [], false);
    if (!state.zones.length && Array.isArray(dashboardZones)) state.zones = normalizeZones(dashboardZones);
    if (!state.alerts.length && Array.isArray(dashboardAlerts)) state.alerts = normalizeAlerts(dashboardAlerts);

    state.loading = false;
    state.initialized = true;
    document.body.classList.remove("is-loading");

    if (successCount > 0) {
      state.lastUpdated = new Date();
      state.apiStatus = successCount === names.length ? "online" : "partial";
      setConnection(state.apiStatus, successCount === names.length ? "En línea" : "Datos parciales");
    } else {
      state.apiStatus = "offline";
      setConnection("offline", "API sin conexión");
    }

    updateErrorBanner(failed, successCount);
    renderAll();
    if (userInitiated && successCount === names.length) showToast("Panel actualizado correctamente.", "success");
  }

  async function requestJson(url, options) {
    const controller = new AbortController();
    const timeout = window.setTimeout(function () { controller.abort(); }, REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, Object.assign({
        headers: { "Accept": "application/json" },
        cache: "no-store",
        signal: controller.signal
      }, options || {}));
      if (!response.ok) throw new Error("HTTP " + response.status + " en " + url);
      if (response.status === 204) return { ok: true, data: null };
      return { ok: true, data: await response.json() };
    } catch (error) {
      return { ok: false, error: error };
    } finally {
      window.clearTimeout(timeout);
    }
  }

  async function simulateReading() {
    if (state.loading || el.simulateButton.disabled) return;
    const previousLabel = el.simulateButton.querySelector(".button__label").textContent;
    el.simulateButton.disabled = true;
    el.simulateButton.querySelector(".button__label").textContent = "Simulando…";

    const result = await requestJson(ENDPOINTS.simulate, {
      method: "POST",
      headers: { "Accept": "application/json" }
    });

    el.simulateButton.disabled = false;
    el.simulateButton.querySelector(".button__label").textContent = previousLabel;

    if (!result.ok) {
      showToast("La API no responde. Mantén EnergiaDistrital.Api en ejecución y verifica /api/health.", "error");
      return;
    }

    showToast("Nueva lectura IoT generada.", "success");
    await loadData(false);
  }

  async function refreshTinyMlSelection() {
    const result = await requestJson(ENDPOINTS.tinyml + "?zoneId=" + encodeURIComponent(state.selectedZone));
    if (result.ok) {
      state.tinyml = unwrapObject(result.data, ["tinyml", "lab", "model"]);
      renderTinyMl();
    }
  }

  function renderAll() {
    renderZoneSelector();
    renderMetrics();
    renderZones();
    renderMeters();
    renderAlerts();
    renderFacilities();
    renderTinyMl();
    renderMap();
    renderDemandChart();
  }

  function renderTinyMl() {
    const data = state.tinyml;
    if (!data || typeof data !== "object" || !el.tinymlModelName) return;

    const modelName = String(readValue(data, ["modelName"], "MLP 6-12-8-3"));
    const datasetCount = readNumber(data, ["datasetCount"]);
    const testCount = readNumber(data, ["testCount"]);
    const accuracy = readNumber(data, ["accuracy"]);
    const perClass = readValue(data, ["perClassMetrics"], [], false);
    const criticalMetric = Array.isArray(perClass) ? perClass.find(function (item) { return normalizeKey(readValue(item, ["className"], "")) === "critical"; }) : null;
    const criticalRecall = criticalMetric ? readNumber(criticalMetric, ["recall"]) : null;

    el.tinymlModelName.textContent = modelName;
    el.tinymlDatasetCount.textContent = datasetCount === null ? "—" : integerFormat.format(datasetCount);
    el.tinymlAccuracy.textContent = accuracy === null ? "—" : (accuracy * 100).toFixed(2) + "%";
    el.tinymlCriticalRecall.textContent = criticalRecall === null ? "—" : (criticalRecall * 100).toFixed(2) + "%";
    el.tinymlTestCount.textContent = testCount === null ? "—" : integerFormat.format(testCount);

    const zoneName = String(readValue(data, ["selectedZoneName"], "Lima Centro"));
    const prediction = readValue(data, ["currentPrediction"], {}, false) || {};
    const predictedClass = normalizeEnergyStatus(readValue(prediction, ["predictedClass"], "normal")) || "normal";
    el.tinymlPredictionZone.textContent = zoneName;
    el.tinymlPrediction.textContent = energyStatusLabel(predictedClass);
    el.tinymlPrediction.dataset.class = predictedClass;

    const pNormal = Math.max(0, Math.min(1, readNumber(prediction, ["normalProbability"]) || 0));
    const pWarning = Math.max(0, Math.min(1, readNumber(prediction, ["warningProbability"]) || 0));
    const pCritical = Math.max(0, Math.min(1, readNumber(prediction, ["criticalProbability"]) || 0));
    el.tinymlProbNormal.textContent = (pNormal * 100).toFixed(1) + "%";
    el.tinymlProbWarning.textContent = (pWarning * 100).toFixed(1) + "%";
    el.tinymlProbCritical.textContent = (pCritical * 100).toFixed(1) + "%";
    el.tinymlBarNormal.style.width = (pNormal * 100).toFixed(1) + "%";
    el.tinymlBarWarning.style.width = (pWarning * 100).toFixed(1) + "%";
    el.tinymlBarCritical.style.width = (pCritical * 100).toFixed(1) + "%";

    const features = readValue(data, ["currentFeatures"], {}, false) || {};
    const featureRows = [
      ["Carga", readNumber(features, ["loadPercent"]), "%", 1],
      ["Voltaje", readNumber(features, ["voltageV"]), "V", 1],
      ["Corriente", readNumber(features, ["currentPercent"]), "% ref.", 1],
      ["PF", readNumber(features, ["powerFactor"]), "", 3],
      ["Frecuencia", readNumber(features, ["frequencyHz"]), "Hz", 2],
      ["Temperatura", readNumber(features, ["temperatureC"]), "°C", 1]
    ];
    el.tinymlFeatures.innerHTML = featureRows.map(function (row) {
      const value = row[1] === null ? "—" : new Intl.NumberFormat("es-PE", { maximumFractionDigits: row[3] }).format(row[1]) + (row[2] ? " " + row[2] : "");
      return '<span>' + escapeHtml(row[0]) + '<strong>' + escapeHtml(value) + '</strong></span>';
    }).join("");

    const referenceClass = normalizeEnergyStatus(readValue(data, ["ruleReferenceClass"], "normal")) || "normal";
    el.tinymlRuleClass.textContent = energyStatusLabel(referenceClass);

    const matrix = readValue(data, ["confusionMatrix"], [], false);
    if (Array.isArray(matrix) && matrix.length === 3) {
      const labels = ["Normal", "Atención", "Crítico"];
      let html = '<table class="tinyml-confusion"><thead><tr><th>Real ↓ / Pred. →</th>' + labels.map(function (label) { return '<th>' + label + '</th>'; }).join("") + '</tr></thead><tbody>';
      matrix.forEach(function (row, rowIndex) {
        html += '<tr><th>' + labels[rowIndex] + '</th>';
        (Array.isArray(row) ? row : []).forEach(function (value, colIndex) {
          html += '<td class="' + (rowIndex === colIndex ? 'is-hit' : 'is-error') + '">' + escapeHtml(integerFormat.format(Number(value) || 0)) + '</td>';
        });
        html += '</tr>';
      });
      html += '</tbody></table>';
      el.tinymlConfusion.innerHTML = html;
    }

    if (Array.isArray(perClass) && perClass.length) {
      el.tinymlClassMetricsBody.innerHTML = perClass.map(function (metric) {
        const cls = normalizeEnergyStatus(readValue(metric, ["className"], "normal")) || "normal";
        return '<tr><td><span class="tinyml-prediction" data-class="' + cls + '">' + escapeHtml(energyStatusLabel(cls)) + '</span></td>' +
          '<td>' + percentMetric(readNumber(metric, ["precision"])) + '</td>' +
          '<td>' + percentMetric(readNumber(metric, ["recall"])) + '</td>' +
          '<td>' + percentMetric(readNumber(metric, ["f1Score"])) + '</td></tr>';
      }).join("");
    }

    const hostLatency = readNumber(data, ["hostReferenceLatencyUs"]);
    el.tinymlHostLatency.textContent = hostLatency === null ? "—" : hostLatency.toFixed(2) + " µs";
    const resources = readValue(data, ["resourceStatus"], [], false);
    if (Array.isArray(resources) && resources.length) {
      el.tinymlResources.innerHTML = resources.map(function (resource) {
        const status = String(readValue(resource, ["status"], "pending-device"));
        return '<article class="tinyml-resource" data-status="' + escapeHtml(status) + '"><div class="tinyml-resource__top"><strong>' +
          escapeHtml(readValue(resource, ["label"], "Recurso")) + '</strong><b>' + escapeHtml(readValue(resource, ["value"], "Pendiente")) +
          '</b></div><p>' + escapeHtml(readValue(resource, ["note"], "")) + '</p></article>';
      }).join("");
    }
    el.tinymlDataNote.textContent = String(readValue(data, ["dataNote"], "Validación experimental con dataset sintético."));
  }

  function percentMetric(value) {
    return value === null || !Number.isFinite(value) ? "—" : (value * 100).toFixed(2) + "%";
  }

  function renderMap() {
    const mapData = state.mapData || { zones: [], meters: [], facilities: [] };
    const mapZones = Array.isArray(mapData.zones) ? mapData.zones : [];
    const mapMeters = Array.isArray(mapData.meters) ? mapData.meters : [];
    const mapFacilities = Array.isArray(mapData.facilities) && mapData.facilities.length ? mapData.facilities : state.facilities;
    const visibleZones = state.selectedZone === "all" ? mapZones : mapZones.filter(matchesSelectedZone);
    const visibleMeters = mapMeters.filter(matchesSelectedZone).filter(hasMapCoordinates);
    const visibleFacilities = mapFacilities.filter(matchesSelectedZone).filter(matchesFacilityType).filter(hasMapCoordinates);

    if (!visibleMeters.some(function (meter) { return meter.id === state.selectedMapMeterId; })) {
      state.selectedMapMeterId = visibleMeters.length ? visibleMeters[0].id : "";
    }
    if (!visibleFacilities.some(function (facility) { return facility.id === state.selectedMapFacilityId; })) {
      state.selectedMapFacilityId = "";
    }

    const districtLabel = mapData.district ? " en " + mapData.district : "";
    const statusCounts = visibleZones.reduce(function (acc, zone) {
      const status = energyStatusForZone(zone);
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, { normal: 0, warning: 0, critical: 0 });
    el.mapCount.textContent = visibleZones.length + (visibleZones.length === 1 ? " distrito" : " distritos") + districtLabel +
      " · " + visibleFacilities.length + " infraestructuras · " + statusCounts.normal + " normal · " + statusCounts.warning + " atención · " + statusCounts.critical + " crítico";

    const selectedFacility = visibleFacilities.find(function (facility) { return facility.id === state.selectedMapFacilityId; }) || null;
    if (selectedFacility) renderFacilityDetail(selectedFacility);
    else renderMapDetail(visibleMeters.find(function (meter) { return meter.id === state.selectedMapMeterId; }) || null);

    const hasZoneCoordinates = visibleZones.some(hasMapCoordinates);
    if (!visibleMeters.length && !visibleFacilities.length && !hasZoneCoordinates && !validMapViewport(mapData.viewport)) {
      removeLeafletMap();
      state.mapMode = null;
      el.districtMap.innerHTML = '<div class="map-empty"><span aria-hidden="true">⌖</span><strong>Sin ubicaciones disponibles</strong><small>La API del mapa aún no reporta coordenadas para la selección actual.</small></div>';
      return;
    }

    if (state.mapMode === "fallback" || !window.L || typeof window.L.map !== "function") {
      if (state.mapMode !== "fallback") {
        state.mapMode = "fallback";
        state.mapFallbackReason = "La biblioteca cartográfica no está disponible; se muestra una vista esquemática.";
      }
      renderFallbackMap(visibleMeters, visibleZones, visibleFacilities, state.mapFallbackReason);
      return;
    }

    if (!ensureLeafletMap()) return;
    renderLeafletMap(visibleMeters, visibleZones, visibleFacilities);
  }

  function ensureLeafletMap() {
    if (state.mapInstance) return true;
    try {
      el.districtMap.innerHTML = "";
      const initial = mapInitialCenter();
      const map = window.L.map(el.districtMap, { zoomControl: true, attributionControl: true, keyboard: true });
      map.setView(initial, 13);
      const tileLayer = window.L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
      });
      let tileReady = false;
      let tileErrors = 0;
      tileLayer.on("tileload", function () { tileReady = true; });
      tileLayer.on("tileerror", function () {
        tileErrors += 1;
        if (!tileReady || tileErrors >= 3) switchToFallbackMap("No se pudieron cargar los mosaicos; se muestra una vista esquemática.");
      });
      tileLayer.addTo(map);

      state.mapMode = "leaflet";
      state.mapInstance = map;
      state.mapTileLayer = tileLayer;
      state.mapLayer = window.L.layerGroup().addTo(map);
      state.mapFallbackReason = "";

      window.setTimeout(function () {
        if (state.mapInstance === map && state.mapMode === "leaflet" && !tileReady) {
          switchToFallbackMap("Los mosaicos tardaron demasiado; se muestra una vista esquemática.");
        }
      }, 8000);
      return true;
    } catch (error) {
      switchToFallbackMap("No fue posible iniciar el mapa; se muestra una vista esquemática.");
      return false;
    }
  }

  function renderLeafletMap(meters, zones, facilities) {
    if (!state.mapInstance || !state.mapLayer) return;
    state.mapLayer.clearLayers();

    zones.filter(hasMapCoordinates).forEach(function (zone) {
      const status = energyStatusForZone(zone);
      const color = energyStatusColor(status);
      const loadLabel = Number.isFinite(zone.loadPercent) ? numberFormat.format(zone.loadPercent) + "%" : "—";
      const tooltip = zone.name + " · " + energyStatusLabel(status) + " · " + loadLabel + " · " + formatCompact(zone.currentDemandKw, "kW");
      // El distrito se representa mediante un punto de referencia compacto. No se dibuja
      // un círculo territorial porque podría confundirse con un límite administrativo real.
      window.L.circleMarker([zone.latitude, zone.longitude], {
        radius: status === "critical" ? 12 : 10,
        color: "#ffffff",
        fillColor: color,
        fillOpacity: 0.95,
        opacity: 1,
        weight: 3,
        interactive: true
      }).bindTooltip(tooltip, {
        permanent: true,
        direction: "top",
        offset: [0, -10],
        className: "map-zone-tooltip map-zone-tooltip--" + status
      }).addTo(state.mapLayer);
    });

    meters.forEach(function (meter) {
      const selected = meter.id === state.selectedMapMeterId;
      const label = mapMeterAriaLabel(meter);
      const icon = window.L.divIcon({
        className: "map-meter-icon-shell status-" + telemetryStatusClass(telemetryState(meter)) + (selected ? " is-selected" : ""),
        html: '<span class="map-marker" style="--zone-color:' + mapZoneColorForMeter(meter) + '" aria-hidden="true"></span>',
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });
      const marker = window.L.marker([meter.latitude, meter.longitude], {
        icon: icon,
        keyboard: true,
        title: label,
        alt: label,
        riseOnHover: true
      }).bindTooltip(escapeHtml(meter.name) + " · " + escapeHtml(formatCompact(meter.currentPowerKw, "kW")), {
        direction: "top",
        offset: [0, -12]
      });
      marker.on("click", function () { selectMapMeter(meter.id); });
      marker.addTo(state.mapLayer);
      const markerElement = marker.getElement();
      if (markerElement) {
        markerElement.setAttribute("role", "button");
        markerElement.setAttribute("aria-label", label);
        markerElement.setAttribute("aria-pressed", selected ? "true" : "false");
        markerElement.addEventListener("keydown", function (event) {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            selectMapMeter(meter.id);
          }
        });
      }
    });

    facilities.forEach(function (facility) {
      const selected = facility.id === state.selectedMapFacilityId;
      const status = normalizeEnergyStatus(facility.energyStatus) || "normal";
      const icon = window.L.divIcon({
        className: "facility-marker-shell facility-" + facility.category + (selected ? " is-selected" : ""),
        html: '<span class="facility-marker facility-marker--' + facility.category + ' facility-marker--' + status + '" aria-hidden="true">' + escapeHtml(facilityMarkerSymbol(facility.category)) + '</span>',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });
      const marker = window.L.marker([facility.latitude, facility.longitude], {
        icon: icon,
        keyboard: true,
        title: facility.name,
        alt: facility.name,
        riseOnHover: true
      }).bindTooltip(escapeHtml(facility.name) + " · " + escapeHtml(facility.zoneName || zoneNameById(facility.zoneId) || "") + " · " + escapeHtml(facilityCategoryLabel(facility.category)) + " · " + escapeHtml(formatCompact(facility.currentDemandKw, "kW")), {
        direction: "top",
        offset: [0, -12]
      });
      marker.on("click", function () { selectMapFacility(facility.id); });
      marker.addTo(state.mapLayer);
    });

    if (state.mapFramedZone !== state.selectedZone + "|" + state.selectedFacilityType) {
      frameLeafletMap(meters, zones, facilities);
      state.mapFramedZone = state.selectedZone + "|" + state.selectedFacilityType;
    }
    window.requestAnimationFrame(function () {
      if (state.mapInstance) state.mapInstance.invalidateSize(false);
    });
  }

  function frameLeafletMap(meters, zones, facilities) {
    const map = state.mapInstance;
    if (!map) return;
    const viewport = state.mapData && state.mapData.viewport;
    if (state.selectedZone === "all" && validMapViewport(viewport)) {
      map.fitBounds([[viewport.minLatitude, viewport.minLongitude], [viewport.maxLatitude, viewport.maxLongitude]], { padding: [28, 28], maxZoom: 15 });
      return;
    }
    const coordinates = meters.concat(zones).concat(facilities || []).filter(hasMapCoordinates).map(function (item) { return [item.latitude, item.longitude]; });
    if (coordinates.length === 1) {
      map.setView(coordinates[0], 15);
    } else if (coordinates.length > 1) {
      map.fitBounds(coordinates, { padding: [34, 34], maxZoom: 15 });
    } else {
      map.setView(mapInitialCenter(), 13);
    }
  }

  function switchToFallbackMap(reason) {
    if (state.mapMode === "fallback") return;
    removeLeafletMap();
    state.mapMode = "fallback";
    state.mapFallbackReason = reason;
    state.mapFramedZone = null;
    renderMap();
  }

  function removeLeafletMap() {
    if (state.mapInstance) {
      try { state.mapInstance.remove(); } catch (error) { /* La vista de respaldo reemplaza el contenedor. */ }
    }
    state.mapInstance = null;
    state.mapLayer = null;
    state.mapTileLayer = null;
  }

  function renderFallbackMap(meters, zones, facilities, reason) {
    const bounds = fallbackMapBounds(meters, zones, facilities);
    const notice = reason ? '<div class="map-fallback__notice" role="status">' + escapeHtml(reason) + "</div>" : "";
    const zoneMarkup = zones.filter(hasMapCoordinates).map(function (zone) {
      const position = fallbackPosition(zone, bounds);
      const status = energyStatusForZone(zone);
      const load = Number.isFinite(zone.loadPercent) ? numberFormat.format(zone.loadPercent) + "%" : "—";
      return '<span class="map-fallback__zone map-fallback__zone--' + status + '" style="left:' + position.x + "%;top:" + position.y + "%;--zone-color:" + energyStatusColor(status) + '"><strong>' + escapeHtml(zone.name) + '</strong><small>' + escapeHtml(energyStatusLabel(status)) + " · " + escapeHtml(load) + "</small></span>";
    }).join("");
    const meterMarkup = meters.map(function (meter) {
      const position = fallbackPosition(meter, bounds);
      const selected = meter.id === state.selectedMapMeterId;
      return '<button type="button" class="map-fallback-marker status-' + telemetryStatusClass(telemetryState(meter)) + (selected ? " is-selected" : "") + '" data-map-meter-id="' + escapeHtml(meter.id) + '" style="left:' + position.x + "%;top:" + position.y + "%;--zone-color:" + mapZoneColorForMeter(meter) + '" aria-label="' + escapeHtml(mapMeterAriaLabel(meter)) + '" aria-pressed="' + (selected ? "true" : "false") + '"></button>';
    }).join("");
    const facilityMarkup = (facilities || []).map(function (facility) {
      const position = fallbackPosition(facility, bounds);
      const selected = facility.id === state.selectedMapFacilityId;
      const energyStatus = normalizeEnergyStatus(facility.energyStatus) || "normal";
      return '<button type="button" class="map-fallback-facility facility-' + escapeHtml(facility.category) + ' energy-' + energyStatus + (selected ? " is-selected" : "") + '" data-map-facility-id="' + escapeHtml(facility.id) + '" style="left:' + position.x + "%;top:" + position.y + '%" aria-label="' + escapeHtml(facility.name + ", " + facilityCategoryLabel(facility.category) + ", " + energyStatusLabel(energyStatus)) + '">' + escapeHtml(facilityMarkerSymbol(facility.category)) + '</button>';
    }).join("");

    el.districtMap.innerHTML = '<div class="map-fallback">' + notice + zoneMarkup + meterMarkup + facilityMarkup +
      '<p class="map-fallback__attribution">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a></p></div>';
    el.districtMap.querySelectorAll("[data-map-meter-id]").forEach(function (button) {
      button.addEventListener("click", function () { selectMapMeter(button.getAttribute("data-map-meter-id")); });
    });
    el.districtMap.querySelectorAll("[data-map-facility-id]").forEach(function (button) {
      button.addEventListener("click", function () { selectMapFacility(button.getAttribute("data-map-facility-id")); });
    });
  }

  function selectMapMeter(meterId) {
    state.selectedMapMeterId = String(meterId);
    state.selectedMapFacilityId = "";
    renderMap();
  }

  function selectMapFacility(facilityId) {
    state.selectedMapFacilityId = String(facilityId);
    state.selectedMapMeterId = "";
    const source = Array.isArray(state.facilities) ? state.facilities : [];
    const facility = source.find(function (item) { return item.id === state.selectedMapFacilityId; });
    if (facility && facility.zoneId) {
      state.selectedZone = facility.zoneId;
      if (el.zoneSelect) el.zoneSelect.value = facility.zoneId;
    }
    state.mapFramedZone = null;
    renderAll();
  }

  function renderMapDetail(meter) {
    if (!meter) {
      el.mapDetail.innerHTML = '<div class="map-detail__empty"><span aria-hidden="true">IoT</span><strong>Seleccione un medidor</strong><small>Consulte demanda, calidad eléctrica y versión del equipo.</small></div>';
      return;
    }
    const telemetry = telemetryState(meter);
    const status = telemetryLabel(telemetry);
    const statusClass = telemetryStatusClass(telemetry);
    const mapZones = state.mapData && Array.isArray(state.mapData.zones) ? state.mapData.zones : [];
    const zone = mapZones.find(function (entry) { return sameZone(meter, entry.id, entry.name); }) || null;
    const energyStatus = energyStatusForZone(zone || {});
    const energyLoad = zone && Number.isFinite(zone.loadPercent) ? numberFormat.format(zone.loadPercent) + "%" : "—";
    const demand = meter.currentPowerKw === null ? "—" : numberFormat.format(meter.currentPowerKw);
    const powerFactor = meter.powerFactor === null ? "—" : new Intl.NumberFormat("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 3 }).format(meter.powerFactor);
    el.mapDetail.innerHTML = '<div class="map-detail__topline"><div><span class="map-detail__eyebrow">Medidor ' + escapeHtml(meter.id) + '</span><h3>' + escapeHtml(meter.name) + '</h3><span class="map-detail__zone" style="--zone-color:' + mapZoneColorForMeter(meter) + '">' + escapeHtml(meter.zoneName || zoneNameById(meter.zoneId) || "Sin distrito") + '</span><span class="map-detail__energy map-detail__energy--' + energyStatus + '">' + escapeHtml(energyStatusLabel(energyStatus)) + ' · ' + escapeHtml(energyLoad) + '</span></div><span class="map-detail__status map-detail__status--' + statusClass + '">' + escapeHtml(status) + '</span></div>' +
      '<div class="map-detail__reading"><small>Demanda instantánea</small><strong>' + escapeHtml(demand) + '<span>kW</span></strong></div>' +
      '<dl><div><dt>Voltaje</dt><dd>' + escapeHtml(formatCompact(meter.voltageV, "V")) + '</dd></div><div><dt>Factor de potencia</dt><dd>' + escapeHtml(powerFactor) + '</dd></div><div><dt>Hardware</dt><dd>' + escapeHtml(meter.hardwareModel || "No informado") + '</dd></div><div><dt>Firmware</dt><dd>' + escapeHtml(meter.firmwareVersion || "No informado") + '</dd></div></dl>' +
      '<p class="map-detail__updated">Última lectura: ' + escapeHtml(formatDateTime(meter.lastSeen)) + ' · ' + escapeHtml(telemetryAgeLabel(meter.lastSeen)) + "</p>";
  }

  function renderFacilityDetail(facility) {
    const status = normalizeEnergyStatus(facility.energyStatus) || "normal";
    el.mapDetail.innerHTML = '<div class="map-detail__topline"><div><span class="map-detail__eyebrow">' + escapeHtml(facilityCategoryLabel(facility.category)) + '</span><h3>' + escapeHtml(facility.name) + '</h3><span class="map-detail__zone">' + escapeHtml(facility.zoneName || zoneNameById(facility.zoneId) || "Sin distrito") + '</span><span class="map-detail__energy map-detail__energy--' + status + '">' + escapeHtml(energyStatusLabel(status)) + ' · ' + escapeHtml(numberFormat.format(facility.loadPercent)) + '%</span></div><span class="map-detail__status map-detail__status--online">Conectado</span></div>' +
      '<div class="map-detail__reading"><small>Demanda estimada</small><strong>' + escapeHtml(numberFormat.format(facility.currentDemandKw)) + '<span>kW</span></strong></div>' +
      '<dl><div><dt>Red / operador</dt><dd>' + escapeHtml(facility.network || "—") + '</dd></div><div><dt>Potencia de referencia</dt><dd>' + escapeHtml(formatCompact(facility.ratedPowerKw, "kW")) + '</dd></div><div><dt>Dirección</dt><dd>' + escapeHtml(facility.address || "—") + '</dd></div><div><dt>Coordenadas</dt><dd>' + escapeHtml(Number(facility.latitude).toFixed(6) + ", " + Number(facility.longitude).toFixed(6)) + '</dd></div><div><dt>Telemetría</dt><dd>' + (facility.isSimulated ? "Simulada" : "Real") + '</dd></div></dl>' +
      '<p class="map-detail__updated">' + escapeHtml(facility.locationNote || "") + '</p>';
  }

  function mapInitialCenter() {
    const viewport = state.mapData && state.mapData.viewport;
    if (viewport && Number.isFinite(viewport.centerLatitude) && Number.isFinite(viewport.centerLongitude)) return [viewport.centerLatitude, viewport.centerLongitude];
    const firstMeter = state.mapData && state.mapData.meters && state.mapData.meters.find(hasMapCoordinates);
    if (firstMeter) return [firstMeter.latitude, firstMeter.longitude];
    const firstZone = state.mapData && state.mapData.zones && state.mapData.zones.find(hasMapCoordinates);
    return firstZone ? [firstZone.latitude, firstZone.longitude] : [-12.0464, -77.0428];
  }

  function fallbackMapBounds(meters, zones, facilities) {
    const viewport = state.mapData && state.mapData.viewport;
    if (validMapViewport(viewport)) return viewport;
    const points = meters.concat(zones).concat(facilities || []).filter(hasMapCoordinates);
    const latitudes = points.map(function (item) { return item.latitude; });
    const longitudes = points.map(function (item) { return item.longitude; });
    let minLatitude = latitudes.length ? Math.min.apply(null, latitudes) : -12.051;
    let maxLatitude = latitudes.length ? Math.max.apply(null, latitudes) : -12.041;
    let minLongitude = longitudes.length ? Math.min.apply(null, longitudes) : -77.048;
    let maxLongitude = longitudes.length ? Math.max.apply(null, longitudes) : -77.038;
    if (minLatitude === maxLatitude) { minLatitude -= 0.004; maxLatitude += 0.004; }
    if (minLongitude === maxLongitude) { minLongitude -= 0.004; maxLongitude += 0.004; }
    return { minLatitude: minLatitude, maxLatitude: maxLatitude, minLongitude: minLongitude, maxLongitude: maxLongitude };
  }

  function fallbackPosition(item, bounds) {
    const longitudeRange = bounds.maxLongitude - bounds.minLongitude || 1;
    const latitudeRange = bounds.maxLatitude - bounds.minLatitude || 1;
    return {
      x: Math.max(5, Math.min(95, ((item.longitude - bounds.minLongitude) / longitudeRange) * 90 + 5)).toFixed(2),
      y: Math.max(7, Math.min(93, ((bounds.maxLatitude - item.latitude) / latitudeRange) * 86 + 7)).toFixed(2)
    };
  }

  function validMapViewport(viewport) {
    return Boolean(viewport && [viewport.minLatitude, viewport.minLongitude, viewport.maxLatitude, viewport.maxLongitude].every(Number.isFinite) && viewport.minLatitude < viewport.maxLatitude && viewport.minLongitude < viewport.maxLongitude);
  }

  function hasMapCoordinates(item) {
    return Boolean(item && Number.isFinite(item.latitude) && Number.isFinite(item.longitude) && Math.abs(item.latitude) <= 90 && Math.abs(item.longitude) <= 180);
  }

  function mapZoneColor(zone) {
    return energyStatusColor(energyStatusForZone(zone));
  }

  function mapZoneColorForMeter(meter) {
    const zones = state.mapData && state.mapData.zones ? state.mapData.zones : [];
    const zone = zones.find(function (entry) { return sameZone(meter, entry.id, entry.name); });
    return mapZoneColor(zone || { id: meter.zoneId || meter.zoneName, energyStatus: "normal" });
  }

  function energyStatusForZone(zone) {
    const explicit = normalizeEnergyStatus(zone && zone.energyStatus);
    if (explicit) return explicit;
    const load = zone && Number.isFinite(zone.loadPercent) ? zone.loadPercent :
      zone && Number.isFinite(zone.currentDemandKw) && Number.isFinite(zone.referenceDemandKw) && zone.referenceDemandKw > 0
        ? zone.currentDemandKw / zone.referenceDemandKw * 100
        : zone && Number.isFinite(zone.demandKw) && Number.isFinite(zone.referenceDemandKw) && zone.referenceDemandKw > 0
          ? zone.demandKw / zone.referenceDemandKw * 100
          : null;
    if (load === null) return "normal";
    return load >= 90 ? "critical" : load >= 70 ? "warning" : "normal";
  }

  function matchesFacilityType(facility) {
    return state.selectedFacilityType === "all" || normalizeFacilityCategory(facility.category) === state.selectedFacilityType;
  }

  function normalizeFacilityCategory(value) {
    const normalized = normalizeKey(value);
    if (["minsa", "hospitalminsa", "publicminsa"].includes(normalized)) return "minsa";
    if (["essalud", "hospitalessalud", "policlinicoessalud"].includes(normalized)) return "essalud";
    if (["mall", "shoppingcenter", "centrocomercial", "shopping"].includes(normalized)) return "mall";
    return "clinic";
  }

  function facilityCategoryLabel(category) {
    const normalized = normalizeFacilityCategory(category);
    if (normalized === "minsa") return "MINSA";
    if (normalized === "essalud") return "EsSalud";
    if (normalized === "mall") return "Centro comercial";
    return "Clínica privada";
  }

  function facilityMarkerSymbol(category) {
    const normalized = normalizeFacilityCategory(category);
    if (normalized === "minsa") return "M";
    if (normalized === "essalud") return "E";
    if (normalized === "mall") return "▦";
    return "+";
  }

  function normalizeEnergyStatus(value) {
    const normalized = normalizeKey(value);
    if (["critical", "critico", "critica", "red", "rojo"].includes(normalized)) return "critical";
    if (["warning", "attention", "atencion", "yellow", "amarillo"].includes(normalized)) return "warning";
    if (["normal", "ok", "green", "verde"].includes(normalized)) return "normal";
    return "";
  }

  function energyStatusColor(status) {
    return status === "critical" ? "#dc2626" : status === "warning" ? "#f59e0b" : "#16a34a";
  }

  function energyStatusLabel(status) {
    return status === "critical" ? "CRÍTICO" : status === "warning" ? "ATENCIÓN" : "NORMAL";
  }

  function mapStatusLabel(status) {
    return status === "online" ? "En línea" : status === "warning" ? "Atención" : "Sin conexión";
  }

  function telemetryState(meter) {
    if (!meter) return "nodata";
    const rawStatus = normalizeKey(meter.rawStatus || "");
    if (["maintenance", "mantenimiento"].includes(rawStatus)) return "maintenance";
    if (meter.status === "offline") return "offline";
    if (!meter.lastSeen || !(meter.lastSeen instanceof Date) || Number.isNaN(meter.lastSeen.getTime())) return "nodata";
    const ageMs = Math.max(0, Date.now() - meter.lastSeen.getTime());
    return ageMs <= TELEMETRY_FRESH_MS ? "fresh" : "stale";
  }

  function telemetryLabel(status) {
    if (status === "fresh") return "En línea";
    if (status === "stale") return "Lectura retrasada";
    if (status === "maintenance") return "Mantenimiento";
    if (status === "nodata") return "Sin datos";
    return "Sin conexión";
  }

  function telemetryStatusClass(status) {
    if (status === "fresh") return "online";
    if (status === "stale" || status === "maintenance") return "warning";
    return "offline";
  }

  function telemetryAgeLabel(date) {
    if (!date || !(date instanceof Date) || Number.isNaN(date.getTime())) return "Sin lectura válida";
    const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
    if (seconds < 60) return "Hace " + seconds + " s";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return "Hace " + minutes + (minutes === 1 ? " min" : " min");
    const hours = Math.floor(minutes / 60);
    return "Hace " + hours + (hours === 1 ? " h" : " h");
  }

  function mapMeterAriaLabel(meter) {
    return meter.name + ", " + (meter.zoneName || zoneNameById(meter.zoneId) || "sin distrito") + ", " + telemetryLabel(telemetryState(meter)) + ", demanda " + formatCompact(meter.currentPowerKw, "kW");
  }

  function renderZoneSelector() {
    const zones = availableZones();
    const previous = state.selectedZone;
    const options = ['<option value="all">Todos los distritos</option>'].concat(zones.map(function (zone) {
      return '<option value="' + escapeHtml(zone.id) + '">' + escapeHtml(zone.name) + "</option>";
    }));
    el.zoneSelect.innerHTML = options.join("");
    const exists = previous === "all" || zones.some(function (zone) { return String(zone.id) === String(previous); });
    state.selectedZone = exists ? previous : "all";
    el.zoneSelect.value = state.selectedZone;
  }

  function renderMetrics() {
    const meters = filteredMeters();
    const alerts = filteredAlerts();
    const points = buildChartPoints();
    const dashboard = state.dashboard || {};
    const allZones = state.selectedZone === "all";

    let demand = readNumber(dashboard, ["currentDemandKw", "currentDemand", "demandKw", "liveDemandKw", "totalPowerKw", "totalDemandKw"]);
    if (!allZones || demand === null) {
      const selectedZone = selectedZoneSummary();
      const meterDemand = sumKnown(meters, "demandKw");
      demand = selectedZone && selectedZone.demandKw !== null ? selectedZone.demandKw : (meterDemand !== null ? meterDemand : (points.length ? points[points.length - 1].value : null));
    }

    let energy = readNumber(dashboard, ["energyTodayKwh", "dailyEnergyKwh", "todayConsumptionKwh", "totalConsumptionTodayKwh", "consumptionTodayKwh", "totalEnergyKwh"]);
    if (!allZones || energy === null) {
      const selectedZone = selectedZoneSummary();
      energy = selectedZone && selectedZone.energyTodayKwh !== null ? selectedZone.energyTodayKwh : sumKnown(meters, "energyTodayKwh");
    }

    const telemetryStates = meters.map(telemetryState);
    const freshCount = telemetryStates.filter(function (status) { return status === "fresh"; }).length;
    const staleCount = telemetryStates.filter(function (status) { return status === "stale"; }).length;
    const noDataCount = telemetryStates.filter(function (status) { return status === "nodata"; }).length;
    const maintenanceCount = telemetryStates.filter(function (status) { return status === "maintenance"; }).length;
    const offlineCount = telemetryStates.filter(function (status) { return status === "offline"; }).length;
    const totalMetersFromDashboard = readNumber(dashboard, ["totalMeters", "meterCount", "metersTotal"]);
    const total = allZones && totalMetersFromDashboard !== null ? totalMetersFromDashboard : meters.length;
    const active = freshCount;

    const unresolved = alerts.filter(function (alert) { return alert.active; });
    const alertCountFromDashboard = readNumber(dashboard, ["activeAlerts", "alertCount", "unresolvedAlerts", "openAlerts"]);
    const activeAlertCount = allZones && alertCountFromDashboard !== null ? alertCountFromDashboard : unresolved.length;
    const criticalCount = unresolved.filter(function (alert) { return alert.severity === "critical"; }).length;

    setMetric(el.currentDemand, demand, "kW", 1);
    setMetric(el.energyToday, energy, "kWh", 1);
    el.onlineMeters.textContent = total ? integerFormat.format(active || 0) + " / " + integerFormat.format(total) : "0";
    el.activeAlerts.textContent = integerFormat.format(activeAlertCount || 0);

    if (points.length > 1) {
      const latest = points[points.length - 1].value;
      const prior = points[points.length - 2].value;
      const delta = prior ? ((latest - prior) / prior) * 100 : 0;
      el.demandTrend.textContent = (delta > 0 ? "+" : "") + numberFormat.format(delta) + "% frente a la lectura anterior";
      el.demandTrend.className = "metric-card__meta " + (delta > 5 ? "is-negative" : delta < -5 ? "is-positive" : "");
    } else {
      el.demandTrend.textContent = points.length ? "Última lectura disponible" : "Esperando lecturas";
      el.demandTrend.className = "metric-card__meta";
    }
    el.energyMeta.textContent = allZones ? "Acumulado de Lima Centro" : "Acumulado del distrito seleccionado";
    if (!total) {
      el.metersMeta.textContent = "No hay medidores registrados";
    } else if (state.apiStatus === "offline") {
      el.metersMeta.textContent = "API sin conexión · datos congelados";
    } else {
      const audit = [];
      audit.push(integerFormat.format(freshCount) + " frescos");
      if (maintenanceCount) audit.push(integerFormat.format(maintenanceCount) + " mantenimiento");
      if (staleCount) audit.push(integerFormat.format(staleCount) + " retrasados");
      if (noDataCount) audit.push(integerFormat.format(noDataCount) + " sin datos");
      if (offlineCount) audit.push(integerFormat.format(offlineCount) + " sin conexión");
      el.metersMeta.textContent = audit.join(" · ");
    }
    el.alertsMeta.textContent = criticalCount ? integerFormat.format(criticalCount) + (criticalCount === 1 ? " crítica" : " críticas") : "Sin alertas críticas";
  }

  function renderZones() {
    const zones = availableZones();
    const visible = state.selectedZone === "all" ? zones : zones.filter(function (zone) { return String(zone.id) === String(state.selectedZone); });
    el.zonesTotal.textContent = visible.length + (visible.length === 1 ? " distrito" : " distritos") + " · semáforo 70/90%";

    const values = visible.map(function (zone) {
      const zoneMeters = state.meters.filter(function (meter) { return sameZone(meter, zone.id, zone.name); });
      const meterDemand = sumKnown(zoneMeters, "demandKw");
      const demand = zone.demandKw !== null ? zone.demandKw : (meterDemand || 0);
      const energy = zone.energyTodayKwh !== null ? zone.energyTodayKwh : (sumKnown(zoneMeters, "energyTodayKwh") || 0);
      const reference = Number.isFinite(zone.referenceDemandKw) ? zone.referenceDemandKw : (Number.isFinite(zone.capacityKw) ? zone.capacityKw : null);
      const loadPercent = Number.isFinite(zone.loadPercent) ? zone.loadPercent : (reference && reference > 0 ? demand / reference * 100 : null);
      const status = energyStatusForZone(Object.assign({}, zone, { demandKw: demand, currentDemandKw: demand, referenceDemandKw: reference, loadPercent: loadPercent }));
      return Object.assign({}, zone, { demandKw: demand, energyTodayKwh: energy, referenceDemandKw: reference, loadPercent: loadPercent, energyStatus: status });
    });

    if (!values.length) {
      el.zoneBars.innerHTML = emptyState("⌁", "Sin distritos disponibles", "Los distritos aparecerán cuando la API reporte datos.");
      return;
    }

    el.zoneBars.innerHTML = values.map(function (zone) {
      const status = energyStatusForZone(zone);
      const load = Number.isFinite(zone.loadPercent) ? zone.loadPercent : 0;
      const percentage = Math.max(zone.demandKw > 0 ? 4 : 0, Math.min(100, load));
      const referenceText = Number.isFinite(zone.referenceDemandKw) ? "Referencia " + formatCompact(zone.referenceDemandKw, "kW") : "Referencia no disponible";
      const loadText = Number.isFinite(zone.loadPercent) ? numberFormat.format(zone.loadPercent) + "% de carga" : "Carga no disponible";
      return '<div class="zone-row zone-row--' + status + '">' +
        '<div class="zone-row__top"><span class="zone-row__name"><i class="energy-light energy-light--' + status + '" aria-hidden="true"></i>' + escapeHtml(zone.name) + '</span><span class="energy-badge energy-badge--' + status + '">' + escapeHtml(energyStatusLabel(status)) + '</span><span class="zone-row__value">' + formatCompact(zone.demandKw, "kW") + "</span></div>" +
        '<div class="zone-row__track" role="progressbar" aria-label="Carga energética de ' + escapeHtml(zone.name) + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(Math.min(100, load)) + '"><div class="zone-row__fill zone-row__fill--' + status + '" style="width:' + percentage.toFixed(1) + '%"></div></div>' +
        '<div class="zone-row__meta"><span>' + escapeHtml(referenceText) + " · " + escapeHtml(loadText) + '</span><span>' + formatCompact(zone.energyTodayKwh, "kWh") + " hoy</span></div>" +
      "</div>";
    }).join("");
  }

  function renderFacilities() {
    const source = state.facilities.length ? state.facilities : (state.mapData && state.mapData.facilities ? state.mapData.facilities : []);
    const visible = source.filter(matchesSelectedZone).filter(matchesFacilityType);
    const countBy = function (category) { return visible.filter(function (facility) { return facility.category === category; }).length; };

    el.facilityCount.textContent = integerFormat.format(visible.length);
    el.facilityMinsaCount.textContent = integerFormat.format(countBy("minsa"));
    el.facilityEssaludCount.textContent = integerFormat.format(countBy("essalud"));
    el.facilityClinicCount.textContent = integerFormat.format(countBy("clinic"));
    el.facilityMallCount.textContent = integerFormat.format(countBy("mall"));

    if (!visible.length) {
      el.facilitiesBody.innerHTML = '<tr class="table-empty"><td colspan="7">No hay infraestructura para los filtros seleccionados.</td></tr>';
      return;
    }

    el.facilitiesBody.innerHTML = visible.map(function (facility) {
      const status = normalizeEnergyStatus(facility.energyStatus) || "normal";
      return '<tr data-facility-id="' + escapeHtml(facility.id) + '"><td data-label="Establecimiento"><button class="facility-name-button" type="button" data-facility-focus="' + escapeHtml(facility.id) + '"><strong>' + escapeHtml(facility.name) + '</strong><small>' + escapeHtml(facility.address || "") + '</small></button></td>' +
        '<td data-label="Tipo / red"><span class="facility-type facility-type--' + facility.category + '">' + escapeHtml(facilityCategoryLabel(facility.category)) + '</span><small class="facility-network">' + escapeHtml(facility.network || "") + '</small></td>' +
        '<td data-label="Distrito">' + escapeHtml(facility.zoneName || zoneNameById(facility.zoneId) || "—") + '</td>' +
        '<td data-label="Demanda">' + escapeHtml(formatCompact(facility.currentDemandKw, "kW")) + '</td>' +
        '<td data-label="Carga">' + escapeHtml(numberFormat.format(facility.loadPercent)) + '%</td>' +
        '<td data-label="Semáforo"><span class="energy-chip energy-chip--' + status + '">' + escapeHtml(energyStatusLabel(status)) + '</span></td>' +
        '<td data-label="Conexión"><span class="status-pill status-pill--online">Conectado</span><small class="facility-simulated">' + (facility.isSimulated ? "simulado" : "real") + '</small></td></tr>';
    }).join("");

    el.facilitiesBody.querySelectorAll("[data-facility-focus]").forEach(function (button) {
      button.addEventListener("click", function () {
        const id = button.getAttribute("data-facility-focus");
        selectMapFacility(id);
        const target = document.getElementById("districtMap");
        if (target) target.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    });
  }

  function renderMeters() {
    const meters = filteredMeters();
    el.metersCount.textContent = meters.length + (meters.length === 1 ? " medidor" : " medidores");
    if (!meters.length) {
      el.metersBody.innerHTML = '<tr class="table-empty"><td colspan="6">No hay medidores para la zona seleccionada.</td></tr>';
      return;
    }

    el.metersBody.innerHTML = meters.map(function (meter) {
      const telemetry = telemetryState(meter);
      const statusClass = telemetryStatusClass(telemetry);
      const ageLabel = telemetryAgeLabel(meter.lastSeen);
      return "<tr>" +
        '<td data-label="Medidor"><span class="meter-name"><strong>' + escapeHtml(meter.name) + "</strong><small>" + escapeHtml(meter.code) + "</small></span></td>" +
        '<td data-label="Distrito">' + escapeHtml(meter.zoneName || zoneNameById(meter.zoneId) || "Sin asignar") + "</td>" +
        '<td data-label="Voltaje">' + formatCompact(meter.voltageV, "V") + "</td>" +
        '<td data-label="Demanda">' + formatCompact(meter.demandKw, "kW") + "</td>" +
        '<td data-label="Estado"><span class="status-pill status-pill--' + statusClass + '">' + escapeHtml(telemetryLabel(telemetry)) + "</span></td>" +
        '<td data-label="Último reporte"><span class="reading-time">' + escapeHtml(formatDateTime(meter.lastSeen)) + '</span><small class="reading-age reading-age--' + statusClass + '">' + escapeHtml(ageLabel) + "</small></td>" +
      "</tr>";
    }).join("");
  }

  function renderAlerts() {
    const alerts = filteredAlerts().filter(function (alert) { return alert.active; });
    el.alertsCount.textContent = String(alerts.length);
    el.alertsCount.setAttribute("aria-label", alerts.length + (alerts.length === 1 ? " alerta activa" : " alertas activas"));

    if (!alerts.length) {
      el.alertList.innerHTML = emptyState("✓", "Todo bajo control", "No hay alertas activas para la selección actual.");
      return;
    }

    el.alertList.innerHTML = alerts.slice(0, 20).map(function (alert) {
      const telemetry = [];
      if (Number.isFinite(alert.value)) telemetry.push("Valor " + numberFormat.format(alert.value));
      if (Number.isFinite(alert.threshold)) telemetry.push("umbral " + numberFormat.format(alert.threshold));
      return '<article class="alert-item alert-item--' + alert.severity + '">' +
        '<span class="alert-item__mark" aria-hidden="true"></span>' +
        '<div><div class="alert-item__header"><h3>' + escapeHtml(alert.title) + '</h3><time datetime="' + escapeHtml(alert.dateIso || "") + '">' + escapeHtml(relativeTime(alert.timestamp)) + "</time></div>" +
        (alert.message ? "<p>" + escapeHtml(alert.message) + "</p>" : "") +
        '<div class="alert-item__footer"><span class="alert-item__zone">' + escapeHtml(alert.zoneName || zoneNameById(alert.zoneId) || "Lima Centro") + '</span>' +
        (telemetry.length ? '<span class="alert-item__telemetry">' + escapeHtml(telemetry.join(" · ")) + "</span>" : "") + '</div></div>' +
      "</article>";
    }).join("");
  }

  function renderDemandChart() {
    state.chartPoints = buildChartPoints();
    const selected = selectedZoneSummary();
    if (el.chartLegendLabel) el.chartLegendLabel.textContent = state.selectedZone === "all" ? "Demanda total de Lima Centro (kW)" : "Demanda de " + (selected ? selected.name : "distrito") + " (kW)";
    const values = state.chartPoints.map(function (point) { return point.value; });
    const peak = values.length ? Math.max.apply(null, values) : null;
    const average = values.length ? values.reduce(function (sum, value) { return sum + value; }, 0) / values.length : null;
    el.peakDemand.textContent = peak === null ? "—" : formatCompact(peak, "kW");
    el.averageDemand.textContent = average === null ? "—" : formatCompact(average, "kW");
    el.chartEmpty.hidden = values.length > 0;
    el.demandChart.hidden = values.length === 0;

    const tbody = el.chartDataTable.querySelector("tbody");
    tbody.innerHTML = state.chartPoints.map(function (point) {
      return "<tr><td>" + escapeHtml(point.label) + "</td><td>" + escapeHtml(formatCompact(point.value, "kW")) + "</td></tr>";
    }).join("");

    if (values.length) {
      const latest = state.chartPoints[state.chartPoints.length - 1];
      el.demandChart.setAttribute("aria-label", "Gráfico de demanda con " + values.length + " lecturas. Pico de " + formatCompact(peak, "kW") + ". Última lectura: " + latest.label + ", " + formatCompact(latest.value, "kW") + ". Use las flechas izquierda y derecha para explorar.");
    } else {
      el.demandChart.setAttribute("aria-label", "No hay lecturas de demanda disponibles.");
    }
    window.requestAnimationFrame(drawChart);
  }

  function drawChart() {
    const canvas = el.demandChart;
    if (!canvas || canvas.hidden || !state.chartPoints.length) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const compact = rect.width < 520;
    const padding = { top: 18, right: 14, bottom: 32, left: compact ? 38 : 48 };
    const plotWidth = rect.width - padding.left - padding.right;
    const plotHeight = rect.height - padding.top - padding.bottom;
    const values = state.chartPoints.map(function (point) { return point.value; });
    const rawMax = Math.max.apply(null, values.concat([1]));
    const axisMax = niceMaximum(rawMax * 1.12);

    ctx.font = (compact ? "9px" : "10px") + ' Inter, "Segoe UI", sans-serif';
    ctx.textBaseline = "middle";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i += 1) {
      const y = padding.top + (plotHeight / 4) * i;
      const value = axisMax - (axisMax / 4) * i;
      ctx.strokeStyle = i === 4 ? "#dce6ed" : "#e8eef2";
      ctx.beginPath();
      ctx.moveTo(padding.left, Math.round(y) + 0.5);
      ctx.lineTo(rect.width - padding.right, Math.round(y) + 0.5);
      ctx.stroke();
      ctx.fillStyle = "#7c8c9d";
      ctx.textAlign = "right";
      ctx.fillText(compactNumber(value), padding.left - 8, y);
    }

    const count = state.chartPoints.length;
    const positions = state.chartPoints.map(function (point, index) {
      const x = count === 1 ? padding.left + plotWidth / 2 : padding.left + (plotWidth * index) / (count - 1);
      const y = padding.top + plotHeight - (point.value / axisMax) * plotHeight;
      return { x: x, y: y, point: point };
    });
    state.chartPositions = positions;

    const labelStep = Math.max(1, Math.ceil(count / (compact ? 4 : 6)));
    positions.forEach(function (position, index) {
      if (index % labelStep !== 0 && index !== count - 1) return;
      ctx.fillStyle = "#7c8c9d";
      ctx.textAlign = index === 0 ? "left" : index === count - 1 ? "right" : "center";
      ctx.fillText(position.point.shortLabel, position.x, rect.height - 12);
    });

    const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + plotHeight);
    gradient.addColorStop(0, "rgba(48, 104, 232, 0.24)");
    gradient.addColorStop(1, "rgba(48, 104, 232, 0.015)");
    ctx.beginPath();
    positions.forEach(function (position, index) {
      if (index === 0) ctx.moveTo(position.x, position.y);
      else ctx.lineTo(position.x, position.y);
    });
    ctx.lineTo(positions[positions.length - 1].x, padding.top + plotHeight);
    ctx.lineTo(positions[0].x, padding.top + plotHeight);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.beginPath();
    positions.forEach(function (position, index) {
      if (index === 0) ctx.moveTo(position.x, position.y);
      else ctx.lineTo(position.x, position.y);
    });
    ctx.strokeStyle = "#3068e8";
    ctx.lineWidth = 2.4;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();

    positions.forEach(function (position, index) {
      if (count > 14 && index !== count - 1 && index !== state.chartFocus) return;
      ctx.beginPath();
      ctx.arc(position.x, position.y, index === state.chartFocus ? 4.5 : 3, 0, Math.PI * 2);
      ctx.fillStyle = index === state.chartFocus ? "#0b1f33" : "#ffffff";
      ctx.fill();
      ctx.strokeStyle = "#3068e8";
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    if (state.chartFocus >= 0 && positions[state.chartFocus]) showChartTooltip(state.chartFocus);
  }

  function onChartPointerMove(event) {
    if (!state.chartPositions.length) return;
    const rect = el.demandChart.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    let nearest = 0;
    let distance = Infinity;
    state.chartPositions.forEach(function (position, index) {
      const current = Math.abs(position.x - pointerX);
      if (current < distance) { distance = current; nearest = index; }
    });
    state.chartFocus = nearest;
    drawChart();
  }

  function onChartFocus() {
    if (!state.chartPoints.length) return;
    state.chartFocus = state.chartFocus < 0 ? state.chartPoints.length - 1 : state.chartFocus;
    drawChart();
  }

  function onChartKeydown(event) {
    if (!state.chartPoints.length || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const current = state.chartFocus < 0 ? state.chartPoints.length - 1 : state.chartFocus;
    state.chartFocus = Math.max(0, Math.min(state.chartPoints.length - 1, current + direction));
    drawChart();
  }

  function showChartTooltip(index) {
    const position = state.chartPositions[index];
    if (!position) return;
    el.chartTooltip.innerHTML = escapeHtml(position.point.label) + "<strong>" + escapeHtml(formatCompact(position.point.value, "kW")) + "</strong>";
    el.chartTooltip.style.left = position.x + "px";
    el.chartTooltip.style.top = Math.max(55, position.y) + "px";
    el.chartTooltip.hidden = false;
  }

  function hideChartTooltip() {
    state.chartFocus = -1;
    el.chartTooltip.hidden = true;
    drawChart();
  }

  function buildChartPoints() {
    if (state.selectedZone === "all") {
      const dashboardTrend = readValue(state.dashboard, ["demandTrend", "trend", "hourlyDemand"], [], false);
      if (Array.isArray(dashboardTrend) && dashboardTrend.length) {
        const normalizedTrend = normalizeReadings(dashboardTrend).filter(function (reading) { return reading.demandKw !== null; });
        if (normalizedTrend.length) return pointsFromReadings(normalizedTrend);
      }
    } else {
      const trendByZone = readValue(state.dashboard, ["demandTrendByZone", "trendByZone", "demandByZone"], {}, false);
      if (trendByZone && typeof trendByZone === "object" && !Array.isArray(trendByZone)) {
        const key = Object.keys(trendByZone).find(function (candidate) { return normalizeKey(candidate) === normalizeKey(state.selectedZone); });
        const districtTrend = key ? trendByZone[key] : null;
        if (Array.isArray(districtTrend) && districtTrend.length) {
          const normalizedDistrictTrend = normalizeReadings(districtTrend).filter(function (reading) { return reading.demandKw !== null; });
          if (normalizedDistrictTrend.length) return pointsFromReadings(normalizedDistrictTrend);
        }
      }
    }

    const readings = state.readings.filter(matchesSelectedZone).filter(function (reading) {
      return reading.demandKw !== null && Number.isFinite(reading.demandKw);
    });
    if (!readings.length) return [];

    return pointsFromReadings(readings);
  }

  function pointsFromReadings(readings) {

    const dated = readings.filter(function (reading) { return reading.timestamp instanceof Date && !Number.isNaN(reading.timestamp.getTime()); });
    if (!dated.length) {
      return readings.slice(-24).map(function (reading, index) {
        return { value: reading.demandKw, label: reading.label || "Lectura " + (index + 1), shortLabel: reading.shortLabel || String(index + 1) };
      });
    }

    const buckets = new Map();
    dated.forEach(function (reading) {
      const timestamp = new Date(reading.timestamp);
      const key = timestamp.toISOString();
      if (!buckets.has(key)) buckets.set(key, { timestamp: timestamp, value: 0 });
      buckets.get(key).value += reading.demandKw;
    });
    return Array.from(buckets.values()).sort(function (a, b) { return a.timestamp - b.timestamp; }).slice(-96).map(function (bucket) {
      return { timestamp: bucket.timestamp, value: bucket.value, label: dateTimeFormat.format(bucket.timestamp), shortLabel: timeFormat.format(bucket.timestamp) };
    });
  }

  function normalizeMap(payload) {
    const source = unwrapObject(payload, ["map"]);
    const districtRaw = readValue(source, ["district"], "", false);
    const district = districtRaw && typeof districtRaw === "object"
      ? String(readValue(districtRaw, ["name", "districtName", "label"], ""))
      : stringOrEmpty(districtRaw);
    const generatedAt = parseDate(readValue(source, ["generatedAtUtc", "generatedAt", "timestampUtc"], null, false));
    const viewportRaw = readValue(source, ["viewport", "bounds", "mapViewport"], {}, false) || {};
    const viewport = {
      centerLatitude: readNumber(viewportRaw, ["centerLatitude", "latitude", "centerLat"]),
      centerLongitude: readNumber(viewportRaw, ["centerLongitude", "longitude", "centerLng", "centerLon"]),
      minLatitude: readNumber(viewportRaw, ["minLatitude", "south", "minLat"]),
      minLongitude: readNumber(viewportRaw, ["minLongitude", "west", "minLng", "minLon"]),
      maxLatitude: readNumber(viewportRaw, ["maxLatitude", "north", "maxLat"]),
      maxLongitude: readNumber(viewportRaw, ["maxLongitude", "east", "maxLng", "maxLon"])
    };

    const zones = getCollection(source, ["zones", "areas", "sectors"]).map(function (raw, index) {
      const id = readValue(raw, ["id", "zoneId", "code"], String(index + 1));
      return {
        id: String(id),
        name: String(readValue(raw, ["name", "zoneName", "label"], "Distrito " + (index + 1))),
        sector: stringOrEmpty(readValue(raw, ["sector", "sectorName", "description"], "")),
        color: stringOrEmpty(readValue(raw, ["color", "hexColor"], "")),
        latitude: readNumber(raw, ["centerLatitude", "latitude", "lat"]),
        longitude: readNumber(raw, ["centerLongitude", "longitude", "lng", "lon"]),
        currentDemandKw: readNumber(raw, ["currentDemandKw", "demandKw", "powerKw"]),
        referenceDemandKw: readNumber(raw, ["referenceDemandKw", "typicalDemandKw", "capacityKw", "referenceKw"]),
        loadPercent: readNumber(raw, ["loadPercent", "utilizationPercent", "usagePercent"]),
        energyStatus: stringOrEmpty(readValue(raw, ["energyStatus", "trafficLight", "semaphoreStatus", "statusEnergy"], "")),
        activeAlerts: readNumber(raw, ["activeAlerts", "alertCount", "alerts"])
      };
    });

    const meters = getCollection(source, ["meters", "devices", "nodes"]).map(function (raw, index) {
      const id = readValue(raw, ["id", "meterId", "deviceId", "nodeId"], String(index + 1));
      return {
        id: String(id),
        name: String(readValue(raw, ["name", "meterName", "deviceName", "label"], "Medidor " + id)),
        zoneId: stringOrEmpty(readValue(raw, ["zoneId", "areaId", "sectorId"], "")),
        zoneName: stringOrEmpty(readValue(raw, ["zoneName", "areaName", "sectorName", "zone"], "")),
        latitude: readNumber(raw, ["latitude", "lat"]),
        longitude: readNumber(raw, ["longitude", "lng", "lon"]),
        rawStatus: String(readValue(raw, ["status", "connectionStatus", "state", "online"], "offline")),
        status: normalizeMeterStatus(readValue(raw, ["status", "connectionStatus", "state", "online"], "offline")),
        currentPowerKw: readNumber(raw, ["currentPowerKw", "currentDemandKw", "demandKw", "powerKw", "power"]),
        voltageV: readNumber(raw, ["voltageV", "voltage", "currentVoltageV"]),
        powerFactor: readNumber(raw, ["powerFactor", "pf"]),
        lastSeen: parseDate(readValue(raw, ["lastReadingUtc", "lastSeen", "lastReadingAt", "updatedAt", "timestampUtc"], null)),
        hardwareModel: stringOrEmpty(readValue(raw, ["hardwareModel", "hardware", "boardModel"], "")),
        firmwareVersion: stringOrEmpty(readValue(raw, ["firmwareVersion", "firmware", "version"], ""))
      };
    });

    const facilities = getCollection(source, ["facilities", "infrastructure", "priorityFacilities"]).map(normalizeFacility);

    return {
      district: district,
      generatedAt: generatedAt,
      viewport: viewport,
      zones: zones,
      meters: meters,
      facilities: facilities
    };
  }

  function normalizeFacility(raw, index) {
    const id = readValue(raw, ["id", "facilityId", "code"], String((index || 0) + 1));
    return {
      id: String(id),
      zoneId: stringOrEmpty(readValue(raw, ["zoneId", "districtId"], "")),
      zoneName: stringOrEmpty(readValue(raw, ["zoneName", "districtName"], "")),
      name: String(readValue(raw, ["name", "facilityName", "label"], "Infraestructura " + id)),
      category: normalizeFacilityCategory(readValue(raw, ["category", "type"], "clinic")),
      network: stringOrEmpty(readValue(raw, ["network", "operator", "provider"], "")),
      address: stringOrEmpty(readValue(raw, ["address", "location"], "")),
      latitude: readNumber(raw, ["latitude", "lat"]),
      longitude: readNumber(raw, ["longitude", "lng", "lon"]),
      ratedPowerKw: readNumber(raw, ["ratedPowerKw", "referencePowerKw", "capacityKw"]),
      currentDemandKw: readNumber(raw, ["currentDemandKw", "demandKw", "powerKw"]),
      loadPercent: readNumber(raw, ["loadPercent", "utilizationPercent"]),
      energyStatus: stringOrEmpty(readValue(raw, ["energyStatus", "statusEnergy"], "")),
      connectionStatus: stringOrEmpty(readValue(raw, ["connectionStatus", "status"], "online")),
      isSimulated: Boolean(readValue(raw, ["isSimulated", "simulated"], true, false)),
      locationNote: stringOrEmpty(readValue(raw, ["locationNote", "note"], ""))
    };
  }

  function normalizeFacilities(payload) {
    return getCollection(payload, ["facilities", "infrastructure", "items", "results"]).map(normalizeFacility);
  }

  function normalizeZones(payload) {
    return getCollection(payload, ["zones", "items", "results"]).map(function (raw, index) {
      const id = readValue(raw, ["id", "zoneId", "code", "zoneCode"], String(index + 1));
      return {
        id: String(id),
        name: String(readValue(raw, ["name", "zoneName", "label", "description"], "Distrito " + (index + 1))),
        demandKw: readNumber(raw, ["currentDemandKw", "demandKw", "currentDemand", "powerKw", "totalPowerKw"]),
        energyTodayKwh: readNumber(raw, ["energyTodayKwh", "consumptionTodayKwh", "dailyEnergyKwh", "totalConsumptionKwh"]),
        referenceDemandKw: readNumber(raw, ["referenceDemandKw", "typicalDemandKw", "capacityKw", "referenceKw"]),
        capacityKw: readNumber(raw, ["capacityKw", "maxDemandKw", "limitKw", "contractedPowerKw"]),
        loadPercent: readNumber(raw, ["loadPercent", "utilizationPercent", "usagePercent"]),
        energyStatus: stringOrEmpty(readValue(raw, ["energyStatus", "trafficLight", "semaphoreStatus", "statusEnergy"], "")),
        activeAlerts: readNumber(raw, ["activeAlerts", "alertCount", "alerts"])
      };
    });
  }

  function normalizeMeters(payload) {
    return getCollection(payload, ["meters", "devices", "items", "results"]).map(function (raw, index) {
      const id = readValue(raw, ["id", "meterId", "deviceId", "code", "serialNumber"], String(index + 1));
      const statusValue = String(readValue(raw, ["status", "connectionStatus", "state", "online"], "offline"));
      return {
        id: String(id),
        code: String(readValue(raw, ["code", "serialNumber", "meterCode", "deviceCode"], "ID " + id)),
        name: String(readValue(raw, ["name", "meterName", "label", "displayName"], "Medidor " + id)),
        zoneId: stringOrEmpty(readValue(raw, ["zoneId", "areaId", "sectorId"], "")),
        zoneName: stringOrEmpty(readValue(raw, ["zoneName", "areaName", "sectorName", "zone"], "")),
        demandKw: readNumber(raw, ["currentDemandKw", "demandKw", "powerKw", "currentPowerKw", "currentLoadKw", "power"]),
        energyTodayKwh: readNumber(raw, ["energyTodayKwh", "consumptionTodayKwh", "dailyConsumptionKwh", "todayKwh", "energyKwh"]),
        voltageV: readNumber(raw, ["voltageV", "voltage", "currentVoltageV"]),
        rawStatus: statusValue,
        status: normalizeMeterStatus(statusValue),
        lastSeen: parseDate(readValue(raw, ["lastReadingUtc", "lastSeen", "lastReadingAt", "lastUpdate", "updatedAt", "timestampUtc", "timestamp"], null))
      };
    });
  }

  function normalizeReadings(payload) {
    let collection = getCollection(payload, ["readings", "measurements", "dataPoints", "items", "results"]);
    if (!collection.length && payload && typeof payload === "object") {
      const labels = readValue(payload, ["labels", "timestamps", "hours"], []);
      const values = readValue(payload, ["values", "demand", "series"], []);
      if (Array.isArray(labels) && Array.isArray(values)) collection = values.map(function (value, index) { return { timestamp: labels[index], value: value }; });
    }
    return collection.map(function (raw, index) {
      if (typeof raw === "number") return { demandKw: raw, timestamp: null, label: "Lectura " + (index + 1), shortLabel: String(index + 1), zoneId: "", zoneName: "" };
      const rawTimestamp = readValue(raw, ["timestampUtc", "timestamp", "recordedAt", "measuredAt", "createdAt", "dateTime", "time", "hour"], null);
      return {
        demandKw: readNumber(raw, ["demandKw", "powerKw", "currentDemandKw", "totalPowerKw", "kw", "value", "demand"]),
        energyKwh: readNumber(raw, ["energyKwh", "consumptionKwh", "kwh"]),
        timestamp: parseDate(rawTimestamp),
        label: rawTimestamp ? String(rawTimestamp) : "Lectura " + (index + 1),
        shortLabel: readValue(raw, ["label", "hourLabel"], String(index + 1)),
        meterId: stringOrEmpty(readValue(raw, ["meterId", "deviceId"], "")),
        zoneId: stringOrEmpty(readValue(raw, ["zoneId", "areaId", "sectorId"], "")),
        zoneName: stringOrEmpty(readValue(raw, ["zoneName", "areaName", "sectorName", "zone"], ""))
      };
    });
  }

  function normalizeAlerts(payload) {
    return getCollection(payload, ["alerts", "notifications", "incidents", "items", "results"]).map(function (raw, index) {
      const severityRaw = String(readValue(raw, ["severity", "level", "priority", "type"], "info"));
      const statusRaw = String(readValue(raw, ["status", "state"], "active"));
      const acknowledged = readValue(raw, ["acknowledged", "resolved", "isResolved", "closed"], false);
      const explicitActive = readValue(raw, ["isActive", "active", "open"], null, false);
      const timestamp = parseDate(readValue(raw, ["createdAtUtc", "timestampUtc", "timestamp", "createdAt", "raisedAt", "occurredAt", "date"], null));
      const type = String(readValue(raw, ["type", "alertType"], ""));
      return {
        id: String(readValue(raw, ["id", "alertId"], index + 1)),
        title: String(readValue(raw, ["title", "name", "subject"], alertTypeLabel(type))),
        message: stringOrEmpty(readValue(raw, ["message", "description", "detail", "details"], "")),
        severity: normalizeSeverity(severityRaw),
        type: type,
        value: readNumber(raw, ["value", "measuredValue", "currentValue"]),
        threshold: readNumber(raw, ["threshold", "limit", "thresholdValue"]),
        active: explicitActive === null ? !toBoolean(acknowledged) && !/[Rr]esolved|[Cc]losed|[Rr]esuelta|[Cc]errada/.test(statusRaw) : toBoolean(explicitActive),
        timestamp: timestamp,
        dateIso: timestamp ? timestamp.toISOString() : "",
        zoneId: stringOrEmpty(readValue(raw, ["zoneId", "areaId", "sectorId"], "")),
        zoneName: stringOrEmpty(readValue(raw, ["zoneName", "areaName", "sectorName", "zone"], ""))
      };
    }).sort(function (a, b) { return (b.timestamp ? b.timestamp.getTime() : 0) - (a.timestamp ? a.timestamp.getTime() : 0); });
  }

  function availableZones() {
    const byId = new Map();
    state.zones.forEach(function (zone) { byId.set(String(zone.id), zone); });
    state.meters.forEach(function (meter) {
      const id = meter.zoneId || meter.zoneName;
      if (!id || byId.has(String(id))) return;
      byId.set(String(id), { id: String(id), name: meter.zoneName || "Distrito " + id, demandKw: null, energyTodayKwh: null, referenceDemandKw: null, capacityKw: null, loadPercent: null, energyStatus: "normal" });
    });
    return Array.from(byId.values());
  }

  function filteredMeters() { return state.meters.filter(matchesSelectedZone); }
  function filteredAlerts() { return state.alerts.filter(matchesSelectedZone); }

  function selectedZoneSummary() {
    if (state.selectedZone === "all") return null;
    return availableZones().find(function (zone) { return String(zone.id) === String(state.selectedZone); }) || null;
  }

  function matchesSelectedZone(item) {
    if (state.selectedZone === "all") return true;
    const selected = availableZones().find(function (zone) { return String(zone.id) === String(state.selectedZone); });
    return sameZone(item, state.selectedZone, selected ? selected.name : "");
  }

  function sameZone(item, zoneId, zoneName) {
    const wantedId = normalizeKey(zoneId);
    const wantedName = normalizeKey(zoneName);
    return (item.zoneId && normalizeKey(item.zoneId) === wantedId) ||
      (item.id && normalizeKey(item.id) === wantedId) ||
      (item.zoneName && (normalizeKey(item.zoneName) === wantedId || normalizeKey(item.zoneName) === wantedName)) ||
      (item.name && wantedName && normalizeKey(item.name) === wantedName);
  }

  function zoneNameById(id) {
    if (!id) return "";
    const zone = availableZones().find(function (entry) { return String(entry.id) === String(id); });
    return zone ? zone.name : "";
  }

  function getCollection(payload, aliases) {
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== "object") return [];
    const direct = readValue(payload, aliases, null, false);
    if (Array.isArray(direct)) return direct;
    const envelope = readValue(payload, ["data", "result", "payload"], null, false);
    if (Array.isArray(envelope)) return envelope;
    if (envelope && typeof envelope === "object" && envelope !== payload) {
      const nested = getCollection(envelope, aliases);
      if (nested.length) return nested;
    }
    return [];
  }

  function unwrapObject(payload, aliases) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};
    const nested = readValue(payload, ["data"].concat(aliases), null, false);
    return nested && typeof nested === "object" && !Array.isArray(nested) ? nested : payload;
  }

  function readValue(object, aliases, fallback, searchContainers) {
    if (!object || typeof object !== "object") return fallback;
    const keys = Object.keys(object);
    for (let i = 0; i < aliases.length; i += 1) {
      const expected = normalizeKey(aliases[i]);
      const actual = keys.find(function (key) { return normalizeKey(key) === expected; });
      if (actual !== undefined && object[actual] !== undefined && object[actual] !== null) return object[actual];
    }
    if (searchContainers !== false) {
      const containers = ["data", "summary", "totals", "metrics", "kpis", "overview", "statistics"];
      for (let i = 0; i < containers.length; i += 1) {
        const nested = readValue(object, [containers[i]], null, false);
        if (nested && typeof nested === "object") {
          const value = readValue(nested, aliases, undefined, false);
          if (value !== undefined) return value;
        }
      }
    }
    return fallback;
  }

  function readNumber(object, aliases) {
    const raw = readValue(object, aliases, null);
    if (raw === null || raw === "" || typeof raw === "boolean") return null;
    if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
    const cleaned = String(raw).trim().replace(/\s/g, "").replace(/,(?=\d{1,2}$)/, ".").replace(/[^0-9.+-]/g, "");
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function normalizeKey(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  }

  function normalizeMeterStatus(value) {
    const normalized = normalizeKey(value);
    if (["true", "online", "active", "connected", "conectado", "enlinea", "operational", "ok"].includes(normalized)) return "online";
    if (["warning", "degraded", "maintenance", "mantenimiento", "attention", "atencion"].includes(normalized)) return "warning";
    return "offline";
  }

  function normalizeSeverity(value) {
    const normalized = normalizeKey(value);
    if (["critical", "critica", "critico", "high", "alta", "danger", "emergency"].includes(normalized)) return "critical";
    if (["warning", "advertencia", "medium", "media", "moderate"].includes(normalized)) return "warning";
    return "info";
  }

  function alertTypeLabel(value) {
    const labels = {
      highconsumption: "Consumo elevado",
      voltageanomaly: "Anomalía de voltaje",
      lowpowerfactor: "Factor de potencia bajo",
      meteroffline: "Medidor sin conexión"
    };
    return labels[normalizeKey(value)] || "Alerta de la red";
  }

  function parseDate(value) {
    if (value === null || value === undefined || value === "") return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    let date;
    if (typeof value === "number") date = new Date(value < 100000000000 ? value * 1000 : value);
    else date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function formatDateTime(date) { return date ? dateTimeFormat.format(date) : "Sin reporte"; }

  function relativeTime(date) {
    if (!date) return "Ahora";
    const minutes = Math.round((Date.now() - date.getTime()) / 60000);
    if (minutes < 1) return "Ahora";
    if (minutes < 60) return "Hace " + minutes + " min";
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return "Hace " + hours + (hours === 1 ? " h" : " h");
    return dateTimeFormat.format(date);
  }

  function setMetric(element, value, unit, decimals) {
    if (value === null || !Number.isFinite(value)) { element.textContent = "—"; return; }
    const formatter = new Intl.NumberFormat("es-PE", { maximumFractionDigits: decimals });
    element.innerHTML = escapeHtml(formatter.format(value)) + "<small>" + escapeHtml(unit) + "</small>";
  }

  function formatCompact(value, unit) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—";
    const numeric = Number(value);
    if (Math.abs(numeric) >= 1000 && unit === "kW") return numberFormat.format(numeric / 1000) + " MW";
    if (Math.abs(numeric) >= 1000 && unit === "kWh") return numberFormat.format(numeric / 1000) + " MWh";
    return numberFormat.format(numeric) + " " + unit;
  }

  function compactNumber(value) {
    if (Math.abs(value) >= 1000) return numberFormat.format(value / 1000) + "k";
    return integerFormat.format(value);
  }

  function niceMaximum(value) {
    if (!Number.isFinite(value) || value <= 0) return 1;
    const power = Math.pow(10, Math.floor(Math.log10(value)));
    const normalized = value / power;
    const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
    return nice * power;
  }

  function sumKnown(items, property) {
    const known = items.filter(function (item) { return item[property] !== null && Number.isFinite(item[property]); });
    return known.length ? known.reduce(function (sum, item) { return sum + item[property]; }, 0) : null;
  }

  function setConnection(status, label) {
    el.connectionState.dataset.state = status;
    el.connectionLabel.textContent = label;
    if (status === "updating") {
      el.lastUpdated.textContent = state.lastUpdated ? "Última válida: " + timeFormat.format(state.lastUpdated) : "Esperando datos";
    } else if (status === "offline") {
      el.lastUpdated.textContent = state.lastUpdated ? "Última válida: " + timeFormat.format(state.lastUpdated) + " · datos congelados" : "API no disponible";
    } else if (status === "partial") {
      el.lastUpdated.textContent = state.lastUpdated ? "Actualización parcial " + timeFormat.format(state.lastUpdated) : "Datos parciales";
    } else if (state.lastUpdated) {
      el.lastUpdated.textContent = "Actualizado " + timeFormat.format(state.lastUpdated);
    } else {
      el.lastUpdated.textContent = "API no disponible";
    }
  }

  function updateErrorBanner(failed, successCount) {
    if (!failed.length) { el.dataBanner.hidden = true; return; }
    el.dataBanner.hidden = false;
    el.dataBannerTitle.textContent = successCount ? "Actualización parcial." : "API local sin respuesta.";
    el.dataBannerMessage.textContent = successCount
      ? "Sin respuesta de: " + failed.join(", ") + ". Se conserva la última información disponible; las lecturas con más de 15 s se marcan como retrasadas."
      : "EnergiaDistrital.Api no responde en " + window.location.origin + ". Los valores visibles son la última lectura conocida y quedan marcados como datos congelados hasta recuperar la conexión.";
  }

  function endpointLabel(name) {
    return { dashboard: "resumen", zones: "zonas", meters: "medidores", readings: "lecturas", alerts: "alertas", map: "mapa", infrastructure: "infraestructura", tinyml: "TinyML" }[name] || name;
  }

  function emptyState(icon, title, message) {
    return '<div class="empty-state"><span aria-hidden="true">' + escapeHtml(icon) + "</span><strong>" + escapeHtml(title) + "</strong><small>" + escapeHtml(message) + "</small></div>";
  }

  function showToast(message, tone) {
    window.clearTimeout(state.toastTimer);
    el.toast.textContent = message;
    el.toast.dataset.tone = tone || "success";
    el.toast.hidden = false;
    state.toastTimer = window.setTimeout(function () { el.toast.hidden = true; }, 3500);
  }

  function toBoolean(value) {
    if (typeof value === "boolean") return value;
    return ["true", "1", "yes", "si", "sí"].includes(String(value).toLowerCase());
  }

  function stringOrEmpty(value) { return value === null || value === undefined ? "" : String(value); }

  function escapeHtml(value) {
    return String(value === null || value === undefined ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
})();
