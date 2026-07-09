const API_URL = 'https://script.google.com/macros/s/AKfycbxpX9FNMZZDL72L76vS4keCiWC3xPb79_cMkpcBk0_AqktKHizk7j5A6r53brRN9y9d/exec';
const HOJAS = [
  { nombre: 'TRT', empresa: 'TRT', tipo: 'COBRADO' },
  { nombre: 'SUR', empresa: 'SUR', tipo: 'COBRADO' },
  { nombre: 'AVATRT', empresa: 'TRT', tipo: 'ADEUDO' },
  { nombre: 'AVASUR', empresa: 'SUR', tipo: 'ADEUDO' }
];
const COLORS = ['#0f766e','#2563eb','#f59e0b','#dc2626','#7c3aed','#0891b2','#16a34a','#db2777','#475569','#ea580c'];
let allRows = [];
let currentRows = [];
let charts = {};

const $ = id => document.getElementById(id);
const money = n => Number(n || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
const number = n => Number(n || 0).toLocaleString('es-MX');
const cleanKey = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const cleanText = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function setStatus(msg, type = '') {
  $('statusBox').textContent = msg;
  $('statusBox').className = `status card ${type}`;
  $('lastUpdate').textContent = msg;
}

function getField(row, names) {
  const keys = Object.keys(row || {});
  for (const name of names) {
    const found = keys.find(k => cleanKey(k) === cleanKey(name));
    if (found && row[found] !== null && row[found] !== undefined && String(row[found]).trim() !== '') return row[found];
  }
  return '';
}

function parseAmount(v) {
  if (typeof v === 'number') return v;
  return Number(String(v || '').replace(/\$/g, '').replace(/,/g, '').replace(/%/g, '').trim()) || 0;
}

function parseDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  const s = String(v).trim();
  if (/^\d+(\.\d+)?$/.test(s)) {
    const serial = Number(s);
    if (serial > 20000) return new Date(Math.round((serial - 25569) * 86400 * 1000));
  }
  let d = new Date(s.replace('a. m.', 'AM').replace('p. m.', 'PM').replace('a.m.', 'AM').replace('p.m.', 'PM'));
  if (!isNaN(d)) return d;
  const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return null;
}

