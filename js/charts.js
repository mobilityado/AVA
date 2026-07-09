const chartRefs = {};
const COLORS = {
  navy:'#0b1f3a', blue:'#1f5eff', teal:'#0f766e', emerald:'#059669', slate:'#64748b',
  red:'#b42318', amber:'#b7791f', orange:'#c2410c', green:'#0f766e', violet:'#4f46e5', cyan:'#0891b2', ink:'#111827'
};
function money(v){return Number(v||0).toLocaleString('es-MX',{style:'currency',currency:'MXN'});}
function pct(v){return `${Math.round(v||0)}%`;}
function sum(arr, fn){return (arr||[]).reduce((a,x)=>a+(Number(fn(x))||0),0);}
function groupSum(rows, keyFn, valFn){
  const m = new Map();
  (rows||[]).forEach(r=>{ const k = keyFn(r) || 'SIN DATO'; m.set(k, (m.get(k)||0) + (Number(valFn(r))||0)); });
  return [...m.entries()].map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);
}
function destroy(id){if(chartRefs[id]){chartRefs[id].destroy(); delete chartRefs[id];}}
function chartUnavailable(id, title='Gráfica no disponible'){
  const el=document.getElementById(id); if(!el) return;
  const box=el.parentElement; if(!box) return;
  let msg=box.querySelector('.chart-fallback');
  if(!msg){msg=document.createElement('div'); msg.className='chart-fallback'; box.appendChild(msg);}
  msg.textContent=title;
  el.style.display='none';
}
function ensureChart(id){
  const el=document.getElementById(id); if(!el) return null;
  el.style.display='block';
  const msg=el.parentElement?.querySelector('.chart-fallback'); if(msg) msg.remove();
  if(!window.Chart){ chartUnavailable(id,'No se pudo cargar la librería de gráficas. Revisa conexión a cdn.jsdelivr.net'); return null; }
  return el.getContext('2d');
}
function hexToRgba(hex, alpha){
  const h=hex.replace('#',''); const bigint=parseInt(h,16);
  const r=(bigint>>16)&255, g=(bigint>>8)&255, b=bigint&255;
  return `rgba(${r},${g},${b},${alpha})`;
}
function makeGradient(ctx, color){
  const g=ctx.createLinearGradient(0,0,0,280);
  g.addColorStop(0, color); g.addColorStop(1, hexToRgba(color,.22)); return g;
}
function baseOptions(horizontal=false){
  return {
    responsive:true,
    maintainAspectRatio:false,
    plugins:{
      legend:{position:'bottom',labels:{usePointStyle:true,boxWidth:9,padding:18,color:'#334155',font:{weight:'700'}}},
      tooltip:{backgroundColor:'#0f172a',padding:12,cornerRadius:12,titleFont:{weight:'800'},callbacks:{label:c=>`${c.dataset.label}: ${money(c.raw)}`}}
    },
    scales:{
      x:{grid:{display:false},ticks:{color:'#64748b',font:{weight:'600'}}},
      y:{beginAtZero:true,grid:{color:'rgba(148,163,184,.18)'},ticks:{color:'#64748b',font:{weight:'600'},callback:v=>horizontal?undefined:money(v)}}
    }
  };
}
function renderBar(id, labels, datasets, horizontal=false){
  destroy(id); const ctx=ensureChart(id); if(!ctx) return;
  const ds=datasets.map(d=>({
    ...d,
    backgroundColor: d.backgroundColor?.startsWith('#') ? makeGradient(ctx,d.backgroundColor) : d.backgroundColor,
    borderRadius:12,
    borderSkipped:false,
    maxBarThickness:44
  }));
  const options=baseOptions(horizontal); options.indexAxis=horizontal?'y':'x';
  if(horizontal){ options.scales.x.ticks.callback=v=>money(v); options.scales.y.grid={display:false}; }
  chartRefs[id]=new Chart(ctx,{type:'bar',data:{labels,datasets:ds},options});
}
function renderLine(id, labels, cobrado, adeudo){
  destroy(id); const ctx=ensureChart(id); if(!ctx) return;
  chartRefs[id]=new Chart(ctx,{type:'line',data:{labels,datasets:[
    {label:'Cobrado',data:cobrado,borderColor:COLORS.teal,backgroundColor:hexToRgba(COLORS.teal,.13),fill:true,tension:.42,pointRadius:3,pointHoverRadius:6,borderWidth:3},
    {label:'Adeudo',data:adeudo,borderColor:COLORS.red,backgroundColor:hexToRgba(COLORS.red,.10),fill:true,tension:.42,pointRadius:3,pointHoverRadius:6,borderWidth:3}
  ]},options:baseOptions(false)});
}
function renderDonut(id, cobrado, adeudo){
  destroy(id); const ctx=ensureChart(id); if(!ctx) return;
  chartRefs[id]=new Chart(ctx,{type:'doughnut',data:{labels:['Cobrado','Adeudo'],datasets:[{data:[cobrado,adeudo],backgroundColor:[COLORS.teal,COLORS.red],borderWidth:5,borderColor:'#fff',hoverOffset:8}]},options:{responsive:true,maintainAspectRatio:false,cutout:'72%',plugins:{legend:{position:'bottom',labels:{usePointStyle:true,boxWidth:9,padding:18,color:'#334155',font:{weight:'700'}}},tooltip:{backgroundColor:'#0f172a',padding:12,cornerRadius:12,callbacks:{label:c=>`${c.label}: ${money(c.raw)}`}}}}});
}
