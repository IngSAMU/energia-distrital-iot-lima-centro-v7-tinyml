# Guía de Visual Studio 2022, GitHub y Codex

Esta guía propone un flujo sencillo para construir el ejercicio por iteraciones: GitHub conserva la fuente compartida, Visual Studio ejecuta y depura la solución, y Codex ayuda a revisar o implementar cambios acotados.

## 1. Preparar el equipo

Instala:

- Visual Studio 2022 17.8 o posterior;
- la carga **Desarrollo de ASP.NET y web** desde Visual Studio Installer;
- .NET 8 SDK;
- el componente Git para Windows incluido por Visual Studio.

En una terminal comprueba:

```powershell
dotnet --info
git --version
```

En la salida de `dotnet --info` debe aparecer un SDK `8.x` y no solo el runtime.

## 2. Clonar desde GitHub

### Desde Visual Studio

1. En la ventana inicial elige **Clonar un repositorio**.
2. Pega la URL HTTPS del repositorio de GitHub.
3. Elige una carpeta local que no esté sincronizada ni usada por otra copia del proyecto.
4. Selecciona **Clonar**.
5. Abre `EnergiaDistrital.sln` si Visual Studio no lo hace automáticamente.

Visual Studio puede solicitar iniciar sesión en GitHub. Iniciar sesión es preferible a guardar un token dentro del proyecto.

### Desde la terminal

```powershell
git clone https://github.com/TU-USUARIO/energia-distrital-iot.git
Set-Location energia-distrital-iot
dotnet restore .\EnergiaDistrital.sln
```

Después abre la solución:

```powershell
start .\EnergiaDistrital.sln
```

## 3. Configurar la solución

1. En el **Explorador de soluciones**, haz clic derecho en `EnergiaDistrital.Api`.
2. Elige **Establecer como proyecto de inicio**.
3. En la lista de perfiles de ejecución, selecciona `http`.
4. Compila con **Compilar > Compilar solución** o `Ctrl+Mayús+B`.

El perfil HTTP usa `http://localhost:5157`; el perfil HTTPS usa `https://localhost:7192`. Para la primera ejecución se recomienda HTTP, pues evita confundir un problema de certificado local con un problema de la aplicación.

## 4. Ejecutar y recorrer el MVP

Presiona `Ctrl+F5` para iniciar sin depurador. Comprueba en este orden:

1. `http://localhost:5157/health` responde satisfactoriamente.
2. `http://localhost:5157/api/dashboard` muestra JSON.
3. `http://localhost:5157/` carga el panel.
4. El mapa muestra los nodos IoT y permite seleccionar un medidor.
5. El botón **Simular lectura** actualiza los indicadores y el mapa.
6. Sin pulsar el botón, los datos también cambian por el ciclo automático del servidor.
7. El selector de zona filtra el mapa y el resto del dashboard sin romper la actualización automática.

También puedes consultar desde la terminal integrada (**Ver > Terminal**):

```powershell
Invoke-RestMethod http://localhost:5157/api/zones
Invoke-RestMethod http://localhost:5157/api/meters
Invoke-RestMethod http://localhost:5157/api/map
Invoke-RestMethod http://localhost:5157/api/readings?limit=5
Invoke-RestMethod http://localhost:5157/api/alerts
Invoke-RestMethod -Method Post http://localhost:5157/api/simulator/tick
```

Detén la aplicación con `Mayús+F5` o `Ctrl+C`, según dónde se haya iniciado.

## 5. Depurar

Presiona `F5` para ejecutar con el depurador. Los puntos de interrupción más útiles para aprender el flujo son:

- el endpoint `POST /api/simulator/tick`;
- el método que genera la siguiente lectura;
- la evaluación de alertas;
- la construcción del objeto de `/api/dashboard`.

Cuando el punto se detenga, inspecciona el medidor, su zona, la marca temporal UTC y los valores agregados. Evita cambiar datos desde la ventana de inspección si intentas reproducir un error.

Para depurar JavaScript, abre las herramientas de desarrollo del navegador (`F12`), pestañas **Consola** y **Red**. Las solicitudes a `/api/...` deben devolver códigos `2xx` y JSON; un documento HTML en su lugar suele indicar una ruta equivocada.

## 6. Trabajar por iteraciones con GitHub y Codex

Antes de modificar, actualiza la rama principal y crea una rama corta:

```powershell
git switch main
git pull --ff-only
git switch -c feature/nombre-breve
```

Una petición eficaz a Codex incluye objetivo, alcance y criterio de aceptación. Por ejemplo:

```text
Añade un filtro de lecturas por zoneId. Mantén compatibles los endpoints actuales,
agrega pruebas y actualiza la documentación. La solución debe compilar en .NET 8.
```

Después de cada cambio:

```powershell
dotnet build .\EnergiaDistrital.sln
pwsh -File .\scripts\smoke-test.ps1 -SkipBuild
git status --short
git diff
```

Revisa el diff antes de confirmar; los cambios generados siguen siendo cambios del autor del repositorio. Haz commits pequeños y descriptivos:

```powershell
git add .
git commit -m "Agrega filtro de lecturas por zona"
git push -u origin feature/nombre-breve
```

Abre un pull request en GitHub y espera que la acción **CI** termine correctamente antes de fusionar.

## 7. Ejecutar la prueba de humo

Desde la raíz:

```powershell
pwsh -File .\scripts\smoke-test.ps1
```

El script:

1. compila el proyecto en Release, salvo que se use `-SkipBuild`;
2. inicia una instancia temporal sin usar el perfil de Visual Studio;
3. espera a `/health`;
4. valida los cinco `GET` de negocio y el `POST` del simulador;
5. termina el proceso aunque una comprobación falle.

Puedes elegir otro puerto:

```powershell
pwsh -File .\scripts\smoke-test.ps1 -BaseUrl http://127.0.0.1:5080
```

No ejecutes la prueba sobre una instancia que contenga datos importantes: el `POST` cambia el estado del simulador.

## 8. Problemas frecuentes

### “No se encontró un SDK compatible”

Instala el SDK de .NET 8 para la misma arquitectura de Visual Studio y reinicia el IDE. Verifica `dotnet --list-sdks`.

### El puerto 5157 está en uso

Detén la instancia anterior o cambia el puerto desde la terminal:

```powershell
dotnet run --project .\src\EnergiaDistrital.Api\EnergiaDistrital.Api.csproj --no-launch-profile --urls http://localhost:5080
```

### Error de certificado HTTPS

Usa primero el perfil `http`. Si necesitas HTTPS local, regenera y confía el certificado de desarrollo:

```powershell
dotnet dev-certs https --clean
dotnet dev-certs https --trust
```

La confianza requiere confirmación del sistema operativo.

### El panel abre pero no muestra datos

Comprueba `/health` y `/api/dashboard` directamente. En las herramientas del navegador revisa la respuesta de red y la consola. Si la API funciona, fuerza una recarga sin caché con `Ctrl+F5`.

### El estado desaparece al reiniciar

Es el comportamiento esperado del MVP: el almacenamiento actual está en memoria. La persistencia se incorporará en una iteración con PostgreSQL.

### Git no permite hacer `push`

Comprueba `git remote -v`, la rama activa y la sesión de GitHub. No pegues tokens en archivos, commits ni conversaciones; usa el administrador de credenciales de Git o el inicio de sesión de Visual Studio.
