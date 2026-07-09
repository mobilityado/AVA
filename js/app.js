const API_URL = 'https://script.google.com/macros/s/AKfycbxpX9FNMZZDL72L76vS4keCiWC3xPb79_cMkpcBk0_AqktKHizk7j5A6r53brRN9y9d/exec';
const SHEETS = [
  { hoja:'TRT', empresa:'TRT', tipo:'COBRADO' },
  { hoja:'SUR', empresa:'SUR', tipo:'COBRADO' },
  { hoja:'AVATRT', empresa:'TRT', tipo:'ADEUDO' },
  { hoja:'AVASUR', empresa:'SUR', tipo:'ADEUDO' }
];
let rawRows = [], filteredRows = [], charts = {}, chartLinks = {};
const $ = id => document.getElementById(id);
const money = n => Number(n||0).toLocaleString('es-MX',{style:'currency',currency:'MXN'});
const norm = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const pick = (obj, names) => { const keys=Object.keys(obj||{}); for(const n of names){ const k=keys.find(x=>norm(x)===norm(n)); if(k && obj[k]!=='' && obj[k]!=null) return obj[k]; } for(const n of names){ const k=keys.find(x=>norm(x).includes(norm(n)) || norm(n).includes(norm(x))); if(k && obj[k]!=='' && obj[k]!=null) return obj[k]; } return ''; };
const amountFrom = (r,tipo) => num(pick(r, tipo==='ADEUDO' ? ['Por Cobrar','Total Por Cobrar','Monto Adeudo','Adeudo','Saldo','Importe','Costo','Monto Recuperado'] : ['Monto Recuperado','Monto','Importe','Por Cobrar']));
function num(v){ if(typeof v==='number') return v; return Number(String(v||'').replace(/[$,\s]/g,'').replace(/\((.*)\)/,'-$1'))||0; }
function dateFrom(r){ return pick(r,['Fecha del Viaje','Fecha Viaje','Fecha','Fecha Cobro','FECHA','Fecha Corrida','Fecha Recepción Reporte','Fecha Recepcion Reporte','Fecha Sanción','Fecha Sancion']); }
function isValidPeriodDate(d){ if(!d || isNaN(d)) return false; const y=d.getFullYear(); return y>=2020 && y<=2035; }
function dateObj(v){
  if(!v && v!==0) return null;
  if(v instanceof Date && isValidPeriodDate(v)) return v;
  if(typeof v==='number'){ if(v>20000){ const d=new Date(Math.round((v-25569)*86400*1000)); if(isValidPeriodDate(d)) return d; } return null; }
  let raw=String(v).trim(); if(!raw) return null;
  raw=raw.replace(/\u00a0/g,' ').replace(/\s+/g,' ').replace(/a\s*\.\s*m\s*\.?/ig,'AM').replace(/p\s*\.\s*m\s*\.?/ig,'PM').replace(/a\s*m\s*\.?/ig,'AM').replace(/p\s*m\s*\.?/ig,'PM').trim();
  let m=raw.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?/i);
  if(m){ let yy=+m[1],mm=+m[2]-1,dd=+m[3],hh=+(m[4]||0),mi=+(m[5]||0),ss=+(m[6]||0); const ap=(m[7]||'').toUpperCase(); if(ap==='PM'&&hh<12)hh+=12; if(ap==='AM'&&hh===12)hh=0; const d=new Date(yy,mm,dd,hh,mi,ss); if(isValidPeriodDate(d)) return d; }
  m=raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?/i);
  if(m){ let dd=+m[1],mm=+m[2]-1,yy=+m[3],hh=+(m[4]||0),mi=+(m[5]||0),ss=+(m[6]||0); const ap=(m[7]||'').toUpperCase(); if(ap==='PM'&&hh<12)hh+=12; if(ap==='AM'&&hh===12)hh=0; const d=new Date(yy,mm,dd,hh,mi,ss); if(isValidPeriodDate(d)) return d; }
  const d=new Date(raw); return isValidPeriodDate(d)?d:null;
}
function ymd(d){ return d?`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`:''; }
function monthKey(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }
function yearKey(d){ return String(d.getFullYear()); }
function conductorFrom(r){ return pick(r,['Conductor','Nombre Conductor','Operador','Nombre Operador']); }
function cajeroFrom(r){ return pick(r,['Nombre Cajero','Cajero','Cajero Cobro','Usuario Cobro','Nombre del Cajero']); }
function busFrom(r){ return pick(r,['Autobús','Autobus','Unidad','No Economico','No. Económico','Eco']); }
function folioFrom(r){ return pick(r,['Viaje','Id Viaje','Folio','Numero Viaje','No Viaje','Num Viaje']); }
function origenFrom(r){ return pick(r,['Origen','Terminal Origen','Base Origen','Salida','Origen Corrida']); }
function destinoFrom(r){ return pick(r,['Destino','Terminal Destino','Base Destino','Llegada','Destino Corrida']); }
function rutaFrom(r){ const ruta=pick(r,['Origen Destino','Origen-Destino','Ruta','OD','Origen/Destino','Tramo']); if(ruta) return String(ruta).trim(); const o=String(origenFrom(r)||'').trim(), d=String(destinoFrom(r)||'').trim(); return o&&d?`${o} → ${d}`:(o||d||'SIN DATO'); }
function estatusFrom(r,tipo){ const e=pick(r,['Estatus','Status','Estado','Situación','Situacion']); if(e) return String(e).trim().toUpperCase(); return tipo==='COBRADO'?'COBRADO':'SIN ESTATUS'; }
async function fetchSheet(meta){
  const res=await fetch(`${API_URL}?accion=datos&hoja=${encodeURIComponent(meta.hoja)}&t=${Date.now()}`);
  const json=await res.json(); if(json.error) throw new Error(`${meta.hoja}: ${json.mensaje}`);
  const rows=Array.isArray(json.datos)?json.datos:[];
  return rows.map(r=>{ const fechaRaw=dateFrom(r), d=dateObj(fechaRaw); return {...r,_hoja:meta.hoja,_empresa:meta.empresa,_tipo:meta.tipo,_monto:amountFrom(r,meta.tipo),_fecha:d,_fechaRaw:String(fechaRaw||''),_fechaTexto:d?ymd(d):String(fechaRaw||''),_conductor:String(conductorFrom(r)||'SIN DATO').trim(),_cajero:String(cajeroFrom(r)||'SIN DATO').trim(),_bus:String(busFrom(r)||'').trim(),_folio:String(folioFrom(r)||'').trim(),_ruta:String(rutaFrom(r)||'SIN DATO').trim(),_estatus:estatusFrom(r,meta.tipo)}; }).filter(r=>r._monto>0 || r._conductor!=='SIN DATO');
}
async function loadData(){
  setStatus('Cargando información...', 'loading');
  try{ const chunks=await Promise.all(SHEETS.map(fetchSheet)); rawRows=chunks.flat(); fillCajeros(); fillEstatus(); applyFilters(); $('lastUpdate').textContent=new Date().toLocaleString('es-MX'); $('sideStatus').textContent='Información cargada correctamente'; setStatus(`Información cargada · ${rawRows.length} registros`, 'ok'); }
  catch(e){ console.error(e); setStatus('Error de conexión: '+e.message,'error'); $('sideStatus').textContent='Error al cargar'; }
  setTimeout(()=>$('splash')?.classList.add('hide'),700);
}
function setStatus(text,cls){ const el=$('connectionStatus'); el.textContent=text; el.className='pill '+cls; }
function fillCajeros(){ const cajeros=[...new Set(rawRows.filter(r=>r._tipo==='COBRADO').map(r=>r._cajero).filter(x=>x&&x!=='SIN DATO'))].sort(); $('cajeroFilter').innerHTML='<option value="TODOS">Todos</option>'+cajeros.map(c=>`<option>${escapeHtml(c)}</option>`).join(''); }
function fillEstatus(){ const estatus=[...new Set(rawRows.map(r=>r._estatus).filter(Boolean))].sort(); $('estatusFilter').innerHTML='<option value="TODOS">Todos</option>'+estatus.map(e=>`<option>${escapeHtml(e)}</option>`).join(''); }
function applyFilters(){
  const emp=$('empresaFilter').value, tipo=$('tipoFilter').value, caj=$('cajeroFilter').value, est=$('estatusFilter').value, q=norm($('searchFilter').value);
  const desde=$('desdeFilter').value?new Date($('desdeFilter').value+'T00:00:00'):null, hasta=$('hastaFilter').value?new Date($('hastaFilter').value+'T23:59:59'):null;
  filteredRows=rawRows.filter(r=>{ if(emp!=='TODAS'&&r._empresa!==emp) return false; if(tipo!=='AMBOS'&&r._tipo!==tipo) return false; if(caj!=='TODOS'&&r._cajero!==caj) return false; if(est!=='TODOS'&&r._estatus!==est) return false; if(desde&&(!r._fecha||r._fecha<desde)) return false; if(hasta&&(!r._fecha||r._fecha>hasta)) return false; if(q&&!norm(`${r._conductor} ${r._bus} ${r._folio} ${r._cajero} ${r._ruta} ${r._estatus}`).includes(q)) return false; return true; });
  renderAll();
}
const sumByType=t=>filteredRows.filter(r=>r._tipo===t).reduce((s,r)=>s+r._monto,0);
function renderAll(){
  const cob=sumByType('COBRADO'), ade=sumByType('ADEUDO'), total=cob+ade, pct=total?cob/total*100:0, forecast=forecastMonthEnd();
  animateText('kpiCobrado',money(cob)); animateText('kpiAdeudo',money(ade)); animateText('kpiRecuperacion',pct.toFixed(1)+'%'); animateText('kpiConductores',new Set(filteredRows.filter(r=>r._tipo==='ADEUDO'&&r._monto>0).map(r=>r._conductor)).size); animateText('kpiForecast',money(forecast.projected)); $('kpiForecastNote').textContent=forecast.note;
  $('kpiMovimientos').textContent=`${filteredRows.filter(r=>r._tipo==='COBRADO').length} movimientos`; $('kpiPendientes').textContent=`${filteredRows.filter(r=>r._tipo==='ADEUDO').length} pendientes`;
  $('donutPercent').textContent=pct.toFixed(1)+'%'; $('gaugePercent').textContent=pct.toFixed(1)+'%'; $('donutCobrado').textContent=money(cob); $('donutAdeudo').textContent=money(ade);
  renderCharts(cob,ade,pct,forecast); renderTable(); renderHeatmaps(); renderAlerts(); renderInsights(cob,ade,pct,forecast); renderGoal(cob);
}
function grouped(rows,keyFn,valFn){ const m=new Map(); rows.forEach(r=>{ const k=keyFn(r)||'SIN DATO'; m.set(k,(m.get(k)||0)+valFn(r)); }); return [...m].map(([name,value])=>({name,value})); }
function periodKeyForRow(r,period){ const d=r._fecha||dateObj(r._fechaRaw); if(!d) return ''; return period==='year'?yearKey(d):monthKey(d); }
function byPeriod(period){ const m=new Map(); filteredRows.forEach(r=>{ const k=periodKeyForRow(r,period); if(!k) return; if(!m.has(k)) m.set(k,{name:k,cobrado:0,adeudo:0}); const item=m.get(k); if(r._tipo==='COBRADO') item.cobrado+=r._monto; if(r._tipo==='ADEUDO') item.adeudo+=r._monto; }); return [...m.values()].sort((a,b)=>a.name.localeCompare(b.name)); }
function forecastMonthEnd(){
  const now=new Date(); const current=filteredRows.filter(r=>r._tipo==='COBRADO' && r._fecha && r._fecha.getFullYear()===now.getFullYear() && r._fecha.getMonth()===now.getMonth());
  const monthTotal=current.reduce((s,r)=>s+r._monto,0); const daysWith=[...new Set(current.map(r=>ymd(r._fecha)))].length; const elapsed=Math.max(daysWith, Math.min(now.getDate(), new Date(now.getFullYear(),now.getMonth()+1,0).getDate())); const daysInMonth=new Date(now.getFullYear(),now.getMonth()+1,0).getDate();
  const projected=elapsed?monthTotal/elapsed*daysInMonth:0; return {current:monthTotal, projected, note: elapsed?`Proyección con ${elapsed} días de datos`:'Sin datos del mes actual'};
}
function renderCharts(cob,ade,pct,forecast){
  const css=getComputedStyle(document.documentElement); const green=css.getPropertyValue('--green').trim(), red=css.getPropertyValue('--red').trim(), purple=css.getPropertyValue('--purple').trim(), blue=css.getPropertyValue('--blue').trim(), gold=css.getPropertyValue('--gold').trim();
  const empresa=['TRT','SUR'].map(e=>({name:e,cobrado:filteredRows.filter(r=>r._empresa===e&&r._tipo==='COBRADO').reduce((s,r)=>s+r._monto,0),adeudo:filteredRows.filter(r=>r._empresa===e&&r._tipo==='ADEUDO').reduce((s,r)=>s+r._monto,0)}));
  bar('chartEmpresa',empresa.map(x=>x.name),[{label:'Cobrado',data:empresa.map(x=>x.cobrado),bg:grad('chartEmpresa',green,'#6ee7b7')},{label:'Adeudo',data:empresa.map(x=>x.adeudo),bg:grad('chartEmpresa',red,'#fb7185')}]);
  doughnut('chartDonut',[cob,ade],[green,red]); gauge('chartGauge',pct,[green,red,purple]);
  const mensual=byPeriod('month').slice(-12); line('chartMensual',mensual.map(x=>x.name),[{label:'Cobrado',data:mensual.map(x=>x.cobrado),color:green},{label:'Adeudo',data:mensual.map(x=>x.adeudo),color:red}]);
  const anual=byPeriod('year'); bar('chartAnual',anual.map(x=>x.name),[{label:'Cobrado',data:anual.map(x=>x.cobrado),bg:grad('chartAnual',blue,'#38bdf8')},{label:'Adeudo',data:anual.map(x=>x.adeudo),bg:grad('chartAnual',purple,'#c084fc')}]);
  const topC=grouped(filteredRows.filter(r=>r._tipo==='COBRADO'),r=>r._cajero,r=>r._monto).sort((a,b)=>b.value-a.value).slice(0,10); horizontal('chartCajeros',topC.slice().reverse().map(x=>x.name),topC.slice().reverse().map(x=>x.value),grad('chartCajeros',blue,green),'Recuperado','cajero'); renderMedals('medalCajeros',topC,'cajero');
  const topD=grouped(filteredRows.filter(r=>r._tipo==='ADEUDO'),r=>r._conductor,r=>r._monto).sort((a,b)=>b.value-a.value).slice(0,10); horizontal('chartConductores',topD.slice().reverse().map(x=>x.name),topD.slice().reverse().map(x=>x.value),grad('chartConductores',red,gold),'Adeudo','conductor'); renderMedals('medalConductores',topD,'conductor');
  const statusMonto=grouped(filteredRows,r=>r._estatus||'SIN ESTATUS',r=>r._monto).sort((a,b)=>b.value-a.value); const statusConteo=grouped(filteredRows,r=>r._estatus||'SIN ESTATUS',r=>1).sort((a,b)=>b.value-a.value);
  horizontal('chartEstatusMonto',statusMonto.map(x=>x.name),statusMonto.map(x=>x.value),grad('chartEstatusMonto',purple,'#ec4899'),'Monto','estatus'); doughnutGeneric('chartEstatusConteo',statusConteo.map(x=>x.name),statusConteo.map(x=>x.value),[purple,red,green,blue,gold,'#ec4899','#14b8a6']);
  const rutas=grouped(filteredRows.filter(r=>r._ruta&&r._ruta!=='SIN DATO'),r=>r._ruta,r=>1).sort((a,b)=>b.value-a.value).slice(0,10); horizontalCount('chartRutas',rutas.slice().reverse().map(x=>x.name),rutas.slice().reverse().map(x=>x.value),grad('chartRutas',purple,'#f472b6'),'Viajes / registros','ruta'); renderMedals('topRutas',rutas,'ruta',true);
  bar('chartForecast',['Actual','Pronóstico cierre'],[{label:'Recuperación',data:[forecast.current,forecast.projected],bg:grad('chartForecast',green,blue)}]); $('forecastText').textContent=`Al ritmo actual, el cierre estimado del mes sería ${money(forecast.projected)}.`; $('gaugeText').textContent=pct>=80?'Excelente recuperación':pct>=50?'Recuperación media, monitorear adeudos':'Recuperación baja, revisar adeudos prioritarios';
}
function renderMedals(id,items,kind,countMode=false){ const medals=['🥇','🥈','🥉']; $(id).innerHTML=items.slice(0,5).map((x,i)=>`<button class="medal-item" data-kind="${kind}" data-name="${escapeHtml(x.name)}"><span>${medals[i]||'🏅'}</span><b>${escapeHtml(x.name)}</b><strong>${countMode?x.value:money(x.value)}</strong></button>`).join(''); $(id).querySelectorAll('button').forEach(b=>b.onclick=()=>openDetail(b.dataset.kind,b.dataset.name)); }
function renderHeatmaps(){ renderHeatmap('heatmapCajero','cajero',filteredRows.filter(r=>r._cajero&&r._cajero!=='SIN DATO'),r=>r._cajero); renderHeatmap('heatmapConductor','conductor',filteredRows.filter(r=>r._conductor&&r._conductor!=='SIN DATO'),r=>r._conductor); }
function renderHeatmap(id,kind,rows,keyFn){ const statuses=[...new Set(rows.map(r=>r._estatus||'SIN ESTATUS'))].slice(0,6); const entities=grouped(rows,keyFn,r=>1).sort((a,b)=>b.value-a.value).slice(0,8).map(x=>x.name); let max=1; const data={}; entities.forEach(e=>{ data[e]={}; statuses.forEach(st=>{ const total=rows.filter(r=>keyFn(r)===e&&(r._estatus||'SIN ESTATUS')===st).reduce((s,r)=>s+r._monto,0); data[e][st]=total; max=Math.max(max,total); }); }); $(id).innerHTML=`<div class="heat-row heat-head"><span></span>${statuses.map(s=>`<b>${escapeHtml(s)}</b>`).join('')}</div>`+entities.map(e=>`<div class="heat-row"><strong>${escapeHtml(e)}</strong>${statuses.map(st=>{ const v=data[e][st]||0, level=Math.max(.08,v/max); return `<button title="${escapeHtml(e)} · ${escapeHtml(st)} · ${money(v)}" style="--level:${level}" data-kind="${kind}" data-name="${escapeHtml(e)}">${v?money(v).replace('.00',''):''}</button>`; }).join('')}</div>`).join(''); $(id).querySelectorAll('button').forEach(b=>b.onclick=()=>openDetail(b.dataset.kind,b.dataset.name)); }
function renderAlerts(){ const limit=Number($('debtThreshold')?.value||5000); const debts=grouped(filteredRows.filter(r=>r._tipo==='ADEUDO'),r=>r._conductor,r=>r._monto).filter(x=>x.value>=limit).sort((a,b)=>b.value-a.value).slice(0,12); $('alertsList').innerHTML=debts.length?debts.map(x=>`<button class="alert-item" data-kind="conductor" data-name="${escapeHtml(x.name)}"><span>🔔</span><b>${escapeHtml(x.name)}</b><strong>${money(x.value)}</strong></button>`).join(''):'<div class="empty-state">Sin alertas con el límite actual.</div>'; $('alertsList').querySelectorAll('button').forEach(b=>b.onclick=()=>openDetail(b.dataset.kind,b.dataset.name)); }

