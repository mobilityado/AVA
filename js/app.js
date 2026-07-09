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
const amountFrom = (r,tipo) => num(pick(r, tipo==='ADEUDO' ? ['Por Cobrar','Monto Adeudo','Adeudo','Saldo','Importe','Monto Recuperado'] : ['Monto Recuperado','Monto','Importe','Por Cobrar']));
function num(v){ if(typeof v==='number') return v; return Number(String(v||'').replace(/[$,\s]/g,'').replace(/\((.*)\)/,'-$1'))||0; }
function dateFrom(r){ return pick(r,['Fecha del Viaje','Fecha Viaje','Fecha','Fecha Cobro','FECHA']); }
function dateObj(v){ if(!v) return null; const d=new Date(v); return isNaN(d)?null:d; }
function ymd(d){ if(!d) return ''; return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function monthKey(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }
function yearKey(d){ return String(d.getFullYear()); }
function conductorFrom(r){ return pick(r,['Conductor','Nombre Conductor','Operador','Nombre Operador']); }
function cajeroFrom(r){ return pick(r,['Nombre Cajero','Cajero','Cajero Cobro','Usuario Cobro','Nombre del Cajero']); }
function busFrom(r){ return pick(r,['Autobús','Autobus','Unidad','No Economico','No. Económico','Eco']); }
function folioFrom(r){ return pick(r,['Viaje','Folio','Numero Viaje','No Viaje','Num Viaje']); }
async function fetchSheet(meta){
  const res = await fetch(`${API_URL}?accion=datos&hoja=${encodeURIComponent(meta.hoja)}&t=${Date.now()}`);
  const json = await res.json();
  if(json.error) throw new Error(`${meta.hoja}: ${json.mensaje}`);
  const rows = Array.isArray(json.datos) ? json.datos : [];
  return rows.map(r=>{
    const d=dateObj(dateFrom(r));
    return {...r, _hoja:meta.hoja, _empresa:meta.empresa, _tipo:meta.tipo, _monto:amountFrom(r,meta.tipo), _fecha:d, _fechaTexto:d?ymd(d):String(dateFrom(r)||''), _conductor:String(conductorFrom(r)||'SIN DATO').trim(), _cajero:String(cajeroFrom(r)||'SIN DATO').trim(), _bus:String(busFrom(r)||'').trim(), _folio:String(folioFrom(r)||'').trim()};
  }).filter(r=>r._monto>0 || r._conductor !== 'SIN DATO');
}
async function loadData(){
  setStatus('Cargando información...', 'loading');
  try{
    const chunks = await Promise.all(SHEETS.map(fetchSheet));
    rawRows = chunks.flat();
    fillCajeros(); applyFilters();
    $('lastUpdate').textContent = new Date().toLocaleString('es-MX');
    $('sideStatus').textContent = 'Información cargada correctamente';
    setStatus(`Información cargada · ${rawRows.length} registros`, 'ok');
  }catch(e){ console.error(e); setStatus('Error de conexión: '+e.message, 'error'); $('sideStatus').textContent='Error al cargar'; }
  setTimeout(()=>$('splash')?.classList.add('hide'),700);
}
function setStatus(text, cls){ const el=$('connectionStatus'); el.textContent=text; el.className='pill '+cls; }
function fillCajeros(){ const cajeros=[...new Set(rawRows.filter(r=>r._tipo==='COBRADO').map(r=>r._cajero).filter(x=>x&&x!=='SIN DATO'))].sort(); $('cajeroFilter').innerHTML='<option value="TODOS">Todos</option>'+cajeros.map(c=>`<option>${escapeHtml(c)}</option>`).join(''); }
function applyFilters(){
  const emp=$('empresaFilter').value, tipo=$('tipoFilter').value, caj=$('cajeroFilter').value, q=norm($('searchFilter').value);
  const desde=$('desdeFilter').value?new Date($('desdeFilter').value+'T00:00:00'):null; const hasta=$('hastaFilter').value?new Date($('hastaFilter').value+'T23:59:59'):null;
  filteredRows=rawRows.filter(r=>{
    if(emp!=='TODAS' && r._empresa!==emp) return false; if(tipo!=='AMBOS' && r._tipo!==tipo) return false; if(caj!=='TODOS' && r._cajero!==caj) return false;
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
function byPeriod(period){ const rows=filteredRows.filter(r=>r._fecha); const keys=[...new Set(rows.map(r=>period==='year'?yearKey(r._fecha):monthKey(r._fecha)))].sort(); return keys.map(k=>({name:k,cobrado:rows.filter(r=>(period==='year'?yearKey(r._fecha):monthKey(r._fecha))===k&&r._tipo==='COBRADO').reduce((s,r)=>s+r._monto,0),adeudo:rows.filter(r=>(period==='year'?yearKey(r._fecha):monthKey(r._fecha))===k&&r._tipo==='ADEUDO').reduce((s,r)=>s+r._monto,0)})); }
function renderCharts(cob,ade,pct){
  const css=getComputedStyle(document.documentElement); const green=css.getPropertyValue('--green').trim(), red=css.getPropertyValue('--red').trim(), purple=css.getPropertyValue('--purple').trim(), blue=css.getPropertyValue('--blue').trim(), gold=css.getPropertyValue('--gold').trim();
  const empresa=['TRT','SUR'].map(e=>({name:e,cobrado:filteredRows.filter(r=>r._empresa===e&&r._tipo==='COBRADO').reduce((s,r)=>s+r._monto,0),adeudo:filteredRows.filter(r=>r._empresa===e&&r._tipo==='ADEUDO').reduce((s,r)=>s+r._monto,0)}));
  bar('chartEmpresa', empresa.map(x=>x.name), [{label:'Cobrado',data:empresa.map(x=>x.cobrado),bg:grad('chartEmpresa',green,'#6ee7b7')},{label:'Adeudo',data:empresa.map(x=>x.adeudo),bg:grad('chartEmpresa',red,'#fb7185')}]);
  doughnut('chartDonut',[cob,ade],[green,red]);
  const mensual=byPeriod('month').slice(-12); line('chartMensual', mensual.map(x=>x.name), [{label:'Cobrado',data:mensual.map(x=>x.cobrado),color:green},{label:'Adeudo',data:mensual.map(x=>x.adeudo),color:red}]);
  const anual=byPeriod('year'); bar('chartAnual', anual.map(x=>x.name), [{label:'Cobrado',data:anual.map(x=>x.cobrado),bg:grad('chartAnual',blue,'#38bdf8')},{label:'Adeudo',data:anual.map(x=>x.adeudo),bg:grad('chartAnual',purple,'#c084fc')}]);
  const topC=grouped(filteredRows.filter(r=>r._tipo==='COBRADO'),r=>r._cajero,r=>r._monto).sort((a,b)=>b.value-a.value).slice(0,10).reverse(); horizontal('chartCajeros', topC.map(x=>x.name), topC.map(x=>x.value), grad('chartCajeros',blue,green),'Recuperado');
  const topD=grouped(filteredRows.filter(r=>r._tipo==='ADEUDO'),r=>r._conductor,r=>r._monto).sort((a,b)=>b.value-a.value).slice(0,10).reverse(); horizontal('chartConductores', topD.map(x=>x.name), topD.map(x=>x.value), grad('chartConductores',red,gold),'Adeudo');
}
function baseOptions(){return {responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{usePointStyle:true}},tooltip:{callbacks:{label:c=>`${c.dataset.label||''}: ${money(c.raw)}`}}},scales:{y:{ticks:{callback:v=>money(v)},grid:{color:'rgba(120,120,140,.12)'}},x:{grid:{display:false}}},animation:{duration:900,easing:'easeOutQuart'}}}
function bar(id,labels,datasets){draw(id,'bar',{labels,datasets:datasets.map(d=>({label:d.label,data:d.data,backgroundColor:d.bg,borderRadius:14,borderSkipped:false}))},baseOptions())}
function horizontal(id,labels,data,bg,label){const o=baseOptions(); o.indexAxis='y'; o.scales.x={ticks:{callback:v=>money(v)},grid:{color:'rgba(120,120,140,.12)'}}; o.scales.y={grid:{display:false}}; draw(id,'bar',{labels,datasets:[{label,data,backgroundColor:bg,borderRadius:12,borderSkipped:false}]},o)}
function line(id,labels,datasets){draw(id,'line',{labels,datasets:datasets.map(d=>({label:d.label,data:d.data,borderColor:d.color,backgroundColor:d.color+'33',fill:true,tension:.42,pointRadius:3,pointHoverRadius:6}))},baseOptions())}
function doughnut(id,data,colors){draw(id,'doughnut',{labels:['Cobrado','Adeudo'],datasets:[{data,backgroundColor:colors,borderWidth:5,borderColor:getComputedStyle(document.body).getPropertyValue('--card')||'#fff',hoverOffset:10}]},{responsive:true,maintainAspectRatio:false,cutout:'68%',plugins:{legend:{position:'bottom',labels:{usePointStyle:true}},tooltip:{callbacks:{label:c=>`${c.label}: ${money(c.raw)}`}}},animation:{animateRotate:true,duration:1100}})}
function draw(id,type,data,options){ if(charts[id]) charts[id].destroy(); charts[id]=new Chart($(id),{type,data,options}); }
function grad(id,a,b){ const ctx=$(id).getContext('2d'); const g=ctx.createLinearGradient(0,0,420,0); g.addColorStop(0,a); g.addColorStop(1,b); return g; }
function renderTable(){ const rows=filteredRows.slice(0,500); $('reportCount').textContent=`${filteredRows.length} registros`; $('reportBody').innerHTML=rows.map(r=>`<tr><td><span class="tag ${r._tipo==='COBRADO'?'cobrado':'adeudo'}">${r._tipo}</span></td><td>${r._empresa}</td><td>${r._fechaTexto}</td><td>${escapeHtml(r._folio)}</td><td>${escapeHtml(r._conductor)}</td><td>${escapeHtml(r._bus)}</td><td>${escapeHtml(r._cajero)}</td><td><b>${money(r._monto)}</b></td></tr>`).join(''); }
function exportCSV(){ const headers=['Tipo','Empresa','Fecha','Folio/Viaje','Conductor','Autobus','Cajero','Monto']; const lines=[headers.join(',')].concat(filteredRows.map(r=>[r._tipo,r._empresa,r._fechaTexto,r._folio,r._conductor,r._bus,r._cajero,r._monto].map(v=>`"${String(v).replace(/"/g,'""')}"`).join(','))); download(new Blob([lines.join('\n')],{type:'text/csv;charset=utf-8'}),'reporte_ava.csv'); }
async function exportPDF(){ const el=$('dashboard'); const canvas=await html2canvas(el,{scale:1.4,useCORS:true,backgroundColor:getComputedStyle(document.body).backgroundColor}); const img=canvas.toDataURL('image/jpeg',.92); const {jsPDF}=window.jspdf; const pdf=new jsPDF('p','mm','a4'); const w=210, h=canvas.height*w/canvas.width; let y=0; pdf.setFontSize(16); pdf.text('Centro de Control AVA - Reporte Ejecutivo',12,12); pdf.addImage(img,'JPEG',0,18,w,h); pdf.save('reporte_ava_ejecutivo.pdf'); }
function download(blob,name){ const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; a.click(); URL.revokeObjectURL(a.href); }
function animateText(id,text){ $(id).textContent=text; }
function escapeHtml(s){ return String(s??'').replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }
$('applyFilters').onclick=applyFilters; $('refreshBtn').onclick=loadData; $('csvBtn').onclick=exportCSV; $('pdfBtn').onclick=exportPDF; $('themeBtn').onclick=()=>{document.body.classList.toggle('dark'); setTimeout(renderAll,120)}; $('searchFilter').addEventListener('input',()=>applyFilters()); $('mobileMenu').onclick=()=>$('sidebar').classList.toggle('open'); document.querySelectorAll('.sidebar a').forEach(a=>a.onclick=()=>{$('sidebar').classList.remove('open');document.querySelectorAll('.sidebar a').forEach(x=>x.classList.remove('active'));a.classList.add('active')});
loadData();
