# Centro de Control AVA Pro v6

Corrección para adeudos AVATRT y AVASUR.

## Qué se corrigió

- Ahora las hojas `AVATRT` y `AVASUR` leen el monto desde la columna **Por Cobrar**.
- También detecta **Costo**, **Adeudo**, **Saldo** o **Monto Adeudo** si en el futuro cambia el encabezado.
- Para adeudos usa fecha de **Fecha Corrida**.
- Para cobros sigue usando **Monto Recuperado** y **Nombre Cajero**.
- Corrige colores faltantes en gráficas.

## Actualización

Sube y reemplaza todo el contenido del ZIP en GitHub. Después abre la página con `Ctrl + F5`.

No necesitas cambiar Apps Script si las URL `?accion=datos&hoja=AVATRT` y `?accion=datos&hoja=AVASUR` abren correctamente.