function renderInsights(cob,ade,pct,forecast){
  const topCajero=grouped(filteredRows.filter(r=>r._tipo==='COBRADO'),r=>r._cajero,r=>r._monto).sort((a,b)=>b.value-a.value)[0];
  const topDeudor=grouped(filteredRows.filter(r=>r._tipo==='ADEUDO'),r=>r._conductor,r=>r._monto).sort((a,b)=>b.value-a.value)[0];
  const topRuta=grouped(filteredRows.filter(r=>r._ruta&&r._ruta!=='SIN DATO'),r=>r._ruta,r=>1).sort((a,b)=>b.value-a.value)[0];
  const statusTop=grouped(filteredRows,r=>r._estatus||'SIN ESTATUS',r=>1).sort((a,b)=>b.value-a.value)[0];
  const total=cob+ade;
  const insights=[];
  insights.push({icon:'🎯',title:'Recuperación actual',text:`La recuperación está en ${pct.toFixed(1)}% sobre un universo de ${money(total)}.`});
  if(topCajero) insights.push({icon:'💰',title:'Cajero líder',text:`${topCajero.name} concentra ${money(topCajero.value)} recuperado en el periodo filtrado.`});
  if(topDeudor) insights.push({icon:'🔔',title:'Adeudo prioritario',text:`${topDeudor.name} aparece como principal saldo pendiente con ${money(topDeudor.value)}.`});
  if(topRuta) insights.push({icon:'🗺️',title:'Ruta más frecuente',text:`${topRuta.name} es el origen-destino más concurrido con ${topRuta.value} registros.`});
  if(statusTop) insights.push({icon:'◈',title:'Estatus dominante',text:`El estatus con más movimiento es ${statusTop.name}, con ${statusTop.value} registros.`});
  $('insightsList').innerHTML=insights.map(x=>`<div class="insight-line"><span>${x.icon}</span><div><b>${escapeHtml(x.title)}</b><p>${escapeHtml(x.text)}</p></div></div>`).join('');

  const actions=[];
  if(pct<50) actions.push({icon:'🔴',title:'Prioridad alta',text:'Revisar conductores con mayor adeudo y rutas con mayor concentración de pendientes.'});
  else if(pct<80) actions.push({icon:'🟡',title:'Seguimiento',text:'Mantener monitoreo diario de cajeros y reforzar recuperación en adeudos recurrentes.'});
  else actions.push({icon:'🟢',title:'Buen desempeño',text:'La recuperación es saludable; mantener tendencia y documentar mejores prácticas.'});
  if(forecast.projected) actions.push({icon:'📈',title:'Proyección mensual',text:`Al cierre del mes se estima una recuperación de ${money(forecast.projected)}.`});
  if(topDeudor) actions.push({icon:'📑',title:'Acción sugerida',text:`Abrir el detalle de ${topDeudor.name} para revisar historial, folios y adeudos.`});
  $('actionsList').innerHTML=actions.map(x=>`<div class="insight-line"><span>${x.icon}</span><div><b>${escapeHtml(x.title)}</b><p>${escapeHtml(x.text)}</p></div></div>`).join('');
}
function renderGoal(cob){
  const goal=Number($('monthlyGoal')?.value||0); const pct=goal?Math.min(999,cob/goal*100):0;
  if($('goalPercent')) $('goalPercent').textContent=pct.toFixed(1)+'%';
  if($('goalBar')) $('goalBar').style.width=Math.min(100,pct)+'%';
  if($('goalText')) $('goalText').textContent=goal?`Se han recuperado ${money(cob)} de una meta de ${money(goal)}.`:'Sin meta configurada.';
}
let refreshTimer=null;
function saveConfig(){
  const cfg={monthlyGoal:$('monthlyGoal')?.value||'50000', threshold:$('configDebtThreshold')?.value||'5000', theme:$('themeSelect')?.value||'light', refresh:$('autoRefresh')?.value||'0'};
  localStorage.setItem('avaConfig',JSON.stringify(cfg));
  if($('debtThreshold')) $('debtThreshold').value=cfg.threshold;
  document.body.classList.toggle('dark',cfg.theme==='dark');
  setAutoRefresh(Number(cfg.refresh));
  renderAll();
}
function loadConfig(){
  let cfg={}; try{cfg=JSON.parse(localStorage.getItem('avaConfig')||'{}')}catch(e){}
  if(cfg.monthlyGoal&&$('monthlyGoal')) $('monthlyGoal').value=cfg.monthlyGoal;
  if(cfg.threshold){ if($('configDebtThreshold')) $('configDebtThreshold').value=cfg.threshold; if($('debtThreshold')) $('debtThreshold').value=cfg.threshold; }
  if(cfg.theme&&$('themeSelect')){ $('themeSelect').value=cfg.theme; document.body.classList.toggle('dark',cfg.theme==='dark'); }
  if(cfg.refresh&&$('autoRefresh')){ $('autoRefresh').value=cfg.refresh; setAutoRefresh(Number(cfg.refresh)); }
}
function setAutoRefresh(ms){ if(refreshTimer) clearInterval(refreshTimer); refreshTimer=null; if(ms>0) refreshTimer=setInterval(loadData,ms); }
function resetConfig(){ localStorage.removeItem('avaConfig'); location.reload(); }

