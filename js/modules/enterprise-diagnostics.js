/** Diagnóstico no intrusivo para soporte y mantenimiento. */
window.CIOAVA = window.CIOAVA || {};
window.CIOAVA.diagnostics = (() => {
  function snapshot() {
    return {
      version: window.CIOAVA.config?.version,
      online: navigator.onLine,
      serviceWorker: 'serviceWorker' in navigator,
      installed: window.matchMedia?.('(display-mode: standalone)').matches || false,
      theme: document.body.classList.contains('dark') ? 'dark' : 'light',
      timestamp: new Date().toISOString()
    };
  }
  window.addEventListener('online', () => window.CIOAVA.runtime?.emit('network', { online: true }));
  window.addEventListener('offline', () => window.CIOAVA.runtime?.emit('network', { online: false }));
  return { snapshot };
})();
