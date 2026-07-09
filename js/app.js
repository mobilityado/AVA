const API_URL = 'https://script.google.com/macros/s/AKfycbxpX9FNMZZDL72L76vS4keCiWC3xPb79_cMkpcBk0_AqktKHizk7j5A6r53brRN9y9d/exec';
const SHEETS = [
  { hoja:'TRT', empresa:'TRT', tipo:'COBRADO' },
  { hoja:'SUR', empresa:'SUR', tipo:'COBRADO' },
  { hoja:'AVATRT', empresa:'TRT', tipo:'ADEUDO' },
  { hoja:'AVASUR', empresa:'SUR', tipo:'ADEUDO' }
];
let rawRows = [], filteredRows = [], charts = {};
const $ = id => document.getElementById(id);
const money = n => Number(n||0).toLocaleString('es-MX',{style:'currency',currency:'MXN'});
const norm = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const pick = (obj, names) => { const keys=Object.keys(obj||{}); for(const n of names){ const k=keys.find(x=>norm(x)===norm(n)); if(k && obj[k]!=='' && obj[k]!=null) return obj[k]; } for(const n of names){ const k=keys.find(x=>norm(x).includes(norm(n)) || norm(n).includes(norm(x))); if(k && obj[k]!=='' && obj[k]!=null) return obj[k]; } return ''; };
const amountFrom = (r,tipo) => num(pick(r, tipo==='ADEUDO' ? ['Por Cobrar','Total Por Cobrar','Monto Adeudo','Adeudo','Saldo','Importe','Costo','Monto Recuperado'] : ['Monto Recuperado','Monto','Importe','Por Cobrar']));
function num(v){ if(typeof v==='number') return v; return Number(String(v||'').replace(/[$,\s]/g,'').replace(/\((.*)\)/,'-$1'))||0; }
function dateFrom(r){
  return pick(r,[
    'Fecha del Viaje','Fecha Viaje','Fecha','Fecha Cobro','FECHA',
    'Fecha Corrida','Fecha Recepción Reporte','Fecha Recepcion Reporte','Fecha Sanción','Fecha Sancion'
  ]);
}
function isValidPeriodDate(d){
  if(!d || isNaN(d)) return false;
  const y = d.getFullYear();
  // Evita que importes, horas, folios o años raros como 5000 entren como fecha.
  return y >= 2020 && y <= 2035;
}
function dateObj(v){
  if(!v && v!==0) return null;
  if(v instanceof Date && isValidPeriodDate(v)) return v;

  // Si Google/Excel manda número serial de fecha
  if(typeof v === 'number'){
    if(v > 20000){
      const d = new Date(Math.round((v - 25569) * 86400 * 1000));
      if(isValidPeriodDate(d)) return d;
    }
    return null;
  }

  let raw = String(v).trim();
  if(!raw) return null;

  // Quita espacios raros y variantes de a. m. / p. m.
  raw = raw
    .replace(/\u00a0/g,' ')
    .replace(/\s+/g,' ')
    .replace(/a\s*\.\s*m\s*\.?/ig,'AM')
    .replace(/p\s*\.\s*m\s*\.?/ig,'PM')
    .replace(/a\s*m\s*\.?/ig,'AM')
    .replace(/p\s*m\s*\.?/ig,'PM')
    .trim();

  // ISO o formato generado por Apps Script: yyyy-mm-dd hh:mm:ss
  let m = raw.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?/i);
  if(m){
    let yy=+m[1], mm=+m[2]-1, dd=+m[3], hh=+(m[4]||0), mi=+(m[5]||0), ss=+(m[6]||0);
    const ap=(m[7]||'').toUpperCase();
    if(ap==='PM' && hh<12) hh+=12;
    if(ap==='AM' && hh===12) hh=0;
    const d = new Date(yy,mm,dd,hh,mi,ss);
    if(isValidPeriodDate(d)) return d;
  }

  // Formato México: dd/mm/yyyy hh:mm:ss AM/PM
  m = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?/i);
  if(m){
    let dd=+m[1], mm=+m[2]-1, yy=+m[3], hh=+(m[4]||0), mi=+(m[5]||0), ss=+(m[6]||0);
    const ap=(m[7]||'').toUpperCase();
    if(ap==='PM' && hh<12) hh+=12;
    if(ap==='AM' && hh===12) hh=0;
    const d = new Date(yy,mm,dd,hh,mi,ss);
    if(isValidPeriodDate(d)) return d;
  }

  const d = new Date(raw);
  return isValidPeriodDate(d) ? d : null;
}
function ymd(d){ if(!d) return ''; return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function monthKey(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }
function yearKey(d){ return String(d.getFullYear()); }
function conductorFrom(r){ return pick(r,['Conductor','Nombre Conductor','Operador','Nombre Operador']); }
function cajeroFrom(r){ return pick(r,['Nombre Cajero','Cajero','Cajero Cobro','Usuario Cobro','Nombre del Cajero']); }
function busFrom(r){ return pick(r,['Autobús','Autobus','Unidad','No Economico','No. Económico','Eco']); }
function folioFrom(r){ return pick(r,['Viaje','Id Viaje','Folio','Numero Viaje','No Viaje','Num Viaje']); }
function estatusFrom(r,tipo){
  const e = pick(r,['Estatus','Status','Estado','Situación','Situacion']);
  if(e) return String(e).trim().toUpperCase();
  return tipo === 'COBRADO' ? 'COBRADO' : 'SIN ESTATUS';
}
async function fetchSheet(meta){
  const res = await fetch(`${API_URL}?accion=datos&hoja=${encodeURIComponent(meta.hoja)}&t=${Date.now()}`);
  const json = await res.json();
  if(json.error) throw new Error(`${meta.hoja}: ${json.mensaje}`);
  const rows = Array.isArray(json.datos) ? json.datos : [];
  return rows.map(r=>{
    const fechaRaw = dateFrom(r);
    const d=dateObj(fechaRaw);
    return {...r, _hoja:meta.hoja, _empresa:meta.empresa, _tipo:meta.tipo, _monto:amountFrom(r,meta.tipo), _fecha:d, _fechaRaw:String(fechaRaw||''), _fechaTexto:d?ymd(d):String(fechaRaw||''), _conductor:String(conductorFrom(r)||'SIN DATO').trim(), _cajero:String(cajeroFrom(r)||'SIN DATO').trim(), _bus:String(busFrom(r)||'').trim(), _folio:String(folioFrom(r)||'').trim(), _estatus:estatusFrom(r, meta.tipo)};
  }).filter(r=>r._monto>0 || r._conductor !== 'SIN DATO');
}
async function loadData(){
  setStatus('Cargando información...', 'loading');
  try{
    const chunks = await Promise.all(SHEETS.map(fetchSheet));
    rawRows = chunks.flat();
    fillCajeros(); fillEstatus(); applyFilters();
    $('lastUpdate').textContent = new Date().toLocaleString('es-MX');
    $('sideStatus').textContent = 'Información cargada correctamente';
    setStatus(`Información cargada · ${rawRows.length} registros · Adeudos con fecha: ${rawRows.filter(r=>r._tipo==='ADEUDO' && periodKeyForRow(r,'month')).length}`, 'ok');
  }catch(e){ console.error(e); setStatus('Error de conexión: '+e.message, 'error'); $('sideStatus').textContent='Error al cargar'; }
  setTimeout(()=>$('splash')?.classList.add('hide'),700);
}
function setStatus(text, cls){ const el=$('connectionStatus'); el.textContent=text; el.className='pill '+cls; }
function fillCajeros(){ const cajeros=[...new Set(rawRows.filter(r=>r._tipo==='COBRADO').map(r=>r._cajero).filter(x=>x&&x!=='SIN DATO'))].sort(); $('cajeroFilter').innerHTML='<option value="TODOS">Todos</option>'+cajeros.map(c=>`<option>${escapeHtml(c)}</option>`).join(''); }
function fillEstatus(){ const estatus=[...new Set(rawRows.map(r=>r._estatus).filter(Boolean))].sort(); const el=$('estatusFilter'); if(el) el.innerHTML='<option value="TODOS">Todos</option>'+estatus.map(e=>`<option>${escapeHtml(e)}</option>`).join(''); }
function applyFilters(){
  const emp=$('empresaFilter').value, tipo=$('tipoFilter').value, caj=$('cajeroFilter').value, est=($('estatusFilter')?.value||'TODOS'), q=norm($('searchFilter').value);
  const desde=$('desdeFilter').value?new Date($('desdeFilter').value+'T00:00:00'):null; const hasta=$('hastaFilter').value?new Date($('hastaFilter').value+'T23:59:59'):null;
  filteredRows=rawRows.filter(r=>{
    if(emp!=='TODAS' && r._empresa!==emp) return false; if(tipo!=='AMBOS' && r._tipo!==tipo) return false; if(caj!=='TODOS' && r._cajero!==caj) return false; if(est!=='TODOS' && r._estatus!==est) return false;
    if(desde && (!r._fecha || r._fecha<desde)) return false; if(hasta && (!r._fecha || r._fecha>hasta)) return false;
    if(q && !norm(`${r._conductor} ${r._bus} ${r._folio} ${r._cajero}`).includes(q)) return false; return true;
  });
  renderAll();
}
const sumByType = t => filteredRows.filter(r=>r._tipo===t).reduce((s,r)=>s+r._monto,0);
function renderAll(){
  const cob=sumByType('COBRADO'), ade=sumByType('ADEUDO'), total=cob+ade, pct=total?cob/total*100:0;
  animateText('kpiCobrado', money(cob)); animateText('kpiAdeudo', money(ade)); animateText('kpiRecuperacion', pct.toFixed(1)+'%'); animateText('kpiConductores', new Set(filteredRows.filter(r=>r._tipo==='ADEUDO'&&r._monto>0).map(r=>r._conductor)).size);
  $('kpiMovimientos').textContent = `${filteredRows.filter(r=>r._tipo==='COBRADO').length} movimientos`; $('kpiPendientes').textContent = `${filteredRows.filter(r=>r._tipo==='ADEUDO').length} pendientes`;
  $('donutPercent').textContent=pct.toFixed(1)+'%'; $('donutCobrado').textContent=money(cob); $('donutAdeudo').textContent=money(ade);
  renderCharts(cob,ade,pct); renderTable();
}
function grouped(rows, keyFn, valFn){ const m=new Map(); rows.forEach(r=>{const k=keyFn(r)||'SIN DATO'; m.set(k,(m.get(k)||0)+valFn(r));}); return [...m].map(([name,value])=>({name,value})); }
function periodKeyForRow(r, period){
  const d = r._fecha || dateObj(r._fechaRaw) || dateObj(pick(r,['Fecha Corrida','Fecha del Viaje','Fecha Viaje','Fecha','Fecha Cobro','Fecha Sanción','Fecha Sancion','Fecha Recepción Reporte','Fecha Recepcion Reporte']));
  if(!d) return '';
  return period==='year' ? yearKey(d) : monthKey(d);
}
function byPeriod(period){
  const mapa = new Map();
  filteredRows.forEach(r=>{
    const k = periodKeyForRow(r, period);
    if(!k) return;
    if(!mapa.has(k)) mapa.set(k,{name:k,cobrado:0,adeudo:0});
    const item = mapa.get(k);
    if(r._tipo==='COBRADO') item.cobrado += r._monto;
    if(r._tipo==='ADEUDO') item.adeudo += r._monto;
  });
  return [...mapa.values()].sort((a,b)=>a.name.localeCompare(b.name));
}
function renderCharts(cob,ade,pct){
  const css=getComputedStyle(document.documentElement); const green=css.getPropertyValue('--green').trim(), red=css.getPropertyValue('--red').trim(), purple=css.getPropertyValue('--purple').trim(), blue=css.getPropertyValue('--blue').trim(), gold=css.getPropertyValue('--gold').trim();
  const empresa=['TRT','SUR'].map(e=>({name:e,cobrado:filteredRows.filter(r=>r._empresa===e&&r._tipo==='COBRADO').reduce((s,r)=>s+r._monto,0),adeudo:filteredRows.filter(r=>r._empresa===e&&r._tipo==='ADEUDO').reduce((s,r)=>s+r._monto,0)}));
  bar('chartEmpresa', empresa.map(x=>x.name), [{label:'Cobrado',data:empresa.map(x=>x.cobrado),bg:grad('chartEmpresa',green,'#6ee7b7')},{label:'Adeudo',data:empresa.map(x=>x.adeudo),bg:grad('chartEmpresa',red,'#fb7185')}]);
  doughnut('chartDonut',[cob,ade],[green,red]);
  const mensual=byPeriod('month').slice(-12); line('chartMensual', mensual.map(x=>x.name), [{label:'Cobrado',data:mensual.map(x=>x.cobrado),color:green},{label:'Adeudo',data:mensual.map(x=>x.adeudo),color:red}]);
  const anual=byPeriod('year'); bar('chartAnual', anual.map(x=>x.name), [{label:'Cobrado',data:anual.map(x=>x.cobrado),bg:grad('chartAnual',blue,'#38bdf8')},{label:'Adeudo',data:anual.map(x=>x.adeudo),bg:grad('chartAnual',purple,'#c084fc')}]);
  const topC=grouped(filteredRows.filter(r=>r._tipo==='COBRADO'),r=>r._cajero,r=>r._monto).sort((a,b)=>b.value-a.value).slice(0,10).reverse(); horizontal('chartCajeros', topC.map(x=>x.name), topC.map(x=>x.value), grad('chartCajeros',blue,green),'Recuperado');
  const topD=grouped(filteredRows.filter(r=>r._tipo==='ADEUDO'),r=>r._conductor,r=>r._monto).sort((a,b)=>b.value-a.value).slice(0,10).reverse(); horizontal('chartConductores', topD.map(x=>x.name), topD.map(x=>x.value), grad('chartConductores',red,gold),'Adeudo');
  const statusMonto=grouped(filteredRows, r=>r._estatus || 'SIN ESTATUS', r=>r._monto).sort((a,b)=>b.value-a.value);
  const statusConteo=grouped(filteredRows, r=>r._estatus || 'SIN ESTATUS', r=>1).sort((a,b)=>b.value-a.value);
  if($('chartEstatusMonto')) horizontal('chartEstatusMonto', statusMonto.map(x=>x.name), statusMonto.map(x=>x.value), grad('chartEstatusMonto',purple,'#ec4899'),'Monto');
  if($('chartEstatusConteo')) doughnutGeneric('chartEstatusConteo', statusConteo.map(x=>x.name), statusConteo.map(x=>x.value), [purple, red, green, blue, gold, '#ec4899', '#14b8a6']);
}
function baseOptions(){return {responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{usePointStyle:true}},tooltip:{callbacks:{label:c=>`${c.dataset.label||''}: ${money(c.raw)}`}}},scales:{y:{ticks:{callback:v=>money(v)},grid:{color:'rgba(120,120,140,.12)'}},x:{grid:{display:false}}},animation:{duration:900,easing:'easeOutQuart'}}}
function bar(id,labels,datasets){draw(id,'bar',{labels,datasets:datasets.map(d=>({label:d.label,data:d.data,backgroundColor:d.bg,borderRadius:14,borderSkipped:false}))},baseOptions())}
function horizontal(id,labels,data,bg,label){const o=baseOptions(); o.indexAxis='y'; o.scales.x={ticks:{callback:v=>money(v)},grid:{color:'rgba(120,120,140,.12)'}}; o.scales.y={grid:{display:false}}; draw(id,'bar',{labels,datasets:[{label,data,backgroundColor:bg,borderRadius:12,borderSkipped:false}]},o)}
function line(id,labels,datasets){draw(id,'line',{labels,datasets:datasets.map(d=>({label:d.label,data:d.data,borderColor:d.color,backgroundColor:d.color+'33',fill:true,tension:.42,pointRadius:3,pointHoverRadius:6}))},baseOptions())}
function doughnut(id,data,colors){draw(id,'doughnut',{labels:['Cobrado','Adeudo'],datasets:[{data,backgroundColor:colors,borderWidth:5,borderColor:getComputedStyle(document.body).getPropertyValue('--card')||'#fff',hoverOffset:10}]},{responsive:true,maintainAspectRatio:false,cutout:'68%',plugins:{legend:{position:'bottom',labels:{usePointStyle:true}},tooltip:{callbacks:{label:c=>`${c.label}: ${money(c.raw)}`}}},animation:{animateRotate:true,duration:1100}})}
function doughnutGeneric(id,labels,data,colors){draw(id,'doughnut',{labels,datasets:[{data,backgroundColor:colors,borderWidth:5,borderColor:getComputedStyle(document.body).getPropertyValue('--card')||'#fff',hoverOffset:8}]},{responsive:true,maintainAspectRatio:false,cutout:'62%',plugins:{legend:{position:'bottom',labels:{usePointStyle:true}},tooltip:{callbacks:{label:c=>`${c.label}: ${c.raw} registros`}}},animation:{animateRotate:true,duration:1100}})}
function draw(id,type,data,options){ if(charts[id]) charts[id].destroy(); charts[id]=new Chart($(id),{type,data,options}); }
function grad(id,a,b){ const ctx=$(id).getContext('2d'); const g=ctx.createLinearGradient(0,0,420,0); g.addColorStop(0,a); g.addColorStop(1,b); return g; }
function renderTable(){ const rows=filteredRows.slice(0,500); $('reportCount').textContent=`${filteredRows.length} registros`; $('reportBody').innerHTML=rows.map(r=>`<tr><td><span class="tag ${r._tipo==='COBRADO'?'cobrado':'adeudo'}">${r._tipo}</span></td><td><span class="status-badge">${escapeHtml(r._estatus)}</span></td><td>${r._empresa}</td><td>${r._fechaTexto}</td><td>${escapeHtml(r._folio)}</td><td>${escapeHtml(r._conductor)}</td><td>${escapeHtml(r._bus)}</td><td>${escapeHtml(r._cajero)}</td><td><b>${money(r._monto)}</b></td></tr>`).join(''); }
function exportCSV(){ const headers=['Tipo','Estatus','Empresa','Fecha','Folio/Viaje','Conductor','Autobus','Cajero','Monto']; const lines=[headers.join(',')].concat(filteredRows.map(r=>[r._tipo,r._estatus,r._empresa,r._fechaTexto,r._folio,r._conductor,r._bus,r._cajero,r._monto].map(v=>`"${String(v).replace(/"/g,'""')}"`).join(','))); download(new Blob([lines.join('\n')],{type:'text/csv;charset=utf-8'}),'reporte_ava.csv'); }
async function exportPDF(){ const el=$('dashboard'); const canvas=await html2canvas(el,{scale:1.4,useCORS:true,backgroundColor:getComputedStyle(document.body).backgroundColor}); const img=canvas.toDataURL('image/jpeg',.92); const {jsPDF}=window.jspdf; const pdf=new jsPDF('p','mm','a4'); const w=210, h=canvas.height*w/canvas.width; let y=0; pdf.setFontSize(16); pdf.text('Centro de Control AVA - Reporte Ejecutivo',12,12); pdf.addImage(img,'JPEG',0,18,w,h); pdf.save('reporte_ava_ejecutivo.pdf'); }
function download(blob,name){ const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; a.click(); URL.revokeObjectURL(a.href); }
function animateText(id,text){ $(id).textContent=text; }
function escapeHtml(s){ return String(s??'').replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }
$('applyFilters').onclick=applyFilters; $('refreshBtn').onclick=loadData; $('csvBtn').onclick=exportCSV; $('pdfBtn').onclick=exportPDF; $('themeBtn').onclick=()=>{document.body.classList.toggle('dark'); setTimeout(renderAll,120)}; $('searchFilter').addEventListener('input',()=>applyFilters()); $('mobileMenu').onclick=()=>$('sidebar').classList.toggle('open'); document.querySelectorAll('.sidebar a').forEach(a=>a.onclick=()=>{$('sidebar').classList.remove('open');document.querySelectorAll('.sidebar a').forEach(x=>x.classList.remove('active'));a.classList.add('active')});
loadData();
