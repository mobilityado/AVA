const chartRefs = {};
const COLORS = {
  green:'#16a34a', red:'#dc2626', blue:'#2563eb', purple:'#7c3aed', orange:'#f59e0b', cyan:'#06b6d4', navy:'#172554', gray:'#94a3b8'
};
Chart.defaults.font.family = 'Inter, Segoe UI, Arial, sans-serif';
Chart.defaults.color = '#64748b';
function money(v){return Number(v||0).toLocaleString('es-MX',{style:'currency',currency:'MXN'});}
function pct(v){return `${Math.round(v||0)}%`;}
function sum(arr, fn){return arr.reduce((a,x)=>a+(Number(fn(x))||0),0);}
function groupSum(rows, keyFn, valFn){
  const m = new Map();
  rows.forEach(r=>{ const k = keyFn(r) || 'SIN DATO'; m.set(k, (m.get(k)||0) + (Number(valFn(r))||0)); });
  return [...m.entries()].map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);
}
function destroy(id){if(chartRefs[id]){chartRefs[id].destroy(); delete chartRefs[id];}}
function grad(ctx, color){
  const g = ctx.createLinearGradient(0,0,0,280);
  g.addColorStop(0,color); g.addColorStop(1,color+'55'); return g;
}
function renderBar(id, labels, datasets, horizontal=false){
  destroy(id); const el = document.getElementById(id); const ctx = el.getContext('2d');
  chartRefs[id] = new Chart(ctx,{type:'bar',data:{labels,datasets:datasets.map(d=>({...d,borderRadius:10,borderSkipped:false}))},options:{responsive:true,maintainAspectRatio:false,indexAxis:horizontal?'y':'x',plugins:{legend:{position:'bottom'},tooltip:{callbacks:{label:c=>`${c.dataset.label}: ${money(c.raw)}`}}},scales:{x:{grid:{display:false}},y:{beginAtZero:true,grid:{color:'#eef2f7'},ticks:{callback:v=>horizontal?labels[v]:money(v)}}}});
}
function renderLine(id, labels, cobrado, adeudo){
  destroy(id); const ctx = document.getElementById(id).getContext('2d');
  chartRefs[id] = new Chart(ctx,{type:'line',data:{labels,datasets:[{label:'Cobrado',data:cobrado,borderColor:COLORS.green,backgroundColor:'rgba(22,163,74,.13)',fill:true,tension:.38,pointRadius:3},{label:'Adeudo',data:adeudo,borderColor:COLORS.red,backgroundColor:'rgba(220,38,38,.10)',fill:true,tension:.38,pointRadius:3}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom'},tooltip:{callbacks:{label:c=>`${c.dataset.label}: ${money(c.raw)}`}}},scales:{x:{grid:{display:false}},y:{beginAtZero:true,ticks:{callback:v=>money(v)},grid:{color:'#eef2f7'}}}});
}
function renderDonut(id, cobrado, adeudo){
  destroy(id); const ctx = document.getElementById(id).getContext('2d');
  chartRefs[id] = new Chart(ctx,{type:'doughnut',data:{labels:['Cobrado','Adeudo'],datasets:[{data:[cobrado,adeudo],backgroundColor:[COLORS.green,COLORS.red],borderWidth:0,hoverOffset:8}]},options:{responsive:true,maintainAspectRatio:false,cutout:'70%',plugins:{legend:{position:'bottom'},tooltip:{callbacks:{label:c=>`${c.label}: ${money(c.raw)}`}}}}});
}
