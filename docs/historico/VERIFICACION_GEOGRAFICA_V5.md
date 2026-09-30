# Verificación geográfica · Energía Distrital IoT v0.5

## Objetivo

Esta versión reemplaza las coordenadas **referenciales generadas alrededor de un punto distrital**
por coordenadas explícitas de los establecimientos. El mapa ya no usa un círculo grande como si
fuera el límite administrativo de un distrito: utiliza un **punto de referencia distrital** y los
establecimientos se dibujan individualmente en sus coordenadas.

La telemetría energética continúa siendo simulada. La corrección de esta versión es
**geográfica y cartográfica**, no una conexión eléctrica real con las instituciones.

## Correcciones de criterio

- Se eliminó el uso de coordenadas artificiales calculadas por desplazamiento.
- San Borja dejó de estar centrado cerca del eje Miraflores/San Isidro y se reubicó en el
  promedio de sus establecimientos verificados.
- Óvalo Gutiérrez no se usa como punto de referencia de San Borja.
- **Clínica Ricardo Palma** permanece en **San Isidro**, Av. Javier Prado Este 1066.
- **Clínica Auna Guardia Civil** permanece en **San Isidro**, Av. Guardia Civil 368.
- Para **San Borja**, la presencia de Auna se representa correctamente mediante su red
  **Oncosalud/Auna** en Av. Guardia Civil 227 y 571.
- **Policlínico Suárez** se trasladó de Surquillo a **Miraflores**.
- Se retiraron del inventario elementos ambiguos o poco representativos que podían inducir a
  error territorial, como “Barranco Planta”, “Centro Comercial Las Brisas”, “Centro Comercial
  Bolívar” y la denominación ambigua “Clínica Miraflores”.
- La selección de un establecimiento en la tabla ahora enfoca su distrito en el mapa.
- La ficha del mapa muestra dirección y coordenadas para facilitar la auditoría visual.

## Inventario georreferenciado

Total: **66 establecimientos**  
MINSA: **13** · EsSalud: **8** ·
Clínicas privadas: **31** · Centros comerciales: **14**

