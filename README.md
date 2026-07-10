# CIO AVA v44 — Nombre, bienvenida y último acceso

Esta versión usa la nueva columna `NOMBRE` de la pestaña `USUARIOS`.

## Columnas requeridas

`USUARIO | CONTRASEÑA | TIPO DE CUENTA | NOMBRE`

## Mejoras

- El selector muestra el nombre completo y conserva el usuario como identificador de acceso.
- Después de iniciar sesión aparece una bienvenida con el nombre de la persona.
- El encabezado muestra nombre, rol y último acceso.
- El Apps Script registra el último acceso por usuario.
- Se mantienen los permisos: `USUARIO` no recibe información de cajeros; `ADMINISTRADOR` ve todo.
- Incluye botón Cerrar sesión, PWA, temas, reportes y módulos existentes.

## Instalación

1. Reemplaza el Apps Script con `Code.gs`.
2. Guarda y crea una **nueva versión** de la implementación web.
3. Conserva la misma URL `/exec`, ejecución como propietario y acceso para cualquier usuario.
4. Sube todo el contenido de este proyecto a GitHub Pages.
5. Abre con `Ctrl + F5`; si la PWA conserva una versión anterior, elimina el Service Worker y los datos del sitio.

## Nota

Si `NOMBRE` está vacío o contiene `-`, el sistema utilizará el valor de `USUARIO` como nombre visible.
