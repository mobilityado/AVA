# CIO AVA v46 — Administración de usuarios

Esta versión agrega un módulo visible únicamente para cuentas **ADMINISTRADOR**.

## Funciones

- Crear usuarios desde CIO AVA.
- Restablecer contraseñas.
- Activar o desactivar cuentas.
- Consultar último acceso.
- Registrar fecha y hora de cada inicio de sesión.
- Contabilizar el número de accesos por usuario.
- Mostrar, cuando el navegador lo permite, el navegador, sistema operativo y descripción del dispositivo.
- Mantener los permisos existentes: las cuentas `USUARIO` no reciben información de cajeros.

## Instalación obligatoria

1. Abre **Extensiones → Apps Script** en el Google Sheet.
2. Reemplaza el código por `Code.gs` de este paquete.
3. Guarda.
4. Ve a **Implementar → Administrar implementaciones**.
5. Edita la implementación, selecciona **Nueva versión** y vuelve a implementar.
6. Conserva la misma URL `/exec`, ejecutando como propietario y con acceso para cualquier usuario autorizado a abrir el portal.
7. Sube a GitHub todos los archivos y carpetas del proyecto.
8. Abre el sitio con `Ctrl + F5`. Si está instalado como PWA, desinstala o borra el Service Worker anterior y vuelve a abrir.

## Pestaña USUARIOS

Las columnas mínimas siguen siendo:

```text
USUARIO | CONTRASEÑA | TIPO DE CUENTA | NOMBRE
```

El script crea automáticamente, si no existen:

```text
ACTIVO | ULTIMO ACCESO | TOTAL ACCESOS | ULTIMO EQUIPO | FECHA CREACION
```

Las cuentas ya existentes quedan activas de forma predeterminada cuando la columna `ACTIVO` está vacía.

## Nota sobre equipo y navegador

El dato se obtiene desde el navegador (`userAgent`, plataforma y resolución). Es útil para auditoría operativa, pero no debe considerarse una identificación infalible del equipo, porque el navegador puede ocultarlo o modificarlo.

## Seguridad

- Las acciones de administración se validan en Apps Script mediante el token y el rol de la sesión.
- Un usuario normal no puede crear, modificar ni listar cuentas desde la API.
- Al desactivar una cuenta, sus sesiones activas se eliminan.
- Al restablecer una contraseña, las sesiones anteriores del usuario se cierran, excepto la sesión actual si el administrador cambia su propia contraseña.
