# Adaptación del dashboard a Lima Centro

Se actualizó el proyecto para que el dashboard trabaje con 15 distritos de Lima Centro en lugar de las cuatro zonas genéricas de demostración.

## Distritos incorporados

1. Lima (Cercado)
2. Barranco
3. Breña
4. Jesús María
5. La Victoria
6. Lince
7. Magdalena del Mar
8. Miraflores
9. Pueblo Libre
10. Rímac
11. San Borja
12. San Isidro
13. San Miguel
14. Santiago de Surco
15. Surquillo

## Cambios realizados

- El ámbito principal ahora se denomina **Lima Centro**.
- El filtro superior cambió de **Zona** a **Distrito**.
- Se incorporaron los 15 distritos en el selector.
- El mapa muestra un nodo IoT simulado por distrito con coordenadas de referencia.
- La sección **Consumo por zona** pasó a **Consumo por distrito**.
- La tabla de medidores muestra **Distrito**.
- Se ajustaron las alertas de demostración a Lima (Cercado), San Miguel y Miraflores.
- La lista de consumo por distrito tiene desplazamiento vertical para mantener el dashboard compacto.

## Archivos principales modificados

- `src/EnergiaDistrital.Api/Services/EnergyRepository.cs`
- `src/EnergiaDistrital.Api/wwwroot/index.html`
- `src/EnergiaDistrital.Api/wwwroot/js/app.js`
- `src/EnergiaDistrital.Api/wwwroot/css/app.css`

## Ejecución

Abra `EnergiaDistrital.sln` en Visual Studio y ejecute el perfil `https`.

Los valores de consumo, demanda y alertas continúan siendo **simulados** por el proyecto; la estructura queda preparada para reemplazarlos luego por lecturas reales de ESP32/MQTT.
