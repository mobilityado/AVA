/**
 * CIO AVA Enterprise 2.0 - Configuración central
 * Mantiene en un solo sitio la identidad, versión y parámetros compartidos.
 */
window.CIOAVA = window.CIOAVA || {};
window.CIOAVA.config = Object.freeze({
  appName: 'CIO AVA',
  fullName: 'Centro de Inteligencia Operativa AVA',
  edition: 'Enterprise',
  version: '2.0.0',
  organization: 'Gerencia Regional de Recaudación VHT · Mobility ADO',
  dataSources: {
    executive: ['AVATRT', 'AVASUR'],
    cashierRanking: ['TRT', 'SUR']
  },
  permissions: {
    ADMINISTRADOR: ['*'],
    USUARIO: ['dashboard', 'rubros', 'honestidad', 'conductores', 'rutas', 'tendencias', 'insights', 'assistant', 'reportes', 'config', 'acerca']
  }
});