function isoDate(d) {
  if (!d) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function monthKey(d) {
  if (!d) return 'Sin fecha';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

async function fetchWithTimeout(url, ms = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { cache: 'no-store', signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchSheet(cfg) {
  const url = `${API_URL}?accion=datos&hoja=${encodeURIComponent(cfg.nombre)}&t=${Date.now()}`;
  const data = await fetchWithTimeout(url);
  if (data.error) throw new Error(data.mensaje || 'Apps Script devolvió error');
  const rows = data.datos || data.data || [];
  return rows.map(row => normalizeRow(row, cfg));
}

function normalizeRow(row, cfg) {
  const fechaRaw = cfg.tipo === 'COBRADO'
    ? getField(row, ['Fecha del Viaje', 'Fecha Viaje', 'Fecha', 'Fecha Cobro'])
    : getField(row, ['Fecha Corrida', 'Fecha Sanción', 'Fecha Recepción Reporte', 'Fecha']);
  const fecha = parseDate(fechaRaw);
  const conductor = getField(row, ['Conductor', 'Operador']);
  const cajero = cfg.tipo === 'COBRADO'
    ? getField(row, ['Nombre Cajero', 'Cajero', 'Cajero Cobro'])
    : getField(row, ['Preceptor', 'Analista', 'Nombre Cajero', 'Cajero']);
  const monto = cfg.tipo === 'COBRADO'
    ? parseAmount(getField(row, ['Monto Recuperado', 'Monto', 'Importe']))
    : parseAmount(getField(row, ['Por Cobrar', 'Costo', 'Monto Adeudo', 'Adeudo', 'Monto', 'Importe']));
  return {
    tipo: cfg.tipo,
    empresa: cfg.empresa,
    hoja: cfg.nombre,
    fecha,
    fechaISO: isoDate(fecha),
    mes: monthKey(fecha),
    viaje: getField(row, ['Viaje', 'Id Viaje', 'ID Viaje', 'Reporte']),
    autobus: getField(row, ['Autobus', 'Autobús']),
    conductor,
    cajero,
    estatus: cfg.tipo === 'COBRADO' ? 'Cobrado' : String(getField(row, ['Sanción', 'Estatus', 'Status', 'Tipo']) || 'Pendiente'),
    monto,
    pasajeros: parseAmount(getField(row, ['Numero de Pasajeros', 'Número de Pasajeros', 'Pasajeros'])),
    raw: row
  };
}

async function loadData() {
  allRows = [];
  clearVisuals();
  setStatus('Cargando información desde Google Sheet...');
  const errores = [];

  for (const cfg of HOJAS) {
    try {
      setStatus(`Leyendo pestaña ${cfg.nombre}...`);
      const rows = await fetchSheet(cfg);
      allRows.push(...rows);
    } catch (err) {
      console.error(cfg.nombre, err);
      errores.push(`${cfg.nombre}: ${err.name === 'AbortError' ? 'tiempo agotado' : err.message}`);
    }
  }

  allRows = allRows.filter(r => r.conductor || r.viaje || r.monto > 0);
  populateFilters();
  applyFilters();

  if (!allRows.length) {
    setStatus('No se pudieron cargar registros. Abre la consola del navegador con F12 para ver el detalle o revisa que el Apps Script esté publicado para cualquier usuario.', 'error');
    return;
  }

  const msg = `Actualizado: ${number(allRows.length)} registros cargados de Google Sheet.`;
  setStatus(errores.length ? `${msg} Hojas con aviso: ${errores.join(' | ')}` : msg, errores.length ? 'warn' : 'ok');
}

function populateFilters() {
  fillSelect('cajeroSelect', unique(allRows.map(r => r.cajero).filter(Boolean)), 'Todos');
  fillSelect('conductorSelect', unique(allRows.map(r => r.conductor).filter(Boolean)), 'Todos');
}
function fillSelect(id, values, label) {
  const select = $(id);
  const current = select.value;
  select.innerHTML = `<option value="">${label}</option>` + values.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
  if (values.includes(current)) select.value = current;
}
function unique(arr) { return [...new Set(arr.map(v => String(v).trim()).filter(Boolean))].sort((a,b) => a.localeCompare(b, 'es')); }

function applyFilters() {
  const empresa = $('empresaSelect').value;
  const tipo = $('tipoSelect').value;
  const desde = $('desdeInput').value;
  const hasta = $('hastaInput').value;
  const cajero = $('cajeroSelect').value;
  const conductor = $('conductorSelect').value;
  const search = cleanText($('searchInput').value);

  currentRows = allRows.filter(r => {
    if (empresa && r.empresa !== empresa) return false;
    if (tipo && r.tipo !== tipo) return false;
    if (desde && r.fechaISO && r.fechaISO < desde) return false;
    if (hasta && r.fechaISO && r.fechaISO > hasta) return false;
    if (cajero && r.cajero !== cajero) return false;
    if (conductor && r.conductor !== conductor) return false;
    if (search && !cleanText([r.tipo, r.empresa, r.fechaISO, r.viaje, r.conductor, r.cajero, r.estatus, r.monto].join(' ')).includes(search)) return false;
    return true;
  });

  renderKpis(currentRows);
  renderTable(currentRows);
  renderChartsSafe(currentRows);
}

function isPendingDebt(r) {
  const s = cleanText(r.estatus);
  if (s.includes('cobrado') || s.includes('pagado') || s.includes('condonado')) return false;
  return r.tipo === 'ADEUDO';
}
function renderKpis(rows) {
  const cobros = rows.filter(r => r.tipo === 'COBRADO');
  const adeudos = rows.filter(isPendingDebt);
  const totalCobrado = sum(cobros);
  const totalAdeudo = sum(adeudos);
  const recuperacion = totalCobrado + totalAdeudo ? (totalCobrado / (totalCobrado + totalAdeudo)) * 100 : 0;
  $('kpiCobrado').textContent = money(totalCobrado);
  $('kpiCobros').textContent = `${number(cobros.length)} movimientos`;
  $('kpiAdeudo').textContent = money(totalAdeudo);
  $('kpiAdeudos').textContent = `${number(adeudos.length)} pendientes`;
  $('kpiRecuperacion').textContent = `${recuperacion.toFixed(1)}%`;
  $('kpiConductoresAdeudo').textContent = number(unique(adeudos.map(r => r.conductor)).length);
}
function renderTable(rows) {
  $('tableSummary').textContent = `${number(rows.length)} registros encontrados`;
  $('tableBody').innerHTML = rows.slice(0, 1000).map(r => `
    <tr>
      <td><span class="badge ${r.tipo === 'COBRADO' ? 'cobrado' : 'adeudo'}">${r.tipo}</span></td>
      <td>${r.empresa}</td>
      <td>${r.fechaISO || '<span class="muted">Sin fecha</span>'}</td>
      <td>${escapeHtml(r.viaje)}</td>
      <td>${escapeHtml(r.conductor || 'Sin dato')}</td>
      <td>${escapeHtml(r.cajero || 'Sin dato')}</td>
      <td>${escapeHtml(r.estatus)}</td>
      <td class="money">${money(r.monto)}</td>
    </tr>
  `).join('');
}

function renderChartsSafe(rows) {
  if (!window.Chart) return;
  try { renderCharts(rows); } catch (err) { console.error(err); setStatus(`Datos cargados, pero hubo un detalle al dibujar gráficas: ${err.message}`, 'warn'); }
}
function renderCharts(rows) {
  const cobros = rows.filter(r => r.tipo === 'COBRADO');
  const adeudos = rows.filter(isPendingDebt);
  const empresas = ['TRT', 'SUR'].map(empresa => ({ empresa, cobrado: sum(cobros.filter(r => r.empresa === empresa)), adeudo: sum(adeudos.filter(r => r.empresa === empresa)) }));
  drawBar('chartEmpresa', empresas.map(x => x.empresa), [
    { label: 'Cobrado', data: empresas.map(x => x.cobrado), backgroundColor: '#16a34a' },
    { label: 'Adeudo', data: empresas.map(x => x.adeudo), backgroundColor: '#dc2626' }
  ]);

  const meses = unique(rows.map(r => r.mes).filter(m => m !== 'Sin fecha'));
  drawLine('chartTendencia', meses, [
    { label: 'Cobrado', data: meses.map(m => sum(cobros.filter(r => r.mes === m))), borderColor: '#16a34a', backgroundColor: 'rgba(22,163,74,.14)', fill: true, tension: .35 },
    { label: 'Adeudo', data: meses.map(m => sum(adeudos.filter(r => r.mes === m))), borderColor: '#dc2626', backgroundColor: 'rgba(220,38,38,.14)', fill: true, tension: .35 }
  ]);

  const cajeros = topGroup(cobros, 'cajero', 12);
  drawBar('chartCajeros', cajeros.map(x => shortLabel(x.name)), [{ label: 'Cobrado', data: cajeros.map(x => x.total), backgroundColor: makePalette(cajeros.length) }], true);

  const conductores = topGroup(adeudos, 'conductor', 12);
  drawBar('chartConductores', conductores.map(x => shortLabel(x.name)), [{ label: 'Adeudo', data: conductores.map(x => x.total), backgroundColor: makePalette(conductores.length).reverse() }], true);

  const estatus = topGroup(rows.filter(r => r.tipo === 'ADEUDO'), 'estatus', 8);
  drawDoughnut('chartEstatus', estatus.map(x => shortLabel(x.name)), estatus.map(x => x.total), makePalette(estatus.length));
}
function clearVisuals() {
  Object.values(charts).forEach(c => c && c.destroy && c.destroy());
  charts = {};
  $('tableBody').innerHTML = '';
}
function drawBar(id, labels, datasets, horizontal = false) {
  drawChart(id, { type: 'bar', data: { labels, datasets }, options: chartOptions(horizontal) });
}
function drawLine(id, labels, datasets) {
  drawChart(id, { type: 'line', data: { labels, datasets }, options: chartOptions(false) });
}
function drawDoughnut(id, labels, data, colors) {
  drawChart(id, { type: 'doughnut', data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: c => `${c.label}: ${money(c.raw)}` } } } } });
}
function drawChart(id, config) {
  const canvas = $(id);
  if (!canvas) return;
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart(canvas, config);
}
function chartOptions(horizontal) {
  return { responsive: true, maintainAspectRatio: false, indexAxis: horizontal ? 'y' : 'x', plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: c => `${c.dataset.label}: ${money(c.raw)}` } } }, scales: { x: { grid: { display: false }, ticks: { autoSkip: false, maxRotation: horizontal ? 0 : 35 } }, y: { beginAtZero: true, ticks: { callback: v => horizontal ? v : money(v) } } } };
}
function sum(rows) { return rows.reduce((acc, r) => acc + Number(r.monto || 0), 0); }
function topGroup(rows, key, limit) {
  const map = new Map();
  rows.forEach(r => { const name = r[key] || 'Sin dato'; map.set(name, (map.get(name) || 0) + Number(r.monto || 0)); });
  return [...map.entries()].map(([name,total]) => ({ name, total })).sort((a,b) => b.total - a.total).slice(0, limit);
}
function makePalette(n) { return Array.from({ length: n }, (_, i) => COLORS[i % COLORS.length]); }
function shortLabel(v) { return String(v || 'Sin dato').replace(/^\d+\s+/, '').slice(0, 34); }
function escapeHtml(v) { return String(v ?? '').replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m])); }
function exportCsv() {
  const headers = ['Tipo','Empresa','Fecha','Viaje','Conductor','Cajero/Preceptor','Estatus','Monto'];
  const rows = currentRows.map(r => [r.tipo, r.empresa, r.fechaISO, r.viaje, r.conductor, r.cajero, r.estatus, r.monto]);
  const csv = [headers, ...rows].map(row => row.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'reporte-ava.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

window.addEventListener('DOMContentLoaded', () => {
  ['empresaSelect','tipoSelect','desdeInput','hastaInput','cajeroSelect','conductorSelect','searchInput'].forEach(id => $(id).addEventListener('input', applyFilters));
  $('btnApply').addEventListener('click', applyFilters);
  $('btnRefresh').addEventListener('click', loadData);
  $('btnExportCsv').addEventListener('click', exportCsv);
  loadData();
});
