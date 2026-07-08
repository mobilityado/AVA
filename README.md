# AVA Dashboard

Dashboard web estático para consultar información de AVA desde Google Sheets mediante Google Apps Script.

## Archivos

- `index.html`: estructura del dashboard.
- `styles.css`: diseño visual responsivo.
- `app.js`: conexión con Apps Script, gráficas, filtros, KPIs y exportación CSV.

## API configurada

La URL del Apps Script ya está configurada en `app.js`:

```js
const API_URL = 'https://script.google.com/macros/s/AKfycbxpX9FNMZZDL72L76vS4keCiWC3xPb79_cMkpcBk0_AqktKHizk7j5A6r53brRN9y9d/exec';
```

## Cómo subir a GitHub Pages

1. Crea un repositorio nuevo en GitHub, por ejemplo `ava-dashboard`.
2. Sube estos archivos a la raíz del repositorio:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `README.md`
3. Entra a **Settings > Pages**.
4. En **Build and deployment**, selecciona:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/root`
5. Guarda los cambios.
6. GitHub generará una URL parecida a:
   `https://TU-USUARIO.github.io/ava-dashboard/`

## Funciones incluidas

- Filtro por hoja: Todas, TRT o SUR.
- Filtro por periodo: Desde / Hasta.
- KPIs de registros, monto recuperado, pasajeros y promedio.
- Gráfica de tendencia diaria.
- Gráfica por hoja.
- Top conductores.
- Top cajeros.
- Tabla detallada con buscador.
- Exportación a CSV.

## Nota

Si el navegador bloquea la consulta por permisos o CORS, vuelve a revisar que el Apps Script esté publicado como aplicación web con acceso para cualquier usuario.


## Actualización

- Se quitó la leyenda visible de fuente Google Script.
- Se agregó filtro por cajero.
- Se agregó/actualizó la gráfica de cajeros para ver quién cobró más AVA por monto recuperado.
