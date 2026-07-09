const API_URL = 'https://script.google.com/macros/s/AKfycbxpX9FNMZZDL72L76vS4keCiWC3xPb79_cMkpcBk0_AqktKHizk7j5A6r53brRN9y9d/exec';
const HOJAS_COBRO = ['TRT', 'SUR'];
const HOJAS_ADEUDO = ['AVATRT', 'AVASUR'];
const COLORS = {
  green: '#16a34a', red: '#dc2626', blue: '#2563eb', orange: '#f97316', purple: '#7c3aed', cyan: '#0891b2', yellow: '#eab308', dark: '#1f2937', pink: '#db2777'
};
let allRows = [];
let charts = {};
const $ = id => document.getElementById(id);
const money = n => Number(n || 0).toLocaleString('es-MX', { style:'currency', currency:'MXN' });
const num = n => Number(n || 0).toLocaleString('es-MX');

function getField(row, names){
  for(const name of names){
    const key = Object.keys(row).find(k => normalizeKey(k) === normalizeKey(name));
    if(key && row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') return row[key];
  }
  return '';
}
function normalizeKey(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');}
function parseAmount(v){
  if(typeof v === 'number') return v;
  return Number(String(v||'').replace(/\$/g,'').replace(/,/g,'').replace(/%/g,'').trim()) || 0;
}
function parseDate(value){
  if(!value) return null;
  if(value instanceof Date) return value;
  const s = String(value).trim();
  if(/^\d+(\.\d+)?$/.test(s)){
    const serial = Number(s);
    if(serial > 20000) return new Date(Math.round((serial - 25569) * 86400 * 1000));
  }
  let clean = s.replace('a. m.','AM').replace('p. m.','PM').replace('a.m.','AM').replace('p.m.','PM');
  let d = new Date(clean);
  if(!isNaN(d)) return d;
  const m = clean.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?/i);
  if(m){
    let h = Number(m[4]||0); const min = Number(m[5]||0); const sec = Number(m[6]||0); const ap = (m[7]||'').toUpperCase();
    if(ap === 'PM' && h < 12) h += 12; if(ap === 'AM' && h === 12) h = 0;
    return new Date(Number(m[3]), Number(m[2])-1, Number(m[1]), h, min, sec);
  }
  return null;
}
function isoDate(d){ return d ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` : ''; }
function monthKey(d){ return d ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` : 'Sin fecha'; }
function empresaFromSheet(sheet){ return String(sheet||'').toUpperCase().includes('SUR') ? 'SUR' : 'TRT'; }

async function fetchSheet(sheet){
  const url = `${API_URL}?accion=datos&hoja=${encodeURIComponent(sheet)}`;
  const res = await fetch(url);
  if(!res.ok) throw new Error(`No se pudo leer ${sheet}`);
  const data = await res.json();
  return data.datos || data.data || [];
}
async function loadData(){
  setStatus('Cargando información desde Google Sheet...');
  const sheets = [...HOJAS_COBRO, ...HOJAS_ADEUDO];
  const responses = await Promise.all(sheets.map(async sheet => ({sheet, rows: await fetchSheet(sheet)})));
  allRows = responses.flatMap(({sheet, rows}) => rows.map(row => normalizeRow(row, sheet))).filter(r => r.monto > 0 || r.tipo === 'ADEUDO');
  populateFilters();
  applyFilters();
  setStatus(`Información actualizada: ${num(allRows.length)} registros cargados.`, 'ok');
}
function normalizeRow(row, sheet){
  const tipo = HOJAS_ADEUDO.includes(sheet) ? 'ADEUDO' : 'COBRADO';
  const fechaRaw = tipo === 'COBRADO' ? getField(row, ['Fecha del Viaje','Fecha Viaje','Fecha']) : getField(row, ['Fecha Corrida','Fecha Sanción','Fecha Recepción Reporte','Fecha Cobro']);
  const fecha = parseDate(fechaRaw);
  const conductor = getField(row, ['Conductor','Operador']);
  const cajero = tipo === 'COBRADO' ? getField(row, ['Nombre Cajero','Cajero','Cajero Cobro']) : getField(row, ['Preceptor','Analista','Nombre Cajero','Cajero']);
  const monto = tipo === 'COBRADO' ? parseAmount(getField(row, ['Monto Recuperado','Monto','Importe'])) : parseAmount(getField(row, ['Por Cobrar','Costo','Monto','Importe']));
  const estatus = tipo === 'COBRADO' ? 'Cobrado' : String(getField(row, ['Estatus','Sanción','Status']) || 'Pendiente');
  return {
    tipo,
    empresa: empresaFromSheet(sheet),
    sheet,
    fecha,
    fechaISO: isoDate(fecha),
    mes: monthKey(fecha),
    viaje: getField(row, ['Viaje','Id Viaje','ID Viaje','Reporte']),
    autobus: getField(row, ['Autobus','Autobús']),
    conductor,
    cajero,
    estatus,
    monto,
    pasajeros: parseAmount(getField(row, ['Numero de Pasajeros','Número de Pasajeros','Pasajeros'])),
    raw: row
  };
}
function populateFilters(){
  const cajeros = unique(allRows.map(r=>r.cajero).filter(Boolean));
  const conductores = unique(allRows.map(r=>r.conductor).filter(Boolean));
  fillSelect($('filterCajero'), cajeros, 'TODOS', 'Todos');
  fillSelect($('filterConductor'), conductores, 'TODOS', 'Todos');
}
function unique(arr){return [...new Set(arr.map(x=>String(x).trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));}
function fillSelect(select, values, allValue, allText){
  const current = select.value || allValue;
  select.innerHTML = `<option value="${allValue}">${allText}</option>` + values.map(v=>`<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
  select.value = [...select.options].some(o=>o.value===current) ? current : allValue;
}
function applyFilters(){
  const empresa = $('filterEmpresa').value;
  const tipo = $('filterTipo').value;
  const desde = $('filterDesde').value;
  const hasta = $('filterHasta').value;
  const cajero = $('filterCajero').value;
  const conductor = $('filterConductor').value;
  const search = normalizeText($('searchBox').value);
  const rows = allRows.filter(r => {
    if(empresa !== 'TODAS' && r.empresa !== empresa) return false;
    if(tipo !== 'AMBOS' && r.tipo !== tipo) return false;
    if(desde && r.fechaISO < desde) return false;
    if(hasta && r.fechaISO > hasta) return false;
    if(cajero !== 'TODOS' && r.cajero !== cajero) return false;
    if(conductor !== 'TODOS' && r.conductor !== conductor) return false;
    if(search){
      const hay = normalizeText([r.tipo,r.empresa,r.fechaISO,r.viaje,r.conductor,r.cajero,r.estatus,r.monto].join(' '));
      if(!hay.includes(search)) return false;
    }
    return true;
  });
  renderKpis(rows);
  renderCharts(rows);
  renderTable(rows);
}
function renderKpis(rows){
  const cobros = rows.filter(r=>r.tipo==='COBRADO');
  const adeudos = rows.filter(r=>r.tipo==='ADEUDO' && !isCobradoStatus(r.estatus));
  const totalCobrado = sum(cobros, 'monto');
  const totalAdeudo = sum(adeudos, 'monto');
  const recuperacion = totalCobrado + totalAdeudo ? (totalCobrado / (totalCobrado + totalAdeudo)) * 100 : 0;
  $('kpiCobrado').textContent = money(totalCobrado);
  $('kpiCobros').textContent = `${num(cobros.length)} movimientos`;
  $('kpiAdeudo').textContent = money(totalAdeudo);
  $('kpiAdeudos').textContent = `${num(adeudos.length)} pendientes`;
  $('kpiRecuperacion').textContent = `${recuperacion.toFixed(1)}%`;
  $('kpiConductoresAdeudo').textContent = num(unique(adeudos.map(r=>r.conductor)).length);
  $('kpiEventos').textContent = num(sum(rows, 'pasajeros') || rows.length);
  $('kpiPromedio').textContent = money(cobros.length ? totalCobrado / cobros.length : 0);
}
function renderCharts(rows){
  const cobros = rows.filter(r=>r.tipo==='COBRADO');
  const adeudosPend = rows.filter(r=>r.tipo==='ADEUDO' && !isCobradoStatus(r.estatus));
  const porEmpresa = ['TRT','SUR'].map(empresa => ({empresa, cobrado: sum(cobros.filter(r=>r.empresa===empresa),'monto'), adeudo: sum(adeudosPend.filter(r=>r.empresa===empresa),'monto')}));
  drawBar('chartEmpresa', porEmpresa.map(x=>x.empresa), [
    {label:'Cobrado', data:porEmpresa.map(x=>x.cobrado), backgroundColor:COLORS.green},
    {label:'Adeudo', data:porEmpresa.map(x=>x.adeudo), backgroundColor:COLORS.red}
  ]);

  const meses = unique(rows.map(r=>r.mes)).filter(m=>m!=='Sin fecha').sort();
  drawLine('chartTendencia', meses, [
    {label:'Cobrado', data:meses.map(m=>sum(cobros.filter(r=>r.mes===m),'monto')), borderColor:COLORS.green, backgroundColor:'rgba(22,163,74,.12)', tension:.35, fill:true},
    {label:'Adeudo', data:meses.map(m=>sum(adeudosPend.filter(r=>r.mes===m),'monto')), borderColor:COLORS.red, backgroundColor:'rgba(220,38,38,.12)', tension:.35, fill:true}
  ]);

  const cajeros = topGroup(cobros, 'cajero', 12);
  drawBar('chartCajeros', cajeros.map(x=>shortName(x.name)), [{label:'Cobrado', data:cajeros.map(x=>x.total), backgroundColor:palette(cajeros.length)}], true);

  const conductores = topGroup(adeudosPend, 'conductor', 12);
  drawBar('chartConductores', conductores.map(x=>shortName(x.name)), [{label:'Adeudo', data:conductores.map(x=>x.total), backgroundColor:palette(conductores.length, true)}], true);

  const estatus = topGroup(rows.filter(r=>r.tipo==='ADEUDO'), 'estatus', 8);
  drawDoughnut('chartEstatus', estatus.map(x=>x.name), estatus.map(x=>x.total), palette(estatus.length));

  const buckets = bucketAging(adeudosPend);
  drawBar('chartAntiguedad', buckets.map(x=>x.name), [{label:'Adeudo', data:buckets.map(x=>x.total), backgroundColor:[COLORS.green,COLORS.yellow,COLORS.orange,COLORS.red]}]);
}
function renderTable(rows){
  $('tableSummary').textContent = `${num(rows.length)} registros encontrados`;
  $('tableBody').innerHTML = rows.slice(0, 800).map(r => `
    <tr>
      <td><span class="badge ${r.tipo==='COBRADO'?'cobrado':'adeudo'}">${r.tipo}</span></td>
      <td>${r.empresa}</td><td>${r.fechaISO || '<span class="muted">Sin fecha</span>'}</td><td>${escapeHtml(r.viaje)}</td>
      <td>${escapeHtml(r.conductor)}</td><td>${escapeHtml(r.cajero || 'Sin dato')}</td><td>${escapeHtml(r.estatus)}</td><td class="money">${money(r.monto)}</td>
    </tr>`).join('');
}
function isCobradoStatus(v){return normalizeText(v).includes('cobrado') || normalizeText(v).includes('informativo') && parseAmount(v)===0;}
function sum(rows, key){return rows.reduce((a,r)=>a + Number(r[key]||0), 0);}
function topGroup(rows, key, limit){
  const map = new Map();
  rows.forEach(r=>{const k=r[key]||'Sin dato'; map.set(k,(map.get(k)||0)+r.monto);});
  return [...map.entries()].map(([name,total])=>({name,total})).sort((a,b)=>b.total-a.total).slice(0,limit);
}
function bucketAging(rows){
  const now = new Date(); const buckets = [{name:'0-7 días', total:0},{name:'8-15 días', total:0},{name:'16-30 días', total:0},{name:'30+ días', total:0}];
  rows.forEach(r=>{const days = r.fecha ? Math.floor((now-r.fecha)/86400000) : 999; const i = days<=7?0:days<=15?1:days<=30?2:3; buckets[i].total += r.monto;});
  return buckets;
}
function drawBar(id, labels, datasets, horizontal=false){
  drawChart(id, {type:'bar', data:{labels,datasets}, options:baseOptions(horizontal)});
}
function drawLine(id, labels, datasets){
  drawChart(id, {type:'line', data:{labels,datasets}, options:baseOptions(false)});
}
function drawDoughnut(id, labels, data, colors){
  drawChart(id, {type:'doughnut', data:{labels,datasets:[{data, backgroundColor:colors, borderWidth:0}]}, options:{responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'bottom'}, tooltip:{callbacks:{label:c=>`${c.label}: ${money(c.raw)}`}}}});
}
function drawChart(id, config){
  if(charts[id]) charts[id].destroy();
  charts[id] = new Chart($(id), config);
}
function baseOptions(horizontal){
  return {responsive:true, maintainAspectRatio:false, indexAxis: horizontal?'y':'x', plugins:{legend:{position:'bottom'}, tooltip:{callbacks:{label:c=>`${c.dataset.label}: ${money(c.raw)}`}}}, scales:{x:{grid:{display:false}, ticks:{autoSkip:false, maxRotation: horizontal?0:35}}, y:{beginAtZero:true, ticks:{callback:v=>money(v)}}}};
}
function palette(n, warm=false){
  const base = warm ? [COLORS.red,COLORS.orange,COLORS.pink,COLORS.purple,COLORS.yellow,COLORS.dark,COLORS.blue,COLORS.cyan] : [COLORS.blue,COLORS.green,COLORS.purple,COLORS.orange,COLORS.cyan,COLORS.pink,COLORS.yellow,COLORS.dark];
  return Array.from({length:n},(_,i)=>base[i%base.length]);
}
function shortName(name){return String(name||'Sin dato').replace(/^\d+\s+/, '').slice(0,34);}
function normalizeText(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
function escapeHtml(v){return String(v??'').replace(/[&<>"]/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));}
function setStatus(text, type=''){ $('statusBox').textContent = text; $('statusBox').className = `status-card ${type}`; }
function exportCsv(){
  const headers = ['Tipo','Empresa','Fecha','Viaje','Conductor','Cajero','Estatus','Monto'];
  const rows = [...document.querySelectorAll('#tableBody tr')].map(tr => [...tr.children].map(td => td.innerText.replace(/\n/g,' ').trim()));
  const csv = [headers, ...rows].map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'reporte-ava.csv'; a.click(); URL.revokeObjectURL(a.href);
}
['filterEmpresa','filterTipo','filterDesde','filterHasta','filterCajero','filterConductor','searchBox'].forEach(id=>$(id).addEventListener('input', applyFilters));
$('btnRefresh').addEventListener('click', loadData);
$('btnExportCsv').addEventListener('click', exportCsv);
loadData().catch(err => setStatus(`Error al cargar datos: ${err.message}. Verifica que la implementación de Apps Script esté publicada para cualquier usuario.`, 'error'));
