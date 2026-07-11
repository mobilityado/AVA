# CIO AVA Enterprise 2.0

Centro de Inteligencia Operativa AVA para la **Gerencia Regional de Recaudación VHT — Mobility ADO**.

## Lógica oficial de datos

- `AVATRT` y `AVASUR` alimentan todos los indicadores ejecutivos, porcentajes, tendencias, comparativos y reportes generales.
- `TRT` y `SUR` se usan exclusivamente para el ranking y detalle de recuperación de cajeros.
- Esta separación evita duplicar importes ya reflejados en las hojas AVA.

## Estructura

```text
CIO-AVA/
├── assets/                 Logo, iconos y recursos PWA
├── css/
│   ├── styles.css          Estilos funcionales estables
│   ├── enterprise.css      Punto de entrada visual
│   └── core/               Capa Enterprise
├── js/
│   ├── core/               Configuración y runtime
│   ├── modules/            Registro y diagnóstico modular
│   ├── app.js              Motor principal estable
│   ├── admin-users.js      Administración de usuarios
│   └── audit.js            Auditoría
├── docs/                   Arquitectura, instalación y cambios
├── Code.gs                 Backend de Apps Script
├── manifest.webmanifest    PWA
├── service-worker.js       Caché de aplicación
└── index.html
```

## Instalación rápida

Sube todos los archivos a la raíz de GitHub Pages. Si ya usas el Apps Script de v47/v48 y funciona correctamente, no necesitas cambiarlo para esta edición. Limpia la caché de la PWA o abre con `Ctrl + F5`.

Consulta `docs/INSTALACION.md` y `docs/ARQUITECTURA.md` para más detalles.
