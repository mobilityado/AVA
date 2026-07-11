# CIO AVA Enterprise 2.5

Versión basada en la rama estable v48 (sin duplicidad de cobros).

## Novedades

- CIO Copilot 2.5 con análisis local de los datos cargados.
- Pronóstico estadístico mediante regresión lineal simple.
- Alertas inteligentes por adeudo, concentración de Honestidad y caída de recuperación.
- Consultas en lenguaje natural con el motor local del portal.
- Notificaciones del navegador.
- Envío de resumen ejecutivo por correo para administradores.
- PDF corporativo desde el módulo Copilot.

## Importante sobre la IA

El análisis se realiza dentro del navegador con reglas estadísticas y de negocio. No se envían datos operativos a servicios externos de IA. Esto protege la información y evita costos de API.

## Instalación

1. Reemplaza el Apps Script con `Code.gs`.
2. Publica una **Nueva versión** de la implementación web.
3. Sube todos los archivos del ZIP a la raíz de GitHub Pages.
4. Abre en incógnito o elimina el Service Worker anterior y usa Ctrl+F5.
5. La primera vez que se envíe un correo, Apps Script puede solicitar autorización para MailApp.

## Fuentes de datos

- AVATRT y AVASUR: indicadores generales, recuperación, tendencias, rutas, reportes y análisis.
- TRT y SUR: únicamente ranking y detalle de cajeros.
