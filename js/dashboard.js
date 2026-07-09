let ALL_ROWS = [];
let FILTERED = [];
if (typeof window.sum !== 'function') window.sum = (arr, fn) => (arr||[]).reduce((a,x)=>a+(Number(fn(x))||0),0);
if (typeof window.groupSum !== 'function') window.groupSum = function(rows,keyFn,valFn){ const m=new Map(); (rows||[]).forEach(r=>{const k=keyFn(r)||'SIN DATO'; m.set(k,(m.get(k)||0)+(Number(valFn(r))||0));}); return [...m.entries()].map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value); };
const $ = id => document.getElementById(id);
function setStatus(text, mode='') { const el=$('loadingText'); el.textContent=text; el.className='status-pill '+mode; $('apiStatus').textContent=text; }
function fmtMoney(v){return Number(v||0).toLocaleString('es-MX',{style:'currency',currency:'MXN'});}
function uniq(arr){return [...new Set(arr.filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));}
function optionList(id, values, allText){ const sel=$(id); const current=sel.value; sel.innerHTML=`<option value="TODOS">${allText}</option>`+values.map(v=>`<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join(''); if(values.includes(current)) sel.value=current; }
function escapeHtml(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
async function init(){
  bindEvents(); setStatus('Cargando información desde Google Sheet...');
  try{
    const {data, errores} = await cargarTodo(); ALL_ROWS = data.filter(r=>r.monto>0);
    if(!ALL_ROWS.length) setStatus('Conexión correcta, pero no se detectaron montos. Revisa nombres de columnas.', 'err');
    else setStatus(errores.length ? `Carga parcial: ${errores.join(' · ')}` : 'Información cargada correctamente', errores.length?'err':'ok');
    $('lastUpdate').textContent = new Date().toLocaleString('es-MX');
    cargarFiltros(); aplicarFiltros();
  }catch(e){ console.error(e); setStatus('Error de conexión: '+e.message, 'err'); $('reportBody').innerHTML=`<tr><td colspan="7" class="empty">${escapeHtml(e.message)}</td></tr>`; }
}
function bindEvents(){
  $('refreshBtn').addEventListener('click', init);
  $('applyBtn').addEventListener('click', aplicarFiltros);
  ['empresaFilter','tipoFilter','cajeroFilter','conductorFilter','desdeFilter','hastaFilter'].forEach(id=>$(id).addEventListener('change', aplicarFiltros));
  $('searchBox').addEventListener('input', renderTable);
  $('exportBtn').addEventListener('click', exportCSV);
  $('menuBtn').addEventListener('click', ()=>$('sidebar').classList.toggle('open'));
}
function cargarFiltros(){
  optionList('cajeroFilter', uniq(ALL_ROWS.filter(r=>r.tipo==='COBRADO' && r.cajero && r.cajero!=='SIN CAJERO').map(r=>r.cajero)), 'Todos');
  optionList('conductorFilter', uniq(ALL_ROWS.map(r=>r.conductor)), 'Todos');
}
function aplicarFiltros(){
  const emp=$('empresaFilter').value, tipo=$('tipoFilter').value, caj=$('cajeroFilter').value, con=$('conductorFilter').value, desde=$('desdeFilter').value, hasta=$('hastaFilter').value;
  FILTERED = ALL_ROWS.filter(r=>{
    if(emp!=='TODAS' && r.empresa!==emp) return false;
    if(tipo!=='AMBOS' && r.tipo!==tipo) return false;
    if(caj!=='TODOS' && r.tipo==='COBRADO' && r.cajero!==caj) return false;
    if(con!=='TODOS' && r.conductor!==con) return false;
    if(desde && r.fecha && r.fecha < desde) return false;
    if(hasta && r.fecha && r.fecha > hasta) return false;
    return true;
  });
  renderAll();
}
function renderAll(){ renderKpis(); renderCharts(); renderTable(); }
function renderKpis(){
  const cob=FILTERED.filter(r=>r.tipo==='COBRADO'), ade=FILTERED.filter(r=>r.tipo==='ADEUDO');
  const totalCob=sum(cob,r=>r.monto), totalAde=sum(ade,r=>r.monto), rec= totalCob+totalAde ? totalCob/(totalCob+totalAde)*100 : 0;
  $('kpiCobrado').textContent=fmtMoney(totalCob); $('kpiAdeudo').textContent=fmtMoney(totalAde); $('kpiRecuperacion').textContent=Math.round(rec)+'%';
  $('kpiMovimientos').textContent=`${cob.length} movimientos`; $('kpiPendientes').textContent=`${ade.length} pendientes`; $('kpiConductores').textContent=uniq(ade.map(r=>r.conductor)).length;
}
function renderCharts(){
  const empresas=['TRT','SUR'];
  const cobEmp=empresas.map(e=>sum(FILTERED.filter(r=>r.empresa===e&&r.tipo==='COBRADO'),r=>r.monto));
  const adeEmp=empresas.map(e=>sum(FILTERED.filter(r=>r.empresa===e&&r.tipo==='ADEUDO'),r=>r.monto));
  renderBar('chartEmpresa', empresas, [{label:'Cobrado',data:cobEmp,backgroundColor:COLORS.green},{label:'Adeudo',data:adeEmp,backgroundColor:COLORS.red}]);
  const totalCobradoDonut = sum(FILTERED.filter(r=>r.tipo==='COBRADO'),r=>r.monto);
  const totalAdeudoDonut = sum(FILTERED.filter(r=>r.tipo==='ADEUDO'),r=>r.monto);
  renderDonut('chartDonut', totalCobradoDonut, totalAdeudoDonut);
  if($('donutCobrado')) $('donutCobrado').textContent = fmtMoney(totalCobradoDonut);
  if($('donutAdeudo')) $('donutAdeudo').textContent = fmtMoney(totalAdeudoDonut);
  if($('donutTotal')) $('donutTotal').textContent = fmtMoney(totalCobradoDonut + totalAdeudoDonut);
  const fechas=uniq(FILTERED.map(r=>r.fecha).filter(Boolean)).slice(-40);
  renderLine('chartTendencia', fechas, fechas.map(f=>sum(FILTERED.filter(r=>r.fecha===f&&r.tipo==='COBRADO'),r=>r.monto)), fechas.map(f=>sum(FILTERED.filter(r=>r.fecha===f&&r.tipo==='ADEUDO'),r=>r.monto)));
  const caj=groupSum(FILTERED.filter(r=>r.tipo==='COBRADO'), r=>r.cajero, r=>r.monto).slice(0,10).reverse();
  renderBar('chartCajeros', caj.map(x=>x.name), [{label:'Cobrado',data:caj.map(x=>x.value),backgroundColor:COLORS.purple}], true);
  const cond=groupSum(FILTERED.filter(r=>r.tipo==='ADEUDO'), r=>r.conductor, r=>r.monto).slice(0,10).reverse();
  renderBar('chartConductores', cond.map(x=>x.name), [{label:'Adeudo',data:cond.map(x=>x.value),backgroundColor:COLORS.orange}], true);
}
function renderTable(){
  const q=($('searchBox').value||'').toLowerCase();
  const rows=FILTERED.filter(r=>`${r.tipo} ${r.empresa} ${r.fecha} ${r.conductor} ${r.cajero} ${r.viaje}`.toLowerCase().includes(q)).slice(0,500);
  $('reportBody').innerHTML = rows.length ? rows.map(r=>`<tr><td class="${r.tipo==='COBRADO'?'badge-cobrado':'badge-adeudo'}">${r.tipo}</td><td>${r.empresa}</td><td>${r.fecha||''}</td><td>${escapeHtml(r.conductor)}</td><td>${escapeHtml(r.cajero)}</td><td>${fmtMoney(r.monto)}</td><td>${escapeHtml(r.viaje)}</td></tr>`).join('') : '<tr><td colspan="7" class="empty">Sin registros con los filtros seleccionados</td></tr>';
}
function exportCSV(){
  const header=['Tipo','Empresa','Fecha','Conductor','Cajero','Monto','Viaje'];
  const lines=[header.join(',')].concat(FILTERED.map(r=>[r.tipo,r.empresa,r.fecha,r.conductor,r.cajero,r.monto,r.viaje].map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')));
  const blob=new Blob([lines.join('\n')],{type:'text/csv;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='reporte_ava.csv'; a.click(); URL.revokeObjectURL(a.href);
}
document.addEventListener('DOMContentLoaded', init);
