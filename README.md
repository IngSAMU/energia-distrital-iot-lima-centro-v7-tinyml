# Energía Distrital IoT – Lima Centro

Sistema académico de monitoreo energético territorial con **ESP32-S3, TinyML, Edge AI, MQTT/TLS y dashboard georreferenciado**.

## Objetivo

Diseñar una arquitectura IoT capaz de adquirir variables eléctricas y térmicas, procesarlas localmente, clasificar el estado energético como **Normal, Atención o Crítico**, mantener continuidad operativa ante fallas temporales de conectividad y visualizar la información en un dashboard de Lima Centro.

## Arquitectura propuesta

**Red AC → PT/CT → ATM90E32AS → ESP32-S3 → preprocesamiento/TinyML → MQTT/TLS → backend → dashboard**

El ESP32-S3 permanece en el dominio SELV/baja tensión; la medición de red requiere acondicionamiento, aislamiento y protecciones adecuadas.

## Tecnologías principales

- ESP32-S3
- ESP-IDF / FreeRTOS
- ATM90E32AS
- DS18B20
- LIS3DH (opcional)
- TensorFlow Lite Micro / TinyML
- MQTT sobre TLS
- .NET 8
- Dashboard web georreferenciado
- Leaflet / OpenStreetMap

## Laboratorio TinyML V0.7

Modelo experimental MLP **6 → 12 → 8 → 3** entrenado con un dataset sintético reproducible de **9,000 muestras**.

Resultados de laboratorio:

- Accuracy: **99.22 %**
- Precision macro: **99.17 %**
- Recall macro: **99.14 %**
- F1-Score macro: **99.15 %**
- Recall clase Crítico: **98.87 %**

> Estas métricas corresponden a validación experimental sobre dataset sintético. La medición física final de Flash, SRAM, Tensor Arena, latencia y consumo debe realizarse sobre el ESP32-S3.

## Estructura prevista del repositorio

- `.github/` – automatización y configuración
- `docs/` – documentación técnica
- `firmware/` – firmware ESP32-S3
- `scripts/` – utilidades y pruebas
- `src/` – backend y dashboard
- `tools/` – herramientas de soporte
- `EnergiaDistrital.sln` – solución .NET

## Alcance actual

El dashboard utiliza telemetría simulada para validar la arquitectura, la lógica de alertas, la supervisión georreferenciada y el laboratorio TinyML. El despliegue físico constituye la siguiente fase de validación.

## Autor

**Mg. Samuel Chonlón Barrios**  
Ingeniería de Inteligencia Artificial  
Código de alumno: **2410589**

## Proyecto académico

Curso: **Inteligencia Artificial para Internet de las Cosas**  
Lima, Perú – 2026
