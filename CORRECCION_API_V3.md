# Corrección API y simulación — v0.3

## Problema observado
El navegador podía conservar una versión antigua del dashboard y, si el proceso ASP.NET Core se detenía, la página seguía visible pero todos los `fetch()` a `/api/*` fallaban. En ese estado el botón **Simular lectura** tampoco podía funcionar.

## Correcciones
- Encabezados `no-store/no-cache` para HTML, JS y CSS.
- Versionado de recursos `?v=3`.
- `ReadingSimulationService` captura excepciones por ciclo y continúa ejecutándose.
- El host ignora el cierre por excepción aislada de un `BackgroundService`.
- Endpoint adicional `GET /api/health`.
- Mayor timeout del cliente (8 s).
- `POST /api/simulator/tick` sin cuerpo innecesario.
- Mensaje de error más preciso cuando la API local está detenida.
- `INICIAR_DASHBOARD.bat`: inicia la API, espera a que responda y abre el navegador.
- `VERIFICAR_API.bat`: comprueba el endpoint de salud.

## Forma recomendada de ejecución
1. Extraer el ZIP completo.
2. Doble clic en `INICIAR_DASHBOARD.bat`.
3. Mantener abierta la ventana negra mientras se usa el dashboard.
4. El navegador debe abrir `http://localhost:5157`.
5. Para validar la API: `http://localhost:5157/api/health` debe responder JSON con `status: healthy`.
