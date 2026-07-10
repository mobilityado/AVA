# CIO AVA v43 — Acceso por usuarios y roles

Esta versión agrega inicio de sesión conectado con la pestaña `USUARIOS` del mismo Google Sheet.

## Estructura requerida en Google Sheets

La pestaña debe llamarse exactamente `USUARIOS` y tener estas columnas en la fila 1:

- `USUARIO`
- `CONTRASEÑA`
- `TIPO DE CUENTA`

Tipos admitidos:

- `USUARIO`: puede ver todo excepto información de cajeros.
- `ADMINISTRADOR`: puede ver todos los módulos, rankings, nombres y reportes de cajeros.

## 1. Actualizar Google Apps Script

1. Abre el Google Sheet.
2. Ve a **Extensiones → Apps Script**.
3. Reemplaza el contenido de `Code.gs` con el archivo `Code.gs` incluido en este proyecto.
4. Guarda.
5. Ve a **Implementar → Administrar implementaciones**.
6. Edita la implementación actual, selecciona **Nueva versión** y pulsa **Implementar**.
7. Conserva el acceso como **Cualquier usuario** y ejecución como propietario.

La URL puede seguir siendo la misma si actualizas la implementación existente.

## 2. Publicar en GitHub Pages

Sube a la raíz del repositorio:

- `index.html`
- `Code.gs` solo como respaldo/documentación; GitHub no lo ejecuta.
- `css/`
- `js/`
- `assets/`
- `manifest.webmanifest`
- `service-worker.js`

Después abre la página con **Ctrl + F5**. En celular, borra la caché de la PWA si todavía aparece la versión anterior.

## Protección aplicada

Para cuentas `USUARIO` se bloquea y se elimina desde el servidor:

- Módulo Cajeros.
- Top 10 y ranking de cajeros.
- Nombres de cajeros en búsquedas, tablas y exportaciones.
- Consultas sobre cajeros en el Autobús de Ayuda.
- Detalle individual de cajeros.

No se limita solo a ocultar HTML: el Apps Script quita las columnas de cajero antes de enviar la información.

## Recomendación de seguridad

Cambia las contraseñas de ejemplo antes de publicar. Evita contraseñas compartidas y usa una distinta para cada persona. La sesión dura hasta 6 horas y se guarda únicamente en la pestaña actual del navegador.
