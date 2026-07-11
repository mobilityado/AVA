/* CIO AVA Enterprise 3.0 — Decision Intelligence (local, sin servicios externos) */
(function(){
'use strict';
const state={context:[],lastTopic:'general',alerts:[],topCashiers:[]};
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const rowsNow=()=>typeof filtered!=='undefined'&&filtered.length?filtered:(typeof raw!=='undefined'?raw:[]);
const incRows=rows=>rows.filter(r=>r._clase==='INCIDENCIA');
const cashRows=rows=>rows.filter(r=>r._clase==='COBRO');
const validDate=r=>r&&r._fecha instanceof Date&&!Number.isNaN(r._fecha.getTime());
const pct=(a,b)=>b?Math.max(0,Math.min(100,a/b*100)):0;
function monthKey(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}
function operationalMetrics(){
  const rows=rowsNow(),m=recoveryMetrics(rows),inc=incRows(rows),cash=cashRows(rows),hon=honesty(rows);
  const months={};
  rows.filter(validDate).forEach(r=>{const k=monthKey(r._fecha);months[k]??={generated:0,recovered:0,incidents:0};if(r._clase==='INCIDENCIA'){months[k].generated+=Number(r._monto)||0;months[k].incidents++}if(r._clase==='INCIDENCIA'&&lc(r._estatus)==='cobrado')months[k].recovered+=Number(r._monto)||0});
  const monthSeries=Object.entries(months).sort((a,b)=>a[0].localeCompare(b[0])).map(([month,v])=>({month,...v}));
  return{rows,m,inc,cash,hon,monthSeries};
}
function buildScore(){
  const {m,inc,hon,monthSeries}=operationalMetrics();
  const recovery=Math.min(100,m.porcentaje||0);
  const pendingScore=100-Math.min(100,pct(m.pendiente,m.generadoHonestidad||1));
  let trendScore=65;
  if(monthSeries.length>=2){const a=monthSeries.at(-2).recovered,b=monthSeries.at(-1).recovered;trendScore=a?Math.max(0,Math.min(100,50+(b-a)/a*100)):75}
  const topDriver=sorted(group(inc,'_conductor'),'count')[0];
  const concentration=inc.length&&topDriver?topDriver.count/inc.length*100:0;
  const dispersionScore=100-Math.min(100,concentration*3);
  const honestyWeight=inc.length?hon.length/inc.length:0;
  const categoryScore=Math.max(0,100-honestyWeight*35);
  const score=Math.round(recovery*.48+pendingScore*.18+trendScore*.14+dispersionScore*.10+categoryScore*.10);
  return{score,recovery,pendingScore,trendScore,dispersionScore,label:score>=90?'Excelente':score>=75?'Estable':score>=60?'Atención':'Crítico'};
}
function renderScore(){
  const x=buildScore(),g=document.getElementById('executiveScoreGauge'),v=document.getElementById('executiveScoreValue'),l=document.getElementById('executiveScoreLabel'),d=document.getElementById('executiveScoreDetail');if(!g)return;
  g.style.setProperty('--score',`${Math.max(0,Math.min(280,x.score*2.8))}deg`);v.textContent=x.score;l.textContent=x.label;d.textContent=`Recuperación ${x.recovery.toFixed(1)}% · Tendencia ${x.trendScore.toFixed(0)}/100 · Dispersión ${x.dispersionScore.toFixed(0)}/100`;
}
function decisionRecommendations(){
  const {m,inc,hon,monthSeries}=operationalMetrics(),out=[];
  const drivers=sorted(group(inc.filter(r=>r._pendiente>0),'_conductor')).slice(0,3);
  if(m.porcentaje<90)out.push(['🎯','Priorizar recuperación',`La recuperación general está en ${m.porcentaje.toFixed(1)}%. Revisar los saldos de mayor impacto.`]);
  else out.push(['✅','Mantener disciplina operativa',`La recuperación general es favorable (${m.porcentaje.toFixed(1)}%).`]);
  if(drivers.length)out.push(['👤','Atender reincidencias',`${drivers.map(x=>x.key).join(', ')} concentran los pendientes más altos.`]);
  const routes=sorted(group(hon,'_ruta'),'count').slice(0,2);if(routes.length)out.push(['📍','Reforzar supervisión',`${routes.map(x=>x.key).join(' y ')} presentan mayor concentración de Honestidad.`]);
  if(monthSeries.length>=2&&monthSeries.at(-1).recovered<monthSeries.at(-2).recovered)out.push(['📉','Corregir desaceleración','La recuperación del último periodo está debajo del anterior.']);
  if(isAdmin()){const top=sorted(group(cashRows(rowsNow()),'_cajero')).slice(0,1)[0];if(top)out.push(['🏅','Reconocer desempeño',`${top.key} encabeza la recuperación de cajeros con ${money(top.total)}.`])}
  return out.slice(0,5);
}
function renderRecommendations(){const el=document.getElementById('decisionRecommendations');if(!el)return;el.innerHTML=decisionRecommendations().map(x=>`<div class="decision-item"><i>${x[0]}</i><div><b>${esc(x[1])}</b><small>${esc(x[2])}</small></div></div>`).join('')}
function linearPrediction(series,periods){
  const vals=series.map(x=>x.recovered).filter(Number.isFinite);if(!vals.length)return 0;if(vals.length===1)return vals[0];const n=vals.length,xm=(n-1)/2,ym=vals.reduce((a,b)=>a+b,0)/n;let num=0,den=0;vals.forEach((y,x)=>{num+=(x-xm)*(y-ym);den+=(x-xm)**2});const slope=den?num/den:0;return Math.max(0,ym+slope*(n-1+periods));
}
function renderPredictions(){
  const el=document.getElementById('predictionScenarios');if(!el)return;const {monthSeries}=operationalMetrics(),base=linearPrediction(monthSeries,1);const rows=[['Conservador',base*.88,'Próximo periodo con margen de seguridad'],['Esperado',base,'Continuidad de la tendencia actual'],['Optimista',base*1.12,'Mejora operativa y mayor recuperación']];el.innerHTML=rows.map(r=>`<div class="scenario-item"><div><b>${r[0]}</b><small>${r[2]}</small></div><strong>${money(r[1])}</strong></div>`).join('')
}
function routeRiskData(){const {inc,hon}=operationalMetrics(),all=sorted(group(inc,'_ruta'),'count').filter(x=>x.key&&!String(x.key).startsWith('SIN ')).slice(0,15);return all.map(x=>{const h=hon.filter(r=>r._ruta===x.key).length,ratio=x.count?h/x.count:0,level=ratio>=.5||x.count>=Math.max(20,inc.length*.08)?'high':ratio>=.25||x.count>=Math.max(10,inc.length*.04)?'medium':'low';return{...x,h,ratio,level}})}
function renderRouteMap(){const el=document.getElementById('routeRiskMap');if(!el)return;const data=routeRiskData();el.innerHTML=data.length?data.map(x=>`<button class="route-risk-node ${x.level}" data-route="${esc(x.key)}"><b>${esc(x.key)}</b><span>${x.count} incidencias</span><small>${x.h} de Honestidad · ${money(x.total)}</small></button>`).join(''):'<p>Sin rutas disponibles.</p>';el.querySelectorAll('[data-route]').forEach(b=>b.onclick=()=>{const q=b.dataset.route;const found=rowsNow().filter(r=>r._ruta===q);document.getElementById('detailContent').innerHTML=`<h2>${esc(q)}</h2><div class="kpi"><span>Incidencias</span><b>${found.length}</b><small>${money(sum(found))}</small></div>`+found.slice(0,80).map(r=>`<div class="alert"><b>${esc(r._conductor)}</b> · ${money(r._monto)}<br><small>${r._fecha?r._fecha.toLocaleDateString('es-MX'):''} · ${esc(r._rubro)} · ${esc(r._anomalia)}</small></div>`).join('');document.getElementById('detailPanel').classList.add('open')})}
function renderTimeline(){const el=document.getElementById('operationalTimeline');if(!el)return;const list=rowsNow().filter(validDate).sort((a,b)=>b._fecha-a._fecha).slice(0,40);el.innerHTML=list.length?list.map(r=>`<div class="timeline-item"><b>${r._clase==='COBRO'?'Recuperación':'Incidencia'} · ${money(r._monto)}</b><span>${esc(r._conductor||r._cajero||'Registro operativo')}</span><small>${r._fecha.toLocaleString('es-MX')} · ${esc(r._rubro)} · ${esc(r._ruta)}</small></div>`).join(''):'<p>Sin eventos fechados.</p>'}
function renderRecognition(){const el=document.getElementById('recognitionPodium');if(!el)return;if(!isAdmin()){el.innerHTML='<p>Disponible para administradores.</p>';return}const top=sorted(group(cashRows(rowsNow()),'_cajero')).filter(x=>x.key&&!String(x.key).startsWith('SIN ')).slice(0,3);state.topCashiers=top;const medals=['🥇','🥈','🥉'];el.innerHTML=top.length?top.map((x,i)=>`<div class="podium-place"><span class="medal">${medals[i]}</span><b>${esc(x.key)}</b><span>${money(x.total)}</span><small>${x.count} recuperaciones</small></div>`).join(''):'<p>Sin datos de cajeros.</p>'}
function generateDiploma(){if(!isAdmin()||!state.topCashiers.length)return toast('No hay datos para el reconocimiento');const winner=state.topCashiers[0],{jsPDF}=window.jspdf||{};if(!jsPDF)return toast('No se pudo cargar PDF');const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});doc.setFillColor(35,18,78);doc.rect(0,0,297,210,'F');doc.setDrawColor(192,132,252);doc.setLineWidth(2);doc.rect(10,10,277,190);doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(28);doc.text('CIO AVA',148.5,38,{align:'center'});doc.setFontSize(15);doc.text('Centro de Inteligencia Operativa AVA',148.5,50,{align:'center'});doc.setTextColor(216,180,254);doc.setFontSize(18);doc.text('RECONOCIMIENTO A LA RECUPERACIÓN',148.5,78,{align:'center'});doc.setTextColor(255,255,255);doc.setFontSize(30);doc.text(winner.key,148.5,108,{align:'center'});doc.setFontSize(16);doc.text(`Por encabezar el ranking de cajeros con ${money(winner.total)}`,148.5,127,{align:'center'});doc.setFontSize(12);doc.text('Gerencia Regional de Recaudación VHT · Mobility ADO',148.5,170,{align:'center'});doc.text(new Date().toLocaleDateString('es-MX'),148.5,182,{align:'center'});doc.save(`Reconocimiento_CIO_AVA_${winner.key.replace(/\W+/g,'_')}.pdf`);toast('Diploma generado')}
function buildAlerts(){
  const {m,inc,hon,monthSeries}=operationalMetrics(),a=[];const high=sorted(group(inc.filter(r=>r._pendiente>0),'_conductor')).filter(x=>x.total>=cfg.umbral).slice(0,5);high.forEach(x=>a.push({level:'high',title:`Adeudo crítico: ${x.key}`,detail:`${money(x.total)} pendientes.`}));const routes=sorted(group(hon,'_ruta'),'count').slice(0,3);routes.forEach(x=>{if(x.count>=Math.max(10,hon.length*.05))a.push({level:'medium',title:'Concentración de Honestidad',detail:`${x.key}: ${x.count} incidencias.`})});if(monthSeries.length>=2&&monthSeries.at(-1).recovered<monthSeries.at(-2).recovered)a.push({level:'medium',title:'Recuperación a la baja',detail:'El último periodo quedó debajo del anterior.'});if(m.porcentaje>=95)a.push({level:'ok',title:'Recuperación favorable',detail:`Indicador general de ${m.porcentaje.toFixed(2)}%.`});return a.length?a:[{level:'ok',title:'Operación estable',detail:'No se detectan alertas críticas con los filtros actuales.'}]
}
function renderAlertCenter(){state.alerts=buildAlerts();const count=state.alerts.filter(x=>x.level==='high'||x.level==='medium').length,b=document.getElementById('alertBellCount'),list=document.getElementById('alertBellList');if(b)b.textContent=count;if(list)list.innerHTML=state.alerts.map(x=>`<div class="alert-mini"><b>${x.level==='high'?'🔴':x.level==='medium'?'🟡':'🟢'} ${esc(x.title)}</b><small>${esc(x.detail)}</small></div>`).join('')}
function addContext(role,text){const box=document.getElementById('contextConversation');if(!box)return;state.context.push({role,text});if(state.context.length>12)state.context.shift();box.innerHTML=state.context.map(x=>`<div class="context-msg ${x.role}">${x.role==='bot'?x.text:esc(x.text)}</div>`).join('');box.scrollTop=box.scrollHeight}
function contextualAnswer(q){const t=lc(q);if(/solo honestidad|y solo honestidad/.test(t)){state.lastTopic='honestidad';const h=honesty(rowsNow());return `En <b>Honestidad</b> hay ${h.length.toLocaleString('es-MX')} incidencias por ${money(sum(h))}. La ruta principal es ${esc(sorted(group(h,'_ruta'),'count')[0]?.key||'sin datos')}.`}
  if(/principales responsables|quienes|quiénes/.test(t)&&state.lastTopic==='honestidad'){const h=honesty(rowsNow()),top=sorted(group(h,'_conductor'),'count').slice(0,5);return `Principales conductores en Honestidad: ${top.map(x=>`<b>${esc(x.key)}</b> (${x.count})`).join(', ')||'sin datos'}.`}
  if(/compara|compárame|mes anterior/.test(t)){state.lastTopic='comparacion';const s=operationalMetrics().monthSeries;if(s.length<2)return 'No hay dos periodos completos para comparar.';const a=s.at(-2),b=s.at(-1),dif=b.recovered-a.recovered,per=a.recovered?dif/a.recovered*100:0;return `La recuperación pasó de <b>${money(a.recovered)}</b> en ${a.month} a <b>${money(b.recovered)}</b> en ${b.month}: ${dif>=0?'aumento':'disminución'} de <b>${Math.abs(per).toFixed(1)}%</b>.`}
  if(/recomienda|acción|accion|que hago|qué hago/.test(t))return decisionRecommendations().map(x=>`<b>${esc(x[1])}:</b> ${esc(x[2])}`).join('<br>');
  state.lastTopic='general';return typeof helpAnswer==='function'?helpAnswer(q):'Consulta procesada con los datos actuales.'}