function rowsFor(kind,name){ if(kind==='cajero') return filteredRows.filter(r=>r._cajero===name); if(kind==='conductor') return filteredRows.filter(r=>r._conductor===name); if(kind==='estatus') return filteredRows.filter(r=>r._estatus===name); if(kind==='ruta') return filteredRows.filter(r=>r._ruta===name); if(kind==='empresa') return filteredRows.filter(r=>r._empresa===name); return filteredRows; }
function openDetail(kind,name){ const rows=rowsFor(kind,name); const cob=rows.filter(r=>r._tipo==='COBRADO').reduce((s,r)=>s+r._monto,0), ade=rows.filter(r=>r._tipo==='ADEUDO').reduce((s,r)=>s+r._monto,0); $('detailKind').textContent=`Detalle por ${kind}`; $('detailTitle').textContent=name; $('detailStats').innerHTML=`<div><span>Cobrado</span><b>${money(cob)}</b></div><div><span>Adeudo</span><b>${money(ade)}</b></div><div><span>Registros</span><b>${rows.length}</b></div>`; $('detailBody').innerHTML=rows.slice(0,250).map(rowHtml).join(''); $('detailPanel').classList.add('open'); $('detailPanel').setAttribute('aria-hidden','false'); }
function closeDetail(){ $('detailPanel').classList.remove('open'); $('detailPanel').setAttribute('aria-hidden','true'); }
function baseOptions(){ return {responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{usePointStyle:true}},tooltip:{callbacks:{label:c=>`${c.dataset.label||c.label||''}: ${money(c.raw)}`}}},scales:{y:{ticks:{callback:v=>money(v)},grid:{color:'rgba(120,120,140,.12)'}},x:{grid:{display:false}}},animation:{duration:900,easing:'easeOutQuart'},onClick:chartClick}; }
function chartClick(evt,elements,chart){ if(!elements.length) return; const id=chart.canvas.id, idx=elements[0].index, link=chartLinks[id]?.[idx]; if(link) openDetail(link.kind,link.name); }
function bar(id,labels,datasets){ chartLinks[id]=labels.map(name=>({kind:'empresa',name})); draw(id,'bar',{labels,datasets:datasets.map(d=>({label:d.label,data:d.data,backgroundColor:d.bg,borderRadius:14,borderSkipped:false}))},baseOptions()); }
function horizontal(id,labels,data,bg,label,kind){ chartLinks[id]=labels.map(name=>({kind:kind||'conductor',name})); const o=baseOptions(); o.indexAxis='y'; o.scales.x={ticks:{callback:v=>money(v)},grid:{color:'rgba(120,120,140,.12)'}}; o.scales.y={grid:{display:false}}; draw(id,'bar',{labels,datasets:[{label,data,backgroundColor:bg,borderRadius:12,borderSkipped:false}]},o); }
function horizontalCount(id,labels,data,bg,label,kind){ chartLinks[id]=labels.map(name=>({kind,name})); const o=baseOptions(); o.indexAxis='y'; o.scales.x={ticks:{callback:v=>v},grid:{color:'rgba(120,120,140,.12)'}}; o.scales.y={grid:{display:false}}; o.plugins.tooltip.callbacks.label=c=>`${c.dataset.label}: ${c.raw}`; draw(id,'bar',{labels,datasets:[{label,data,backgroundColor:bg,borderRadius:12,borderSkipped:false}]},o); }
function line(id,labels,datasets){ draw(id,'line',{labels,datasets:datasets.map(d=>({label:d.label,data:d.data,borderColor:d.color,backgroundColor:d.color+'33',fill:true,tension:.42,pointRadius:3,pointHoverRadius:6}))},baseOptions()); }
function doughnut(id,data,colors){ draw(id,'doughnut',{labels:['Cobrado','Adeudo'],datasets:[{data,backgroundColor:colors,borderWidth:5,borderColor:getComputedStyle(document.body).getPropertyValue('--card')||'#fff',hoverOffset:10}]},{responsive:true,maintainAspectRatio:false,cutout:'68%',plugins:{legend:{position:'bottom',labels:{usePointStyle:true}},tooltip:{callbacks:{label:c=>`${c.label}: ${money(c.raw)}`}}},animation:{animateRotate:true,duration:1100}}); }
function doughnutGeneric(id,labels,data,colors){ draw(id,'doughnut',{labels,datasets:[{data,backgroundColor:colors,borderWidth:5,borderColor:getComputedStyle(document.body).getPropertyValue('--card')||'#fff',hoverOffset:8}]},{responsive:true,maintainAspectRatio:false,cutout:'62%',plugins:{legend:{position:'bottom',labels:{usePointStyle:true}},tooltip:{callbacks:{label:c=>`${c.label}: ${c.raw} registros`}}},animation:{animateRotate:true,duration:1100}}); }
function gauge(id,pct,colors){ draw(id,'doughnut',{labels:['Recuperado','Pendiente'],datasets:[{data:[Math.max(0,Math.min(100,pct)),Math.max(0,100-pct)],backgroundColor:[colors[0],colors[1]],borderWidth:0,circumference:180,rotation:270}]},{responsive:true,maintainAspectRatio:false,cutout:'75%',plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`${c.label}: ${c.raw.toFixed(1)}%`}}},animation:{animateRotate:true,duration:1200}}); }
function draw(id,type,data,options){ if(charts[id]) charts[id].destroy(); if(!$(id)) return; charts[id]=new Chart($(id),{type,data,options}); }
function grad(id,a,b){ const el=$(id); if(!el) return a; const ctx=el.getContext('2d'); const g=ctx.createLinearGradient(0,0,420,0); g.addColorStop(0,a); g.addColorStop(1,b); return g; }
function rowHtml(r){ return `<tr><td><span class="tag ${r._tipo==='COBRADO'?'cobrado':'adeudo'}">${r._tipo}</span></td><td><span class="status-badge">${escapeHtml(r._estatus)}</span></td><td>${r._empresa}</td><td>${r._fechaTexto}</td><td>${escapeHtml(r._folio)}</td><td><button class="link-btn" data-kind="conductor" data-name="${escapeHtml(r._conductor)}">${escapeHtml(r._conductor)}</button></td><td>${escapeHtml(r._bus)}</td><td><button class="link-btn" data-kind="cajero" data-name="${escapeHtml(r._cajero)}">${escapeHtml(r._cajero)}</button></td><td><b>${money(r._monto)}</b></td></tr>`; }
function renderTable(){ const rows=filteredRows.slice(0,500); $('reportCount').textContent=`${filteredRows.length} registros`; $('reportBody').innerHTML=rows.map(rowHtml).join(''); $('reportBody').querySelectorAll('.link-btn').forEach(b=>b.onclick=()=>openDetail(b.dataset.kind,b.dataset.name)); }
function exportCSV(){ const headers=['Tipo','Estatus','Empresa','Fecha','Folio/Viaje','Conductor','Autobus','Cajero','Ruta','Monto']; const lines=[headers.join(',')].concat(filteredRows.map(r=>[r._tipo,r._estatus,r._empresa,r._fechaTexto,r._folio,r._conductor,r._bus,r._cajero,r._ruta,r._monto].map(v=>`"${String(v).replace(/"/g,'""')}"`).join(','))); download(new Blob([lines.join('\n')],{type:'text/csv;charset=utf-8'}),'reporte_ava.csv'); }
async function exportPDF(){ const el=$('dashboard'); const canvas=await html2canvas(el,{scale:1.4,useCORS:true,backgroundColor:getComputedStyle(document.body).backgroundColor}); const img=canvas.toDataURL('image/jpeg',.92); const {jsPDF}=window.jspdf; const pdf=new jsPDF('p','mm','a4'); const w=210,h=canvas.height*w/canvas.width; pdf.setFontSize(16); pdf.text('Centro de Control AVA - Reporte Ejecutivo',12,12); pdf.setFontSize(10); pdf.text(`Generado: ${new Date().toLocaleString('es-MX')}`,12,18); pdf.addImage(img,'JPEG',0,24,w,h); pdf.save('reporte_ava_ejecutivo.pdf'); }
function download(blob,name){ const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; a.click(); URL.revokeObjectURL(a.href); }
function animateText(id,text){ const el=$(id); if(el) el.textContent=text; }
function escapeHtml(s){ return String(s??'').replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }
$('applyFilters').onclick=applyFilters; $('refreshBtn').onclick=loadData; $('csvBtn').onclick=exportCSV; $('pdfBtn').onclick=exportPDF; $('themeBtn').onclick=()=>{document.body.classList.toggle('dark'); if($('themeSelect')) $('themeSelect').value=document.body.classList.contains('dark')?'dark':'light'; setTimeout(renderAll,120)}; $('searchFilter').addEventListener('input',()=>applyFilters()); $('debtThreshold')?.addEventListener('input',()=>{ if($('configDebtThreshold')) $('configDebtThreshold').value=$('debtThreshold').value; renderAlerts(); }); $('configDebtThreshold')?.addEventListener('input',()=>{ if($('debtThreshold')) $('debtThreshold').value=$('configDebtThreshold').value; renderAlerts(); }); $('monthlyGoal')?.addEventListener('input',()=>renderGoal(sumByType('COBRADO'))); $('themeSelect')?.addEventListener('change',()=>{document.body.classList.toggle('dark',$('themeSelect').value==='dark'); setTimeout(renderAll,120)}); $('autoRefresh')?.addEventListener('change',()=>setAutoRefresh(Number($('autoRefresh').value))); $('saveConfig')?.addEventListener('click',saveConfig); $('resetConfig')?.addEventListener('click',resetConfig); $('mobileMenu').onclick=()=>$('sidebar').classList.toggle('open'); document.querySelectorAll('.sidebar a').forEach(a=>a.onclick=()=>{$('sidebar').classList.remove('open');document.querySelectorAll('.sidebar a').forEach(x=>x.classList.remove('active'));a.classList.add('active')}); $('detailClose').onclick=closeDetail; $('detailBackdrop').onclick=closeDetail;
loadConfig();
loadData();
