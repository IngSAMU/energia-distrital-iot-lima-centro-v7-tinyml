# Energ├¡a Distrital IoT ÔÇô Lima Centro

Sistema acad├®mico de monitoreo energ├®tico territorial con **ESP32-S3, TinyML, Edge AI, MQTT/TLS y dashboard georreferenciado**.

## Objetivo

Dise├▒ar una arquitectura IoT capaz de adquirir variables el├®ctricas y t├®rmicas, procesarlas localmente, clasificar el estado energ├®tico como **Normal, Atenci├│n o Cr├¡tico**, mantener continuidad operativa ante fallas temporales de conectividad y visualizar la informaci├│n en un dashboard de Lima Centro.

## Arquitectura propuesta

**Red AC ÔåÆ PT/CT ÔåÆ ATM90E32AS ÔåÆ ESP32-S3 ÔåÆ preprocesamiento/TinyML ÔåÆ MQTT/TLS ÔåÆ backend ÔåÆ dashboard**

El ESP32-S3 permanece en el dominio SELV/baja tensi├│n; la medici├│n de red requiere acondicionamiento, aislamiento y protecciones adecuadas.

## Tecnolog├¡as principales

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

Modelo experimental MLP **6 ÔåÆ 12 ÔåÆ 8 ÔåÆ 3** entrenado con un dataset sint├®tico reproducible de **9,000 muestras**.

Resultados de laboratorio:

- Accuracy: **99.22 %**
- Precision macro: **99.17 %**
- Recall macro: **99.14 %**
- F1-Score macro: **99.15 %**
- Recall clase Cr├¡tico: **98.87 %**

> Estas m├®tricas corresponden a validaci├│n experimental sobre dataset sint├®tico. La medici├│n f├¡sica final de Flash, SRAM, Tensor Arena, latencia y consumo debe realizarse sobre el ESP32-S3.

## Estructura prevista del repositorio

- `.github/` ÔÇô automatizaci├│n y configuraci├│n
- `docs/` ÔÇô documentaci├│n t├®cnica
- `firmware/` ÔÇô firmware ESP32-S3
- `scripts/` ÔÇô utilidades y pruebas
- `src/` ÔÇô backend y dashboard
- `tools/` ÔÇô herramientas de soporte
- `EnergiaDistrital.sln` ÔÇô soluci├│n .NET

## Alcance actual

El dashboard utiliza telemetr├¡a simulada para validar la arquitectura, la l├│gica de alertas, la supervisi├│n georreferenciada y el laboratorio TinyML. El despliegue f├¡sico constituye la siguiente fase de validaci├│n.

## Autor

**Mg. Samuel Chonl├│n Barrios**  
Ingenier├¡a de Inteligencia Artificial  
C├│digo de alumno: **2410589**

## Proyecto acad├®mico

Curso: **Inteligencia Artificial para Internet de las Cosas**  
Lima, Per├║ ÔÇô 2026
