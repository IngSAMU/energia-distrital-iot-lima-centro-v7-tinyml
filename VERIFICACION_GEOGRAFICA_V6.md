# Verificación geográfica y catálogo curado · v0.6

## Criterio aplicado

Esta versión deja de intentar llenar cada distrito con establecimientos menores. El dashboard muestra **solo infraestructura principal, conocida o de especial relevancia** dentro de las categorías solicitadas: clínicas privadas, establecimientos MINSA, establecimientos EsSalud y centros comerciales relevantes.

No se inventa una clínica, hospital o centro comercial para completar un distrito. Si un distrito no tiene una instalación de relevancia suficiente en una categoría, la categoría puede quedar vacía.

La telemetría eléctrica sigue siendo simulada. La verificación de esta versión corresponde a **nombre, distrito, dirección y posición cartográfica del marcador**.

## Correcciones críticas

1. **Óvalo Gutiérrez** no pertenece a San Borja. Es un referente urbano de **Miraflores**. Además, no es un hospital, clínica ni centro comercial principal, por lo que se excluye del catálogo energético V6.
2. **Clínica Ricardo Palma** se mantiene en **San Isidro**, porque su dirección institucional es Av. Javier Prado Este 1066, San Isidro. No se mueve artificialmente a San Borja.
3. En **San Borja** se priorizan las sedes que sí corresponden al distrito: INSN San Borja, SANNA Clínica San Borja, Clínica Internacional San Borja, Clínica Santa Isabel, Clínica Vesalio, Clínica Oncosalud sede hospitalaria, Oncosalud/Auna sede ambulatoria, La Rambla San Borja y Real Plaza Primavera.
4. **Oncosalud/Auna**: la sede hospitalaria de Guardia Civil 227-229 y la sede ambulatoria de Guardia Civil 571 están en **San Borja**.
5. **Auna Guardia Civil - Clínica**, Av. Guardia Civil 368, se conserva en **San Isidro** de acuerdo con el directorio oficial vigente de Auna/Oncosalud. No se confunde con las sedes Oncosalud de San Borja.
6. La lista se redujo de 66 a **56 establecimientos curados**, eliminando centros secundarios o duplicados que agregaban ruido al mapa.

## Fuentes principales de control

- Instituto Nacional de Salud del Niño San Borja: https://portal.insnsb.gob.pe/transparencia-ubicacion-del-insn-sb/
- Clínica Internacional San Borja: https://clinicainternacional.com.pe/sede/san-borja/
- Clínica Santa Isabel: https://www.clinicasantaisabel.com/ubicacion/
- Auna / Red Oncológica: https://auna.org/pe/sedes/red-oncologica
- Oncosalud sedes: https://oncosalud.pe/sedes
- Clínica Ricardo Palma: https://preguntasfrecuentes.crp.com.pe/ubicaci%C3%B3n-de-la-cl%C3%ADnica
- EsSalud Miraflores: https://www.essalud.gob.pe/nuestras-redes-asistenciales/miraflores/
- EsSalud Rímac: https://www.essalud.gob.pe/nuestras-redes-asistenciales/rimac/
- Municipalidad de Miraflores, Óvalo Gutiérrez: https://www.miraflores.gob.pe/municipalidad-de-miraflores-informa-a-sus-vecinos-sobre-recuperacion-del-ovalo-gutierrez/
- La Rambla: https://larambla.pe/nosotros/

## San Borja · catálogo final V6

| Tipo | Establecimiento | Dirección |
|---|---|---|
| MINSA | Instituto Nacional de Salud del Niño - San Borja | Av. Agustín de la Rosa Toro 1399 / Av. Javier Prado Este 3101 |
| Clínica | SANNA Clínica San Borja | Av. Guardia Civil 337 |
| Clínica | Clínica Internacional - Sede San Borja | Av. Guardia Civil 385-433 |
| Clínica | Clínica Santa Isabel | Av. Guardia Civil 133 |
| Clínica | Clínica Vesalio | Jr. Joseph Thompson 140 |
| Clínica/Auna | Clínica Oncosalud - Sede Hospitalaria | Av. Guardia Civil 227-229 |
| Clínica/Auna | Oncosalud Auna - Sede Ambulatoria | Av. Guardia Civil 571 |
| Centro comercial | La Rambla San Borja | Av. Javier Prado Este 2050 |
| Centro comercial | Real Plaza Primavera | Av. Aviación 2681 |

## Nota sobre límites distritales

El corredor de Av. Guardia Civil se encuentra próximo a límites administrativos entre San Isidro y San Borja. Por ello, el catálogo no asigna el distrito únicamente por cercanía visual. Se prioriza la dirección declarada por la institución y se contrasta con fuentes cartográficas públicas.

Para auditoría completa del inventario, revisar `CATALOGO_CURADO_V6.csv`.
