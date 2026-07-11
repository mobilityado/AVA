# Arquitectura — CIO AVA Enterprise 2.0

## Fuentes de datos

- **AVATRT y AVASUR:** fuente oficial de indicadores ejecutivos, incidencias, estatus, tendencias, comparativos y reportes generales.
- **TRT y SUR:** fuente exclusiva del ranking y detalle de recuperación por cajero. Sus importes no vuelven a sumarse al total ejecutivo.
- **USUARIOS:** autenticación, roles, estado, accesos y equipo.
- **AUDITORIA:** trazabilidad de accesos y acciones.

## Capas

1. `js/core/`: configuración, eventos y utilidades transversales.
2. `js/modules/`: catálogo y funcionalidades desacopladas.
3. `js/app.js`: compatibilidad y motor funcional heredado de la versión estable.
4. `js/admin-users.js`: administración de usuarios.
5. `js/audit.js`: auditoría.
6. `css/core/`: identidad Enterprise incremental.
7. `Code.gs`: API, sesiones, roles y protección de datos.

## Principio de compatibilidad

Enterprise 2.0 conserva la lógica probada de CIO AVA y añade una arquitectura que permite migrar progresivamente cada módulo sin interrumpir la operación.
