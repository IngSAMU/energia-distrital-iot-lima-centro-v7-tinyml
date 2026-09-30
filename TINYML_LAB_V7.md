# Energía Distrital IoT V0.7 — Laboratorio TinyML

## Objetivo

Esta versión incorpora al dashboard un laboratorio experimental para avanzar la Sección II del informe final. El panel separa claramente resultados de laboratorio de mediciones reales en el ESP32-S3.

## Qué se incorporó

- Modelo experimental MLP `6 → 12 → 8 → 3`.
- Seis características: carga %, voltaje, corriente relativa, factor de potencia, frecuencia y temperatura.
- Dataset sintético reproducible de **9,000 muestras**: 7,200 entrenamiento y 1,800 prueba.
- Cuantización experimental de **pesos INT8**.
- Payload binario experimental de **368 bytes (0.359 KB)**. Este valor **no es** el tamaño final de un `.tflite`.
- Accuracy, Precision, Recall, F1-Score y matriz de confusión sobre el conjunto sintético de prueba.
- Inferencia experimental dinámica por distrito usando el estado actual del simulador.
- Panel de seguimiento de recursos todavía pendientes: TFLite Micro final, Tensor Arena, Flash, SRAM, latencia en ESP32-S3 y consumo de corriente.
- Descarga directa del dataset CSV y del payload INT8 experimental.

## Resultados experimentales del laboratorio

| Métrica | Resultado |
|---|---:|
| Accuracy | 99.22 % |
| Precision macro | 99.17 % |
| Recall macro | 99.14 % |
| F1 macro | 99.15 % |
| Recall crítico | 98.87 % |
| Payload experimental | 0.359 KB |

### Matriz de confusión

| Real / Predicción | Normal | Atención | Crítico |
|---|---:|---:|---:|
| Normal | 878 | 5 | 0 |
| Atención | 3 | 559 | 2 |
| Crítico | 0 | 4 | 349 |

## Advertencia metodológica

Estas métricas proceden de un **dataset sintético de laboratorio** y de una implementación local del clasificador cuantizado en pesos. No deben presentarse como métricas obtenidas físicamente en el ESP32-S3. Para cerrar la Sección II todavía se requiere:

1. Convertir a TensorFlow Lite Micro con cuantización entera completa.
2. Desplegar en el ESP32-S3.
3. Medir tamaño exacto del `.tflite` o arreglo C/C++.
4. Medir Tensor Arena, SRAM estática/dinámica y Flash.
5. Ejecutar el conjunto de prueba en el microcontrolador y recalcular la matriz de confusión local.
6. Medir latencia con `esp_timer_get_time()`.
7. Medir corriente durante adquisición, inferencia, Wi-Fi y modos de ahorro.

## Archivos del laboratorio

- `src/EnergiaDistrital.Api/Services/TinyMlLabService.cs`
- `src/EnergiaDistrital.Api/wwwroot/data/tinyml_lab_dataset.csv`
- `src/EnergiaDistrital.Api/wwwroot/data/tinyml_lab_model.bin`
- `src/EnergiaDistrital.Api/wwwroot/data/tinyml_lab_model.json`

## Endpoint

```text
GET /api/tinyml?zoneId=distrito-san-borja
```

Al seleccionar un distrito en el dashboard, el laboratorio actualiza la inferencia experimental para ese distrito.
