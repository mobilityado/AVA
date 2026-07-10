# CIO AVA v45 — Sesión estable y carga resiliente

Esta versión corrige el caso en que el usuario inicia sesión correctamente, pero los indicadores aparecen en cero.

## Cambios
- Las sesiones ya no dependen de `CacheService`; ahora se guardan en `ScriptProperties`.
- Las cuatro hojas se cargan con tolerancia a errores. Si una falla, las demás continúan.
- Nueva clave de sesión del navegador para evitar reutilizar tokens antiguos.
- Se actualizó la caché de la PWA.

## Instalación
1. Reemplaza el Apps Script por `Code.gs`.
2. Guarda y crea una **Nueva versión** de la implementación web.
3. Sube todos los archivos y carpetas a GitHub.
4. Abre la página con Ctrl+F5. Si sigue mostrando una versión anterior, elimina el Service Worker o prueba en incógnito.
