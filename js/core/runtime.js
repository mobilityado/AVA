/** Utilidades de arranque y eventos compartidos. */
window.CIOAVA = window.CIOAVA || {};
window.CIOAVA.runtime = (() => {
  const listeners = new Map();
  function on(event, handler) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(handler);
    return () => listeners.get(event)?.delete(handler);
  }
  function emit(event, detail) {
    listeners.get(event)?.forEach(handler => {
      try { handler(detail); } catch (error) { console.error('[CIO AVA event]', event, error); }
    });
    document.dispatchEvent(new CustomEvent(`cioava:${event}`, { detail }));
  }
  function setBuildLabel() {
    const cfg = window.CIOAVA.config;
    document.documentElement.dataset.cioVersion = cfg?.version || '2.0.0';
    document.querySelectorAll('[data-cio-version]').forEach(el => { el.textContent = `v${cfg.version} ${cfg.edition}`; });
  }
  document.addEventListener('DOMContentLoaded', setBuildLabel, { once: true });
  return { on, emit, setBuildLabel };
})();
