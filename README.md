# CIO AVA v48 — Fuentes sin duplicidad

Esta versión corrige la lógica de recuperación:

- **AVATRT y AVASUR** son la fuente única para total cobrado, recuperación general, pendientes, tendencias, comparativos y reportes operativos.
- **TRT y SUR** se usan exclusivamente para identificar qué cajero realizó la recuperación y construir el ranking de cajeros.
- Los importes de TRT/SUR no se vuelven a sumar al total general porque ya están incluidos en las hojas AVA.
- El módulo y Top de Cajeros conservan sus datos y reconocimientos sin alterar las cifras ejecutivas.

## Instalación

No requiere modificar `Code.gs`. Reemplaza los archivos del proyecto en GitHub, conserva todas las carpetas y actualiza con Ctrl + F5. Si está instalada como PWA, cierra y vuelve a abrir la aplicación o borra la caché del sitio.