function setupContext(){const form=document.getElementById('contextCopilotForm'),input=document.getElementById('contextCopilotInput');if(!form)return;addContext('bot','Hola. Puedo mantener el contexto de la conversación. Prueba: <b>“Compárame este mes con el anterior”</b> y después <b>“¿Y solo Honestidad?”</b>.');form.addEventListener('submit',e=>{e.preventDefault();const q=input.value.trim();if(!q)return;addContext('user',q);input.value='';setTimeout(()=>addContext('bot',contextualAnswer(q)),180)});document.querySelectorAll('[data-cio-question]').forEach(b=>b.addEventListener('click',()=>{input.value=b.dataset.cioQuestion;form.requestSubmit()}))}
function renderAll(){renderScore();renderRecommendations();renderPredictions();renderRouteMap();renderTimeline();renderRecognition();renderAlertCenter()}
function setup(){
  document.getElementById('generateRecognitionBtn')?.addEventListener('click',generateDiploma);
  const panel=document.getElementById('alertBellPanel');document.getElementById('alertBellBtn')?.addEventListener('click',()=>panel?.classList.toggle('open'));document.getElementById('alertBellClose')?.addEventListener('click',()=>panel?.classList.remove('open'));
  setupContext();document.addEventListener('cioava:data-rendered',renderAll);setTimeout(renderAll,900);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();
