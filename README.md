# Centro de Control AVA

Dashboard estático para GitHub Pages conectado a Google Apps Script.

## Hojas esperadas

- `TRT` y `SUR`: información cobrada.
- `AVATRT` y `AVASUR`: información de adeudos / por cobrar.

## Funciones incluidas

- KPIs de total cobrado, total adeudo, recuperación, conductores con adeudo y promedio.
- Filtros por empresa, tipo, periodo, cajero y conductor.
- Gráficas de colores con Chart.js:
  - Cobrado vs adeudo por empresa.
  - Tendencia mensual.
  - Cajeros con mayor cobro AVA.
  - Conductores con mayor adeudo.
  - Estatus de adeudos.
  - Antigüedad de adeudos.
- Tabla con búsqueda.
- Exportación CSV.

## Publicar en GitHub Pages

1. Crea un repositorio en GitHub.
2. Sube `index.html`, `styles.css` y `app.js`.
3. Entra a **Settings > Pages**.
4. Selecciona **Deploy from branch**.
5. Elige rama `main` y carpeta `/root`.
6. Guarda y espera el enlace público.

## Cambiar la URL de Apps Script

En `app.js`, modifica:

```js
const API_URL = 'https://script.google.com/macros/s/AKfycbxpX9FNMZZDL72L76vS4keCiWC3xPb79_cMkpcBk0_AqktKHizk7j5A6r53brRN9y9d/exec';
```

## Nota

El dashboard usa la acción `?accion=datos&hoja=NOMBRE_HOJA`. Si tu Apps Script ya tiene la versión anterior que te pasé, debe funcionar. Si cambias nombres de columnas, el dashboard intenta detectar variantes comunes como `Nombre Cajero`, `Cajero`, `Por Cobrar`, `Costo`, `Fecha Corrida`, `Fecha del Viaje`, etc.
