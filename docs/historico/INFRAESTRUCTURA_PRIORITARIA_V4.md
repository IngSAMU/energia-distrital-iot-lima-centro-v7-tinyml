# Energía Distrital IoT · Infraestructura prioritaria v0.4

## Objetivo

La versión 0.4 extiende el prototipo de Lima Centro para representar infraestructura de alta criticidad o alta concurrencia dentro de los 15 distritos incluidos en el dashboard.

Se incorporaron **66 establecimientos priorizados**:

- **15** establecimientos de la red MINSA.
- **8** establecimientos de EsSalud.
- **26** clínicas/centros asistenciales privados representativos.
- **17** centros comerciales o complejos comerciales representativos.

> El inventario es una selección de establecimientos principales o conocidos para fines del prototipo; no pretende constituir el padrón oficial completo de IPRESS ni de centros comerciales de Lima Metropolitana.

## Funcionalidades incorporadas

1. Filtro por distrito y por tipo de infraestructura.
2. Marcadores diferenciados en el mapa:
   - `+` Clínica privada.
   - `M` MINSA.
   - `E` EsSalud.
   - `▦` Centro comercial.
3. Semáforo energético por establecimiento:
   - Normal: carga menor a 70 %.
   - Atención: carga entre 70 % y 89 %.
   - Crítico: carga igual o mayor a 90 %.
4. Tabla de infraestructura con establecimiento, red, distrito, demanda, carga, semáforo y conectividad.
5. Selección desde la tabla para enfocar el establecimiento en el mapa y mostrar su ficha energética.
6. Nuevo endpoint REST: `GET /api/infrastructure`.
7. El endpoint `GET /api/map` incluye también la colección `facilities`.
8. La prueba de humo verifica que el catálogo de infraestructura esté disponible.

## Alcance técnico de la “conexión” actual

En esta fase del proyecto, **conectado** significa integrado lógicamente al modelo de datos, API y dashboard. La demanda de cada establecimiento es simulada y se deriva del comportamiento energético del distrito para demostrar semáforos, filtros, alertas y actualización periódica.

No debe interpretarse como acceso en tiempo real a medidores de MINSA, EsSalud, clínicas privadas o centros comerciales.

## Evolución hacia conexión física real

Para convertir cada establecimiento simulado en un nodo real se propone:

```text
Tablero eléctrico / medidor
        │
        ▼
Sensores + ATM90E32AS
        │
        ▼
ESP32-S3
        │
        ▼
Wi-Fi / Ethernet / LTE
        │
        ▼
MQTT sobre TLS
        │
        ▼
Broker / API de ingestión
        │
        ▼
Base de datos de series de tiempo
        │
        ▼
Dashboard Energía Distrital IoT
```

Cada establecimiento tendría un identificador estable y tópicos MQTT semejantes a:

```text
lima-centro/{distrito}/{facilityId}/telemetry/v1
lima-centro/{distrito}/{facilityId}/events/v1
lima-centro/{distrito}/{facilityId}/status/v1
```

La migración requiere autorización del propietario/operador, diseño eléctrico, medidor o analizador certificado, conectividad, gestión de credenciales, TLS, persistencia histórica y políticas de ciberseguridad.

## Geolocalización

Las direcciones del catálogo se conservan como referencia textual. En el mapa del prototipo los puntos se distribuyen alrededor del ancla de cada distrito para evitar afirmar precisión GPS que todavía no ha sido validada individualmente. Antes de un despliegue operativo deben reemplazarse por coordenadas oficiales o verificadas.
