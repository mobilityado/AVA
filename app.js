const API_URL = 'https://script.google.com/macros/s/AKfycbxpX9FNMZZDL72L76vS4keCiWC3xPb79_cMkpcBk0_AqktKHizk7j5A6r53brRN9y9d/exec';

const state = {
  rawReporte: [],
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
    const reporte = await api('reporte');
    state.rawReporte = reporte.datos || [];

    populateCajeros();
    applyClientFilters();

    $('lastUpdate').textContent = `Última actualización: ${new Date().toLocaleString('es-MX')}`;
    showToast('Dashboard actualizado correctamente');
  } catch (error) {
    console.error(error);
    showToast(`No se pudo cargar la información: ${error.message}`);
  }
}

function applyClientFilters() {
  const cajero = $('cajeroSelect').value;

  state.reporte = state.rawReporte.filter(row => {
    if (!cajero) return true;
    return getValue(row, ['Nombre Cajero', 'Cajero', 'Cajero Cobro']) === cajero;
  });

  renderKpis();
  renderCharts();
  renderTable(state.reporte);
}

function populateCajeros() {
  const select = $('cajeroSelect');
  const selected = select.value;
  const cajeros = [...new Set(
    state.rawReporte
      .map(row => getValue(row, ['Nombre Cajero', 'Cajero', 'Cajero Cobro']))
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b, 'es'));

  select.innerHTML = '<option value="">Todos</option>' +
    cajeros.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');

  if (cajeros.includes(selected)) select.value = selected;
}

function renderKpis() {
  const rows = state.reporte;
  const totalMonto = rows.reduce((sum, row) => sum + getMonto(row), 0);
  const totalPasajeros = rows.reduce((sum, row) => sum + getNumero(row, ['Numero de Pasajeros', 'Número de Pasajeros', 'Pasajeros']), 0);

  $('kpiRegistros').textContent = number(rows.length);
  $('kpiMonto').textContent = money(totalMonto);
  $('kpiPasajeros').textContent = number(totalPasajeros);
  $('kpiPromedio').textContent = money(rows.length ? totalMonto / rows.length : 0);
}

function renderCharts() {
  renderLineChart('chartTendencia', buildTendencia());
  renderBarChart('chartHojas', buildAgrupado(['hoja'], 'Monto recuperado'), false);
  renderBarChart('chartConductores', buildAgrupado(['Conductor', 'Nombre Conductor'], 'Monto por conductor', 10, 18), true);
  renderBarChart('chartCajeros', buildAgrupado(['Nombre Cajero', 'Cajero', 'Cajero Cobro'], 'Monto cobrado por cajero', 15, 22), true);
}

function buildTendencia() {
  const mapa = new Map();

  state.reporte.forEach(row => {
    const fecha = formatDate(getValue(row, ['Fecha del Viaje', 'Fecha Viaje', 'Fecha']));
    if (!fecha) return;
    mapa.set(fecha, (mapa.get(fecha) || 0) + getMonto(row));
  });

  const data = [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  return {
    labels: data.map(item => item[0]),
    data: data.map(item => item[1]),
    label: 'Monto recuperado'
  };
}

function buildAgrupado(campos, label, limite = 15, maxText = 18) {
  const mapa = new Map();

  state.reporte.forEach(row => {
    const nombre = getValue(row, campos) || 'SIN DATO';
    mapa.set(nombre, (mapa.get(nombre) || 0) + getMonto(row));
  });

  const ordenado = [...mapa.entries()]
    .map(([nombre, monto]) => ({ nombre, monto }))
    .sort((a, b) => b.monto - a.monto)
    .slice(0, limite);

  return {
    labels: ordenado.map(x => recortarTexto(x.nombre, maxText)),
    data: ordenado.map(x => x.monto),
    label
  };
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
      x: {
        ticks: {
          autoSkip: true,
          maxRotation: 0,
          callback: function(value) {
            return horizontal ? money(value) : this.getLabelForValue(value);
          }
        }
      },
      y: {
        ticks: {
          callback: function(value) {
            return horizontal ? this.getLabelForValue(value) : money(value);
          }
        }
      }
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
  head.innerHTML = `<tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr>`;

  body.innerHTML = rows.map(row => `
    <tr>
      ${headers.map(h => `<td>${formatCell(h, row[h])}</td>`).join('')}
    </tr>
  `).join('');
}

function formatCell(header, value) {
  if (header.toLowerCase().includes('monto')) return money(value);
  return escapeHtml(value ?? '');
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

function getValue(row, keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
      return String(row[key]).trim();
    }
  }
  return '';
}

function getMonto(row) {
  if (row.montoRecuperadoNumero !== undefined) return Number(row.montoRecuperadoNumero) || 0;
  const value = getValue(row, ['Monto Recuperado', 'Monto', 'Importe']);
  return Number(String(value).replace('$', '').replace(/,/g, '').trim()) || 0;
}

function getNumero(row, keys) {
  return Number(String(getValue(row, keys)).replace(/,/g, '').trim()) || 0;
}

function formatDate(value) {
  const fecha = new Date(value);
  if (isNaN(fecha)) return null;
  const yyyy = fecha.getFullYear();
  const mm = String(fecha.getMonth() + 1).padStart(2, '0');
  const dd = String(fecha.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function recortarTexto(text, max) {
  text = String(text || 'SIN DATO');
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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
$('cajeroSelect').addEventListener('change', applyClientFilters);

loadDashboard();
