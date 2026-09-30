# Firmware del nodo IoT

Esta carpeta queda reservada para la implementación embebida del nodo físico. La arquitectura de referencia, el diagrama de conexión, la asignación de pines, el procesamiento en tiempo real, el búfer circular y el protocolo MQTT están documentados en [Sección I: Arquitectura del hardware y firmware embebido](../docs/seccion-i-hardware-firmware.md).

## Plataforma de referencia

- ESP32-S3-DevKitC-1.
- Front-end trifásico aislado o certificado basado en ATM90E32AS.
- DS18B20 para temperatura.
- LIS3DH opcional para vibración.
- ESP-IDF con FreeRTOS, MQTT sobre TLS, OTA firmada y watchdog.

## Estructura prevista

```text
firmware/
├── components/
│   ├── atm90e32_driver/
│   ├── ds18b20_driver/
│   ├── lis3dh_driver/
│   ├── edge_inference/
│   ├── telemetry_queue/
│   └── mqtt_transport/
├── main/
│   ├── app_main.c
│   └── node_config.h
├── partitions.csv
└── sdkconfig.defaults
```

La implementación de código se realizará en una siguiente iteración, primero con señales de laboratorio aisladas y después de definir el front-end eléctrico con un profesional calificado. No se debe conectar la red eléctrica directamente al ESP32, a una protoboard, al USB ni al computador.