| Distrito | Establecimiento | Tipo | Dirección | Latitud | Longitud |
|---|---|---|---|---:|---:|
| Lima (Cercado) | Hospital Nacional Dos de Mayo | MINSA | Parque Historia de la Medicina Peruana s/n, altura cdra. 13 Av. Grau | -12.055870 | -77.015430 |
| Lima (Cercado) | Hospital Nacional Arzobispo Loayza | MINSA | Av. Alfonso Ugarte 848 | -12.049550 | -77.044620 |
| Lima (Cercado) | Hospital Nacional Docente Madre Niño San Bartolomé | MINSA | Av. Alfonso Ugarte 825 | -12.049770 | -77.041810 |
| Lima (Cercado) | Hospital de Emergencias Grau | EsSalud | Av. Miguel Grau 351 | -12.058957 | -77.031278 |
| Lima (Cercado) | Clínica Internacional - Sede Lima | Clínica privada | Av. Garcilaso de la Vega 1420 | -12.058345 | -77.038279 |
| Lima (Cercado) | Clínica Maison de Santé - Sede Lima | Clínica privada | Jr. Miguel Aljovín 222 | -12.057446 | -77.033944 |
| Lima (Cercado) | Real Plaza Centro Cívico | Centro comercial | Av. Garcilaso de la Vega 1337 | -12.056780 | -77.037330 |
| Barranco | Centro de Salud Alicia Lastres de la Torre | MINSA | Jr. Martínez de Pinillos 124, Barranco | -12.144230 | -77.022400 |
| Barranco | Centro de Salud Gaudencio Bernasconi | MINSA | Av. Almte. Miguel Grau 198, Barranco | -12.150520 | -77.020300 |
| Barranco | Médica Ocular - Sede Barranco | Clínica privada | Av. Francisco Bolognesi 98, Barranco | -12.151090 | -77.019770 |
| Breña | Instituto Nacional de Salud del Niño - Breña | MINSA | Av. Brasil 600, Breña | -12.065121 | -77.045955 |
| Breña | Clínica San Marcos | Clínica privada | Jr. Huaraz 1425, Breña | -12.063722 | -77.048046 |
| Breña | La Rambla Brasil | Centro comercial | Av. Brasil 702-778, Breña | -12.066086 | -77.046953 |
| Jesús María | Hospital Nacional Edgardo Rebagliati Martins | EsSalud | Av. Edgardo Rebagliati 490, Jesús María | -12.078360 | -77.039890 |
| Jesús María | Clínica San Felipe | Clínica privada | Av. Gregorio Escobedo 650, Jesús María | -12.086040 | -77.054340 |
| Jesús María | Policlínico Peruano Japonés | Clínica privada | Av. Gregorio Escobedo 783, Jesús María | -12.087830 | -77.055070 |
| Jesús María | Real Plaza Salaverry | Centro comercial | Av. Gral. Felipe Salaverry 2370, Jesús María | -12.089830 | -77.052730 |
| La Victoria | Hospital Nacional Guillermo Almenara Irigoyen | EsSalud | Av. Grau 800, La Victoria | -12.059580 | -77.022340 |
| La Victoria | Hospital de Emergencias Pediátricas | MINSA | Av. Miguel Grau 854, La Victoria | -12.058171 | -77.021729 |
| La Victoria | Plaza Santa Catalina | Centro comercial | Av. Carlos Villarán 500, La Victoria | -12.089523 | -77.019992 |
| Lince | Clínica Risso | Clínica privada | Av. Arequipa 2030, Lince | -12.084988 | -77.034578 |
| Lince | Centro Comercial Risso | Centro comercial | Av. Arequipa 2250, Lince | -12.086400 | -77.034810 |
| Magdalena del Mar | Hospital Nacional Víctor Larco Herrera | MINSA | Av. Augusto Pérez Araníbar 600, Magdalena del Mar | -12.097230 | -77.065550 |
| Magdalena del Mar | Policlínico Santa María Magdalena | Clínica privada | Jr. Castilla 505, Magdalena del Mar | -12.092080 | -77.074280 |
| Magdalena del Mar | Clínica Virgen del Rosario | Clínica privada | Jr. Castilla 976, Magdalena del Mar | -12.087817 | -77.072371 |
| Miraflores | Hospital de Emergencias José Casimiro Ulloa | MINSA | Av. Roosevelt 6355-6357, Miraflores | -12.128100 | -77.017740 |
| Miraflores | Hospital EsSalud Angamos | EsSalud | Av. Angamos Este 261, Miraflores | -12.113310 | -77.028140 |
| Miraflores | Policlínico Suárez | EsSalud | Av. General Suárez 1070, Miraflores | -12.109660 | -77.027310 |
| Miraflores | Clínica Delgado Auna | Clínica privada | Calle General Borgoño, Miraflores | -12.113130 | -77.033000 |
| Miraflores | Clínica Good Hope | Clínica privada | Malecón Balta 956, Miraflores | -12.125620 | -77.034520 |
| Miraflores | Larcomar | Centro comercial | Malecón de la Reserva 610, Miraflores | -12.131940 | -77.030060 |
| Pueblo Libre | Hospital Santa Rosa | MINSA | Av. Simón Bolívar, cdra. 8, Pueblo Libre | -12.072079 | -77.061037 |
| Pueblo Libre | Clínica Centenario Peruano Japonesa | Clínica privada | Av. Paso de los Andes 675, Pueblo Libre | -12.073124 | -77.059128 |
| Pueblo Libre | Clínica Stella Maris | Clínica privada | Av. Paso de los Andes 923, Pueblo Libre | -12.071398 | -77.059284 |
| Rímac | Policlínico Francisco Pizarro | EsSalud | Av. Francisco Pizarro 585, Rímac | -12.037017 | -77.035127 |
| San Borja | Instituto Nacional de Salud del Niño - San Borja | MINSA | Av. Agustín de la Rosa Toro 1399, San Borja | -12.085640 | -76.992180 |
| San Borja | SANNA Clínica San Borja | Clínica privada | Av. Guardia Civil 337, San Borja | -12.092020 | -77.008340 |
| San Borja | Clínica Internacional - Sede San Borja | Clínica privada | Av. Guardia Civil 385-433, San Borja | -12.092464 | -77.008831 |
| San Borja | Clínica Santa Isabel | Clínica privada | Av. Guardia Civil 135, San Borja | -12.089397 | -77.007378 |
| San Borja | Clínica Vesalio | Clínica privada | Jr. Joseph Thompson 140, San Borja | -12.106378 | -77.007224 |
| San Borja | Clínica Oncosalud Auna - Sede Hospitalaria | Clínica privada | Av. Guardia Civil 227, San Borja | -12.090655 | -77.007612 |
| San Borja | Oncosalud Auna - Sede Ambulatoria | Clínica privada | Av. Guardia Civil 571, San Borja | -12.090610 | -77.007620 |
| San Borja | La Rambla San Borja | Centro comercial | Av. Javier Prado Este 2050, San Borja | -12.089490 | -77.004790 |
| San Borja | Real Plaza Primavera | Centro comercial | Av. Angamos Este 2681 / Av. Aviación, San Borja | -12.110290 | -77.001720 |
| San Isidro | Centro de Salud San Isidro | MINSA | Av. Augusto Pérez Araníbar 1756, San Isidro | -12.106733 | -77.054912 |
| San Isidro | Clínica Anglo Americana | Clínica privada | C. Alfredo Salazar 350, San Isidro | -12.109220 | -77.039160 |
| San Isidro | Clínica Ricardo Palma | Clínica privada | Av. Javier Prado Este 1066, San Isidro | -12.090710 | -77.018300 |
| San Isidro | Clínica Internacional - Medicentro San Isidro | Clínica privada | Av. Paseo de la República 3058, San Isidro | -12.093080 | -77.023960 |
| San Isidro | Clínica Auna Guardia Civil | Clínica privada | Av. Guardia Civil 368, San Isidro | -12.091896 | -77.009035 |
| San Isidro | Clínica Javier Prado | Clínica privada | Av. Javier Prado Este 499, San Isidro | -12.091100 | -77.028450 |
| San Isidro | Centro Comercial Camino Real | Centro comercial | Av. Camino Real 479, San Isidro | -12.097070 | -77.036250 |
| San Miguel | Hospital I Octavio Mongrut Muñoz | EsSalud | Av. Parque de las Leyendas 255, San Miguel | -12.065961 | -77.094583 |
| San Miguel | Clínica San Gabriel | Clínica privada | Av. de la Marina 2955, San Miguel | -12.076740 | -77.095740 |
| San Miguel | Clínica San Judas Tadeo | Clínica privada | Av. Mariscal Ramón Castilla 780, San Miguel | -12.079990 | -77.080120 |
| San Miguel | Plaza San Miguel | Centro comercial | Av. de la Marina 2000, San Miguel | -12.076910 | -77.082620 |
| San Miguel | Open Plaza La Marina | Centro comercial | Av. de la Marina 2355, San Miguel | -12.079583 | -77.088690 |
| Santiago de Surco | Policlínico EsSalud Próceres | EsSalud | Av. Los Próceres 440, Santiago de Surco | -12.150660 | -76.988600 |
| Santiago de Surco | Clínica San Pablo - Sede Surco | Clínica privada | Av. El Polo 789, Santiago de Surco | -12.100168 | -76.971607 |
| Santiago de Surco | Clínica Internacional - El Polo | Clínica privada | Av. El Polo 461, Santiago de Surco | -12.104060 | -76.972920 |
| Santiago de Surco | Clínica Padre Luis Tezza | Clínica privada | Av. El Polo 570, Santiago de Surco | -12.103200 | -76.972010 |
| Santiago de Surco | Clínica Montesur | Clínica privada | Av. El Polo 505, Santiago de Surco | -12.103260 | -76.972980 |
| Santiago de Surco | Jockey Plaza | Centro comercial | Av. Javier Prado Este 4200, Santiago de Surco | -12.086456 | -76.977036 |
| Santiago de Surco | El Polo Plaza Center | Centro comercial | Av. El Polo 759, Santiago de Surco | -12.100750 | -76.971800 |
| Surquillo | Instituto Nacional de Enfermedades Neoplásicas - INEN | MINSA | Av. Angamos Este 2520, Surquillo | -12.112610 | -76.998510 |
| Surquillo | Clínica Virgen Milagrosa | Clínica privada | C. Valdemar Moser 501, Surquillo | -12.116931 | -77.006986 |
| Surquillo | Mallplaza Angamos | Centro comercial | Av. Angamos Este 1803 / cruce Tomás Marsano, Surquillo | -12.111444 | -77.011778 |

## Criterio de fuentes

La revisión priorizó, según disponibilidad:

1. páginas oficiales de cada institución;
2. registros de establecimientos de salud derivados de RENIPRESS/SUSALUD y GeoPerú;
3. páginas institucionales de MINSA y EsSalud;
4. OpenStreetMap/Mapcarta para contraste cartográfico de coordenadas;
5. páginas oficiales de operadores de centros comerciales.

Cuando una ubicación no pudo verificarse con suficiente precisión, se prefirió no mantener
un marcador dudoso antes que ubicarlo artificialmente.

## Validación visual recomendada

En el dashboard:

1. elegir un distrito;
2. filtrar por tipo de infraestructura;
3. hacer clic en el establecimiento;
4. comparar **dirección + coordenadas** de la ficha con el mosaico OpenStreetMap;
5. confirmar que el punto se encuentra dentro del distrito indicado.

La versión se identifica en el pie como **v0.5**.
