# Dashboard V2 — Semáforo, alertas y curvas distritales

## Correcciones realizadas

1. **Semáforo energético por distrito**
   - Verde: carga menor a 70% de la demanda de referencia.
   - Amarillo: carga entre 70% y 89%.
   - Rojo: carga igual o superior a 90%.
   - El estado aparece en el mapa, en el listado de consumo por distrito y en el detalle del medidor.

2. **Panel de alertas activo**
   - Las alertas de demanda se generan y actualizan con los mismos umbrales del semáforo.
   - Se mantiene la alerta de conectividad/mantenimiento de San Miguel.
   - Las alertas muestran distrito, severidad, valor y umbral.
   - El panel se actualiza con el ciclo de simulación de 5 segundos.

3. **Curva de demanda por distrito**
   - El backend entrega 24 horas de historia (intervalos de 15 minutos) para cada distrito.
   - Al seleccionar un distrito, el gráfico utiliza exclusivamente su serie de 24 horas.
   - Al seleccionar “Todos los distritos”, se muestra la demanda agregada de Lima Centro.

4. **Simulación diferenciada**
   - Se incorporaron perfiles de carga distritales para que la demostración muestre estados verdes, amarillos y rojos de forma realista y variable durante el día.

## Cómo ejecutar

1. Descomprimir el ZIP completo en una carpeta normal (no abrir la solución dentro del ZIP).
2. Abrir `EnergiaDistrital.sln` con Visual Studio 2026 Insiders.
3. Verificar que `EnergiaDistrital.Api` aparezca como proyecto cargado.
4. Ejecutar con el botón `https` o F5.
