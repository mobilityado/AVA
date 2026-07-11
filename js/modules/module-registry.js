/** Catálogo de módulos para navegación, permisos y crecimiento futuro. */
window.CIOAVA = window.CIOAVA || {};
window.CIOAVA.modules = Object.freeze([
  { id: 'dashboard', group: 'Inteligencia operativa', label: 'Resumen Ejecutivo', icon: 'dashboard.svg' },
  { id: 'rubros', group: 'Inteligencia operativa', label: 'Rubros', icon: 'rubros.svg' },
  { id: 'honestidad', group: 'Inteligencia operativa', label: 'Honestidad', icon: 'honestidad.svg' },
  { id: 'tendencias', group: 'Inteligencia operativa', label: 'Tendencias', icon: 'tendencias.svg' },
  { id: 'insights', group: 'Inteligencia operativa', label: 'Resumen Inteligente', icon: 'insights.svg' },
  { id: 'assistant', group: 'Inteligencia operativa', label: 'CIO Assistant', icon: 'insights.svg' },
  { id: 'conductores', group: 'Recuperación', label: 'Conductores', icon: 'conductores.svg' },
  { id: 'cajeros', group: 'Recuperación', label: 'Cajeros', icon: 'cajeros.svg', adminOnly: true },
  { id: 'rutas', group: 'Operación', label: 'Rutas', icon: 'rutas.svg' },
  { id: 'reportes', group: 'Operación', label: 'Reportes', icon: 'reportes.svg' },
  { id: 'usuarios', group: 'Administración', label: 'Usuarios', icon: 'conductores.svg', adminOnly: true },
  { id: 'auditoria', group: 'Administración', label: 'Auditoría', icon: 'reportes.svg', adminOnly: true },
  { id: 'config', group: 'Sistema', label: 'Configuración', icon: 'config.svg' },
  { id: 'acerca', group: 'Sistema', label: 'Acerca de', icon: 'install.svg' }
]);
