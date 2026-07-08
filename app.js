const API_URL = 'https://script.google.com/macros/s/AKfycbxpX9FNMZZDL72L76vS4keCiWC3xPb79_cMkpcBk0_AqktKHizk7j5A6r53brRN9y9d/exec';

const state = {
  resumen: null,
  tendencia: [],
  conductores: [],
  cajeros: [],
  reporte: [],
  charts: {}
};

const $ = (id) => document.getElementById(id);
const money = (value) => Number(value || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
const number = (value) => Number(value || 0).toLocaleString('es-MX');

function buildParams(accion) {
  const params = new URLSearchParams({ accion });
  const hoja = $('hojaSelect').value;
  const desde = $('desdeInput').value;
  const hasta = $('hastaInput').value;

  if (hoja) params.set('hoja', hoja);
  if (desde) params.set('desde', desde);
  if (hasta) params.set('hasta', hasta);

  return params.toString();
}

async function api(accion) {
  const url = `${API_URL}?${buildParams(accion)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Error HTTP ${response.status}`);
  const data = await response.json();
  if (data.error) throw new Error(data.mensaje || 'Error al consultar información');
  return data;
}

async function loadDashboard() {
  showToast('Consultando información...');

  try {
    const [resumen, tendencia, conductores, cajeros, reporte] = await Promise.all([
      api('resumen'),
      api('tendencia'),
      api('topConductores'),
      api('topCajeros'),
      api('reporte')
    ]);

    state.resumen = resumen;
    state.tendencia = tendencia.tendencia || [];
    state.conductores = conductores.top || [];
    state.cajeros = cajeros.top || [];
    state.reporte = reporte.datos || [];

    renderKpis();
    renderCharts();
    renderTable(state.reporte);

    $('lastUpdate').textContent = `Última actualización: ${new Date().toLocaleString('es-MX')}`;
    showToast('Dashboard actualizado correctamente');
  } catch (error) {
    console.error(error);
    showToast(`No se pudo cargar la información: ${error.message}`);
  }
}

function renderKpis() {
  const kpis = state.resumen?.kpis || {};
  $('kpiRegistros').textContent = number(kpis.totalRegistros);
  $('kpiMonto').textContent = money(kpis.totalMontoRecuperado);
  $('kpiPasajeros').textContent = number(kpis.totalPasajeros);
  $('kpiPromedio').textContent = money(kpis.promedioMonto);
}

function renderCharts() {
  renderLineChart('chartTendencia', {
    labels: state.tendencia.map(x => x.fecha),
    data: state.tendencia.map(x => x.monto),
    label: 'Monto recuperado'
  });

  const porHoja = state.resumen?.porHoja || [];
  renderBarChart('chartHojas', {
    labels: porHoja.map(x => x.nombre),
    data: porHoja.map(x => x.monto),
    label: 'Monto recuperado'
  });

  renderBarChart('chartConductores', {
    labels: state.conductores.map(x => recortarTexto(x.nombre, 18)),
    data: state.conductores.map(x => x.monto),
    label: 'Monto por conductor'
  }, true);

  renderBarChart('chartCajeros', {
    labels: state.cajeros.map(x => recortarTexto(x.nombre, 18)),
    data: state.cajeros.map(x => x.monto),
    label: 'Monto por cajero'
  }, true);
}

function renderLineChart(canvasId, config) {
  destroyChart(canvasId);
  state.charts[canvasId] = new Chart($(canvasId), {
    type: 'line',
    data: {
      labels: config.labels,
      datasets: [{
        label: config.label,
        data: config.data,
        tension: .32,
        fill: true
      }]
    },
    options: chartOptions()
  });
}

function renderBarChart(canvasId, config, horizontal = false) {
  destroyChart(canvasId);
  state.charts[canvasId] = new Chart($(canvasId), {
    type: 'bar',
    data: {
      labels: config.labels,
      datasets: [{ label: config.label, data: config.data }]
    },
    options: chartOptions(horizontal)
  });
}

function chartOptions(horizontal = false) {
  return {
    indexAxis: horizontal ? 'y' : 'x',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => money(ctx.raw)
        }
      }
    },
    scales: {
      x: { ticks: { autoSkip: true, maxRotation: 0 } },
      y: { ticks: { callback: (value) => horizontal ? value : money(value) } }
    }
  };
}

function destroyChart(canvasId) {
  if (state.charts[canvasId]) state.charts[canvasId].destroy();
}

function renderTable(rows) {
  const head = $('tableHead');
  const body = $('tableBody');
  head.innerHTML = '';
  body.innerHTML = '';

  if (!rows.length) {
    body.innerHTML = '<tr><td>No hay registros para mostrar</td></tr>';
    return;
  }

  const headers = Object.keys(rows[0]).filter(h => h !== 'montoRecuperadoNumero');
  head.innerHTML = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;

  body.innerHTML = rows.map(row => `
    <tr>
      ${headers.map(h => `<td>${formatCell(h, row[h])}</td>`).join('')}
    </tr>
  `).join('');
}

function formatCell(header, value) {
  if (header.toLowerCase().includes('monto')) return money(value);
  return value ?? '';
}

function filterTable() {
  const text = $('searchInput').value.toLowerCase().trim();
  if (!text) return renderTable(state.reporte);

  const filtered = state.reporte.filter(row =>
    Object.values(row).some(value => String(value ?? '').toLowerCase().includes(text))
  );

  renderTable(filtered);
}

function exportCsv() {
  if (!state.reporte.length) return showToast('No hay datos para exportar');

  const headers = Object.keys(state.reporte[0]).filter(h => h !== 'montoRecuperadoNumero');
  const lines = [headers.join(',')];

  state.reporte.forEach(row => {
    const line = headers.map(h => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(',');
    lines.push(line);
  });

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `reporte-ava-${new Date().toISOString().slice(0,10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function recortarTexto(text, max) {
  text = String(text || 'SIN DATO');
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function showToast(message) {
  const toast = $('toast');
  toast.textContent = message;
  toast.classList.remove('hidden');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.add('hidden'), 3200);
}

$('btnApply').addEventListener('click', loadDashboard);
$('btnRefresh').addEventListener('click', loadDashboard);
$('btnExportCsv').addEventListener('click', exportCsv);
$('searchInput').addEventListener('input', filterTable);

loadDashboard();
