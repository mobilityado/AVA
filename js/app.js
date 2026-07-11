const API='https://script.google.com/macros/s/AKfycbxpX9FNMZZDL72L76vS4keCiWC3xPb79_cMkpcBk0_AqktKHizk7j5A6r53brRN9y9d/exec';
const SHEETS=[['TRT','COBRO','TRT'],['SUR','COBRO','SUR'],['AVATRT','INCIDENCIA','TRT'],['AVASUR','INCIDENCIA','SUR']];let raw=[],filtered=[],charts={},timer=null;
const SESSION_KEY='cioAvaSessionV45';let session=null;
let cfg;try{cfg=JSON.parse(localStorage.getItem('avaCfg')||'{"meta":50000,"umbral":10000,"refresh":60000,"theme":"light"}')}catch(_){cfg={meta:50000,umbral:10000,refresh:60000,theme:'light'}};
function hideSplash(){if(typeof window.forceCloseAvaSplash==='function'){window.forceCloseAvaSplash();return}const sp=document.querySelector('#splash');if(sp){sp.classList.add('hide');setTimeout(()=>sp.remove(),550)}}
function on(sel,event,fn){const el=$(sel);if(el)el.addEventListener(event,fn)}
const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s),money=n=>(+n||0).toLocaleString('es-MX',{style:'currency',currency:'MXN'}),clean=s=>String(s??'').trim(),lc=s=>clean(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''),num=n=>Number(String(n??'').replace(/[$,%\s,]/g,''))||0;
const pick=(o,ks)=>{const m={};Object.keys(o||{}).forEach(k=>m[lc(k)]=o[k]);for(const k of ks){let v=m[lc(k)];if(v!==undefined&&v!==null&&clean(v)!=='')return v}return''};
function parseDate(v){if(!v)return null;if(v instanceof Date)return v;const s=clean(v);let d=new Date(s);if(!isNaN(d)&&d.getFullYear()>2020&&d.getFullYear()<2036)return d;let m=s.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/);if(m){let y=+m[3];if(y<100)y+=2000;d=new Date(y,+m[2]-1,+m[1]);if(y>2020&&y<2036)return d}return null}
const route=r=>clean(pick(r,['Origen Destino Anomalía']))||[pick(r,['Origen']),pick(r,['Destino'])].filter(Boolean).join(' → ')||'SIN RUTA';
function normalize(r,clase,empresa,hoja){const d=parseDate(pick(r,clase==='COBRO'?['Fecha Cobro','Fecha del Viaje']:['Fecha Corrida','Fecha Cobro','Fecha']));const rubro=clase==='INCIDENCIA'?(clean(pick(r,['Tipo','Rubro','Categoría']))||'SIN RUBRO'):'RECUPERACIÓN';const costo=clase==='INCIDENCIA'?num(pick(r,['Costo','Por Cobrar','Importe','Monto'])):num(pick(r,['Monto Recuperado','Monto','Importe']));const pendiente=clase==='INCIDENCIA'&&lc(pick(r,['Estatus']))!=='cobrado'?num(pick(r,['Por Cobrar','Costo','Importe'])):0;return{...r,_clase:clase,_empresa:empresa,_hoja:hoja,_fecha:d,_mes:d?`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`:'SIN FECHA',_anio:d?String(d.getFullYear()):'SIN FECHA',_rubro:rubro,_monto:costo,_pendiente:pendiente,_estatus:clean(pick(r,['Estatus','Status','Estado']))||'SIN ESTATUS',_conductor:clean(pick(r,['Conductor','Nombre Conductor','Operador']))||'SIN CONDUCTOR',_cajero:clean(pick(r,['Nombre Cajero','Cajero']))||'SIN CAJERO',_autobus:clean(pick(r,['Autobus','Autobús','Unidad']))||'',_folio:clean(pick(r,['Folio Recibo','Reporte','Viaje','Id Viaje']))||'',_anomalia:clean(pick(r,['Anomalía','Anomalia']))||'SIN ANOMALÍA',_ruta:route(r)}}
async function apiGet(accion,params={}){const q=new URLSearchParams({accion,...params,_:Date.now()});const res=await fetch(`${API}?${q.toString()}`,{cache:'no-store'});const j=await res.json();if(j.codigo==='SESION_INVALIDA'||j.codigo==='NO_AUTORIZADO'){await endSession(false);throw new Error('La sesión terminó. Inicia sesión nuevamente.')}return j}
async function apiPost(payload){const res=await fetch(API,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload),redirect:'follow'});return res.json()}
function isAdmin(){return session?.rol==='ADMINISTRADOR'}
function saveSession(data){session={token:data.token,usuario:data.usuario,nombre:data.nombre||data.usuario,rol:data.rol,ultimoAcceso:data.ultimoAcceso||null,expira:data.expira||null};sessionStorage.setItem(SESSION_KEY,JSON.stringify(session))}
function readSession(){try{return JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null')}catch(_){return null}}
function setLoginMessage(text,type='error'){const el=$('#loginMessage');if(!el)return;el.textContent=text;el.className=`login-message ${type}`}
function showLogin(){document.body.classList.add('auth-locked');$('#loginScreen')?.classList.remove('hidden');$('#loginScreen')?.setAttribute('aria-hidden','false');setTimeout(()=>$('#loginPassword')?.focus(),150)}
function hideLogin(){document.body.classList.remove('auth-locked');$('#loginScreen')?.classList.add('hidden');$('#loginScreen')?.setAttribute('aria-hidden','true')}
async function loadLoginUsers(){const sel=$('#loginUser');try{const j=await apiGet('usuarios');const users=(j.usuarios||[]).map(u=>typeof u==='string'?{usuario:u,nombre:u}:u).sort((a,b)=>(a.nombre||a.usuario).localeCompare(b.nombre||b.usuario,'es'));sel.innerHTML='<option value="">Selecciona un usuario</option>'+users.map(u=>{const value=String(u.usuario||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;');const label=String(u.nombre||u.usuario||'').replace(/&/g,'&amp;').replace(/</g,'&lt;');return `<option value="${value}">${label}${u.nombre&&u.nombre!==u.usuario?' — '+u.usuario:''}</option>`}).join('');if(!users.length)setLoginMessage('No se encontraron usuarios en la pestaña USUARIOS.')}catch(e){console.error(e);sel.innerHTML='<option value="">No fue posible cargar usuarios</option>';setLoginMessage('No se pudo conectar con Apps Script. Revisa la nueva implementación.') }}
function formatAccess(ts){if(!ts)return 'Primer acceso';const d=new Date(Number(ts));return isNaN(d)?'Primer acceso':d.toLocaleString('es-MX',{dateStyle:'short',timeStyle:'short'})}function applyRoleUI(){const admin=isAdmin(),display=session?.nombre||session?.usuario||'Usuario';document.body.dataset.role=session?.rol||'';$$('[data-admin-only]').forEach(el=>{el.hidden=!admin;el.classList.toggle('role-hidden',!admin)});$('#sessionBadge').hidden=false;$('#logoutBtn').hidden=false;$('#sessionName').textContent=display;$('#sessionRole').textContent=admin?'ADMINISTRADOR':'USUARIO';$('#sessionInitial').textContent=display.charAt(0).toUpperCase();const access=formatAccess(session?.ultimoAcceso);if($('#sessionLastAccess'))$('#sessionLastAccess').textContent=`Último acceso: ${access}`;if($('#welcomeName'))$('#welcomeName').textContent=display;if($('#welcomeMeta'))$('#welcomeMeta').textContent=`Rol: ${admin?'Administrador':'Usuario'} · Último acceso: ${access}`;$('#fSearch').placeholder=admin?'Conductor, cajero, autobús, folio, anomalía o ruta':'Conductor, autobús, folio, anomalía o ruta';$('#helpChatInput').placeholder=admin?'Pregunta sobre datos, cajeros, conductores, rutas…':'Pregunta sobre datos, conductores, rutas…';if(!admin&&$('#cajeros')?.classList.contains('active'))switchView('dashboard');document.dispatchEvent(new CustomEvent('cioava:session-ready',{detail:{rol:session?.rol,usuario:session?.usuario}}))}
function switchView(id){$$('.view').forEach(v=>v.classList.toggle('active',v.id===id));$$('.nav').forEach(n=>n.classList.toggle('active',n.dataset.view===id));const nav=$(`.nav[data-view="${id}"]`);if(nav)$('#pageTitle').textContent=nav.textContent.trim();else $('#pageTitle').textContent='Centro de Inteligencia Operativa AVA'}
async function performLogin(e){e?.preventDefault();const usuario=$('#loginUser').value,contrasena=$('#loginPassword').value,btn=$('#loginSubmit');if(!usuario||!contrasena){setLoginMessage('Selecciona un usuario e ingresa la contraseña.');return}btn.disabled=true;btn.textContent='Validando…';setLoginMessage('');try{const equipo=[navigator.userAgent,navigator.platform||'',screen.width+'x'+screen.height].filter(Boolean).join(' | ');const j=await apiPost({accion:'login',usuario,contrasena,equipo});if(!j.autorizado)throw new Error(j.mensaje||'Credenciales incorrectas.');saveSession(j);applyRoleUI();hideLogin();$('#loginPassword').value='';await loadData();toast(`Bienvenido, ${session.nombre||session.usuario}`)}catch(e){console.error(e);setLoginMessage(e.message||'No fue posible iniciar sesión.')}finally{btn.disabled=false;btn.textContent='Entrar a CIO AVA'}}
async function endSession(callServer=true){const token=session?.token;if(callServer&&token){try{await apiPost({accion:'logout',token})}catch(_){}}session=null;sessionStorage.removeItem(SESSION_KEY);raw=[];filtered=[];if(timer)clearInterval(timer);Object.values(charts).forEach(c=>{try{c.destroy()}catch(_){}});charts={};$('#sessionBadge')?.setAttribute('hidden','');$('#logoutBtn')?.setAttribute('hidden','');showLogin();setSync('Sesión cerrada');}
async function initializeAuth(){on('#loginForm','submit',performLogin);on('#logoutBtn','click',()=>endSession(true));on('#togglePassword','click',()=>{const i=$('#loginPassword');i.type=i.type==='password'?'text':'password'});await loadLoginUsers();const saved=readSession();if(saved?.token){try{const j=await apiGet('sesion',{token:saved.token});if(j.autorizado){saveSession({...saved,...j});applyRoleUI();hideLogin();return true}}catch(_){}}showLogin();return false}
async function fetchSheet(x){const[h,c,e]=x;if(!session?.token)throw new Error('No hay sesión activa.');const j=await apiGet('datos',{hoja:h,token:session.token});if(j.error)throw new Error(j.mensaje||`No se pudo leer ${h}`);return(j.datos||j.data||[]).map(r=>normalize(r,c,e,h))}
async function loadData(){
  if(!session?.token)return;
  setSync('Cargando…');
  try{
    const resultados=await Promise.allSettled(SHEETS.map(fetchSheet));
    const correctos=resultados.filter(r=>r.status==='fulfilled').flatMap(r=>r.value);
    const errores=resultados.filter(r=>r.status==='rejected').map(r=>r.reason?.message||'Error desconocido');
    if(!correctos.length){
      throw new Error(errores[0]||'No fue posible cargar las hojas de datos.');
    }
    raw=correctos;
    populateFilters();
    applyFilters();
    const hora=new Date().toLocaleTimeString('es-MX');
    if(errores.length){
      setSync(`Carga parcial ${hora}`,false,true);
      toast(`Se cargaron ${resultados.length-errores.length} de ${resultados.length} hojas. ${errores.join(' | ')}`);
    }else{
      setSync(`Actualizado ${hora}`,true);
      toast('Datos actualizados');
    }
  }catch(e){
    console.error(e);
    setSync('Error al cargar',false,true);
    toast(e.message||'Error de conexión');
  }
}
function setSync(t,ok,err){$('#syncText').textContent=t;$('.sync').className='sync '+(ok?'ok':err?'err':'')}
function populateFilters(){for(const[id,key]of[['#fRubro','_rubro'],['#fEstatus','_estatus']]){const s=$(id),cur=s.value,vals=[...new Set(raw.filter(r=>id==='#fRubro'?r._clase==='INCIDENCIA':true).map(r=>r[key]).filter(Boolean))].sort();s.innerHTML=`<option value="TODOS">Todos</option>`+vals.map(v=>`<option>${v}</option>`).join('');s.value=vals.includes(cur)?cur:'TODOS'}}
function applyFilters(){const emp=$('#fEmpresa').value,rub=$('#fRubro').value,est=$('#fEstatus').value,q=lc($('#fSearch').value),de=$('#fDesde').value?new Date($('#fDesde').value+'T00:00:00'):null,ha=$('#fHasta').value?new Date($('#fHasta').value+'T23:59:59'):null;filtered=raw.filter(r=>(emp==='TODAS'||r._empresa===emp)&&(rub==='TODOS'||r._rubro===rub)&&(est==='TODOS'||r._estatus===est)&&(!de||r._fecha>=de)&&(!ha||r._fecha<=ha)&&(!q||lc([r._conductor,...(isAdmin()?[r._cajero]:[]),r._autobus,r._folio,r._anomalia,r._ruta,r._rubro].join(' ')).includes(q)));renderAll()}
const sum=(a,k='_monto')=>a.reduce((s,r)=>s+(+r[k]||0),0);function group(a,key,value='_monto'){const m={};a.forEach(r=>{const k=typeof key==='function'?key(r):r[key];if(!m[k])m[k]={key:k,total:0,count:0,rows:[]};m[k].total+=+r[value]||0;m[k].count++;m[k].rows.push(r)});return Object.values(m)}
const sorted=(a,mode='total')=>[...a].sort((x,y)=>y[mode]-x[mode]);const honesty=a=>a.filter(r=>r._clase==='INCIDENCIA'&&lc(r._rubro)==='honestidad');
function recoveryMetrics(rows=filtered){
  const cobrosCajeros=rows.filter(r=>r._clase==='COBRO');
  const incidencias=rows.filter(r=>r._clase==='INCIDENCIA');
  const cobradasOtras=incidencias.filter(r=>lc(r._estatus)==='cobrado');
  const generadoHonestidad=sum(honesty(rows));
  const recuperadoCajeros=sum(cobrosCajeros);
  const recuperadoOtras=sum(cobradasOtras);
  // AVATRT y AVASUR ya incluyen también lo cobrado por cajeros.
  // Por eso el total operativo se toma únicamente de los registros AVA con estatus COBRADO.
  const totalRecuperado=recuperadoOtras;
  const pendiente=Math.max(0,generadoHonestidad-totalRecuperado);
  const porcentaje=generadoHonestidad?Math.min(100,totalRecuperado/generadoHonestidad*100):0;
  return{cobrosCajeros,incidencias,cobradasOtras,generadoHonestidad,recuperadoCajeros,recuperadoOtras,totalRecuperado,pendiente,porcentaje};
}
function recoveryByPeriod(rows,key){
  const buckets={};
  rows.forEach(r=>{const period=r[key];if(!period||period==='SIN FECHA')return;buckets[period]??={generado:0,recuperado:0};if(r._clase==='INCIDENCIA'&&lc(r._rubro)==='honestidad')buckets[period].generado+=r._monto||0;if(r._clase==='INCIDENCIA'&&lc(r._estatus)==='cobrado')buckets[period].recuperado+=r._monto||0});
  const labels=Object.keys(buckets).sort();
  return{labels,generated:labels.map(k=>buckets[k].generado),recovered:labels.map(k=>buckets[k].recuperado),percentage:labels.map(k=>buckets[k].generado?Math.min(100,buckets[k].recuperado/buckets[k].generado*100):0)};
}
function chart(id,type,data,options={}){if(charts[id])charts[id].destroy();const el=$("#"+id);if(!el)return;const dark=document.body.classList.contains('dark'),text=dark?'#aeb8c8':'#536078',grid=dark?'#202b3b':'#e5eaf2';charts[id]=new Chart(el,{type,data,options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{color:text,boxWidth:10}},tooltip:{callbacks:{label:c=>`${c.dataset.label||c.label}: ${money(c.raw)}`}}},scales:type==='doughnut'?{}:{x:{ticks:{color:text},grid:{display:false}},y:{beginAtZero:true,ticks:{color:text,callback:v=>Intl.NumberFormat('es-MX',{notation:'compact'}).format(v)},grid:{color:grid}}},...options}})}
function palette(n){return['#8b5cf6','#06b6d4','#10b981','#f59e0b','#ef4444','#ec4899','#3b82f6','#14b8a6','#f97316','#6366f1'].slice(0,n)}
function renderAll(){renderKPIs();renderDashboardCharts();renderRubros();renderHonesty();renderConductores();if(isAdmin())renderCajeros();renderRoutes();renderTrends();renderInsights();renderTable()}
function renderKPIs(){const m=recoveryMetrics(filtered),otros=m.incidencias.filter(r=>lc(r._rubro)!=='honestidad').length;$('#kCobrado').textContent=money(m.totalRecuperado);$('#kHonestidad').textContent=money(m.generadoHonestidad);$('#kOtros').textContent=otros.toLocaleString('es-MX');$('#kAdeudo').textContent=money(m.pendiente);$('#kIncidencias').textContent=m.incidencias.length.toLocaleString('es-MX');$('#kRec').textContent=m.porcentaje.toFixed(2)+'%';$('#gaugeValue').textContent=m.porcentaje.toFixed(2)+'%'}
function renderDashboardCharts(){const m=recoveryMetrics(filtered),rec=m.porcentaje;chart('gaugeChart','doughnut',{labels:['Recuperado','Pendiente'],datasets:[{data:[rec,Math.max(0,100-rec)],backgroundColor:['#10b981','#dfe4ec'],borderWidth:0,circumference:180,rotation:270,cutout:'74%'}]},{plugins:{legend:{display:false},tooltip:{enabled:false}}});const rg=sorted(group(m.incidencias,'_rubro'));chart('rubrosDonut','doughnut',{labels:rg.map(x=>x.key),datasets:[{data:rg.map(x=>x.total),backgroundColor:palette(rg.length),borderWidth:0,cutout:'66%'}]});const monthly=periodByRubros(m.incidencias,'_mes',6),ds=monthly.rubros.slice(0,5).map((r,i)=>({label:r,data:monthly.labels.map(l=>monthly.map[l]?.[r]||0),borderColor:palette(6)[i],backgroundColor:palette(6)[i]+'22',fill:true,tension:.35}));chart('trendRubrosChart','line',{labels:monthly.labels,datasets:ds});const ag=sorted(group(m.incidencias,'_anomalia'),'count').slice(0,10);chart('incidenciasChart','bar',{labels:ag.map(x=>x.key),datasets:[{label:'Incidencias',data:ag.map(x=>x.count),backgroundColor:'#ef4444'}]},{indexAxis:'y',plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`${c.raw} incidencias`}}}});const day=new Date().getDate(),last=new Date(new Date().getFullYear(),new Date().getMonth()+1,0).getDate(),forecast=day?m.totalRecuperado/day*last:0,advance=cfg.meta?Math.min(100,m.totalRecuperado/cfg.meta*100):0;$('#forecastBox').innerHTML=`<b>${money(forecast)}</b><br>Proyección de recuperación general al cierre del mes<br>Meta: ${money(cfg.meta)} · Avance ${advance.toFixed(1)}%`;$('#forecastProgress').style.width=advance+'%';if(isAdmin())renderRank('#topCajeros',sorted(group(m.cobrosCajeros,'_cajero')).slice(0,10),'cajero','total');renderRank('#topConductores',sorted(group(m.incidencias,'_conductor'),'count').slice(0,10),'conductor','count')}
function periodByRubros(a,key,limit=12){const map={},rs=[...new Set(a.map(r=>r._rubro))];a.forEach(r=>{if(r[key]==='SIN FECHA')return;map[r[key]]??={};map[r[key]][r._rubro]=(map[r[key]][r._rubro]||0)+r._monto});return{map,rubros:rs,labels:Object.keys(map).sort().slice(-limit)}}
function renderRubros(){const inc=filtered.filter(r=>r._clase==='INCIDENCIA'),g=sorted(group(inc,'_rubro'),'count'),totalInc=g.reduce((a,x)=>a+x.count,0);chart('rubrosChart','pie',{labels:g.map(x=>x.key),datasets:[{label:'Incidencias',data:g.map(x=>x.count),backgroundColor:palette(g.length),borderColor:'rgba(255,255,255,.9)',borderWidth:2,hoverOffset:10}]},{plugins:{legend:{position:'right',labels:{boxWidth:14,usePointStyle:true}},tooltip:{callbacks:{label:c=>{const n=Number(c.raw||0),pct=totalInc?((n/totalInc)*100).toFixed(1):'0.0';return `${c.label}: ${n.toLocaleString('es-MX')} incidencias (${pct}%)`}}}}});chart('rubrosCountChart','bar',{labels:g.map(x=>x.key),datasets:[{label:'Número de incidencias',data:g.map(x=>x.count),backgroundColor:palette(g.length),borderRadius:8}]},{indexAxis:'y',plugins:{tooltip:{callbacks:{label:c=>`${Number(c.raw||0).toLocaleString('es-MX')} incidencias`}}}});$('#rubrosList').innerHTML=g.map(x=>{const esHonestidad=String(x.key||'').trim().toUpperCase()==='HONESTIDAD';return `<div class="entity"><b>${x.key}</b><span>${x.count.toLocaleString('es-MX')} incidencias</span>${esHonestidad?`<br><strong>${money(x.total)}</strong><small>Importe generado</small>`:'<br><strong>'+x.count.toLocaleString('es-MX')+'</strong><small>Número de incidencias</small>'}</div>`}).join('')||'<p>Sin datos</p>'}
function renderHonesty(){const h=honesty(filtered),ag=sorted(group(h,'_anomalia'),'count').slice(0,10),pl=sorted(group(h,'_ruta'),'count').slice(0,10),dr=sorted(group(h,'_conductor'),'count').slice(0,10);chart('honestyIncChart','bar',{labels:ag.map(x=>x.key),datasets:[{label:'Incidencias',data:ag.map(x=>x.count),backgroundColor:'#ef4444'}]},{indexAxis:'y',plugins:{tooltip:{callbacks:{label:c=>`${c.raw} incidencias`}}}});chart('honestyPlacesChart','bar',{labels:pl.map(x=>x.key),datasets:[{label:'Incidencias',data:pl.map(x=>x.count),backgroundColor:'#f59e0b'}]},{indexAxis:'y',plugins:{tooltip:{callbacks:{label:c=>`${c.raw} incidencias`}}}});renderRank('#honestyDrivers',dr,'conductor','count');const pg=periodByRubros(h,'_mes',12);chart('honestyTrendChart','line',{labels:pg.labels,datasets:[{label:'Importe Honestidad',data:pg.labels.map(l=>sum(h.filter(r=>r._mes===l))),borderColor:'#8b5cf6',backgroundColor:'#8b5cf622',fill:true,tension:.35}]})}
function renderRank(sel,data,type,mode='total'){const max=Math.max(...data.map(x=>x[mode]),1);$(sel).innerHTML=data.map((d,i)=>`<div class="rank-row" data-type="${type}" data-key="${d.key}"><b>${['🥇','🥈','🥉'][i]||'#'+(i+1)}</b><div><strong>${d.key}</strong><div class="bar"><i style="width:${d[mode]/max*100}%"></i></div><small>${d.count} registros</small></div><b>${mode==='count'?d.count:money(d.total)}</b></div>`).join('')||'<p>Sin datos</p>'}
function renderConductores(){const inc=filtered.filter(r=>r._clase==='INCIDENCIA'),byCount=sorted(group(inc,'_conductor'),'count').slice(0,10),byAmt=sorted(group(inc,'_conductor')).slice(0,10);renderRank('#driversRank',byCount,'conductor','count');renderRank('#driversAmountRank',byAmt,'conductor');$('#driversList').innerHTML=sorted(group(inc,'_conductor'),'count').slice(0,100).map(d=>`<div class="entity" data-type="conductor" data-key="${d.key}"><b>${d.key}</b><span>${d.count} incidencias</span><br><strong>${money(d.total)}</strong></div>`).join('')}
function renderCajeros(){const g=sorted(group(filtered.filter(r=>r._clase==='COBRO'),'_cajero')).slice(0,15);chart('cashiersChart','bar',{labels:g.map(x=>x.key),datasets:[{label:'Recuperado',data:g.map(x=>x.total),backgroundColor:'#10b981'}]},{indexAxis:'y'});renderRank('#cashiersList',g,'cajero')}
function renderRoutes(){const inc=filtered.filter(r=>r._clase==='INCIDENCIA'),cnt=sorted(group(inc,'_ruta'),'count').slice(0,12),amt=sorted(group(inc,'_ruta')).slice(0,12);chart('routesCountChart','bar',{labels:cnt.map(x=>x.key),datasets:[{label:'Incidencias',data:cnt.map(x=>x.count),backgroundColor:'#f59e0b'}]},{indexAxis:'y',plugins:{tooltip:{callbacks:{label:c=>`${c.raw} incidencias`}}}});chart('routesAmountChart','bar',{labels:amt.map(x=>x.key),datasets:[{label:'Importe',data:amt.map(x=>x.total),backgroundColor:'#8b5cf6'}]},{indexAxis:'y'})}
function renderTrends(){const inc=filtered.filter(r=>r._clase==='INCIDENCIA'),monthly=recoveryByPeriod(filtered,'_mes'),annual=recoveryByPeriod(filtered,'_anio');const mixed=(data)=>({labels:data.labels,datasets:[{label:'Generado en Honestidad',data:data.generated,backgroundColor:'#8b5cf6',borderRadius:7,yAxisID:'y'},{label:'Total recuperado',data:data.recovered,backgroundColor:'#10b981',borderRadius:7,yAxisID:'y'},{type:'line',label:'% recuperación general',data:data.percentage,borderColor:'#f59e0b',backgroundColor:'#f59e0b',tension:.3,yAxisID:'y1',pointRadius:4}]});const opts={plugins:{tooltip:{callbacks:{label:c=>c.dataset.yAxisID==='y1'?`${c.dataset.label}: ${Number(c.raw||0).toFixed(2)}%`:`${c.dataset.label}: ${money(c.raw)}`}}},scales:{y:{beginAtZero:true},y1:{beginAtZero:true,max:100,position:'right',grid:{drawOnChartArea:false},ticks:{callback:v=>v+'%'}}}};chart('monthlyRubrosChart','bar',mixed(monthly),opts);chart('annualRubrosChart','bar',mixed(annual),opts);const st=sorted(group(inc,'_estatus'),'count');chart('statusChart','doughnut',{labels:st.map(x=>x.key),datasets:[{data:st.map(x=>x.count),backgroundColor:palette(st.length),borderWidth:0,cutout:'62%'}]},{plugins:{tooltip:{callbacks:{label:c=>`${c.label}: ${c.raw} incidencias`}}}})}
function renderInsights(){const m=recoveryMetrics(filtered),hon=honesty(filtered),topCash=isAdmin()?sorted(group(m.cobrosCajeros,'_cajero'))[0]:null,topDriver=sorted(group(m.incidencias,'_conductor'),'count')[0],topHon=sorted(group(hon,'_anomalia'),'count')[0],topPlace=sorted(group(hon,'_ruta'),'count')[0],topRubro=sorted(group(m.incidencias,'_rubro'))[0];const lines=[`Se ha recuperado el <b>${m.porcentaje.toFixed(2)}%</b> del importe generado por Honestidad: ${money(m.totalRecuperado)} de ${money(m.generadoHonestidad)}.`,isAdmin()?`El total recuperado se obtiene de AVATRT y AVASUR para evitar duplicidades. Los registros TRT y SUR se usan exclusivamente para el ranking de cajeros; ahí se identifican ${money(m.recuperadoCajeros)} recuperados por ellos.`:`La recuperación total se obtiene de los registros AVA con estatus Cobrado.`,isAdmin()?(topCash?`El cajero con mayor recuperación es <b>${topCash.key}</b> con ${money(topCash.total)}.`:'No hay cobros de cajeros.'):null,`El saldo ejecutivo pendiente es <b>${money(m.pendiente)}</b>.`,topRubro?`El rubro con mayor importe es <b>${topRubro.key}</b> con ${money(topRubro.total)}.`:'No hay rubros.',topDriver?`El conductor con más incidencias es <b>${topDriver.key}</b> con ${topDriver.count} registros.`:'',topHon?`La incidencia de Honestidad más frecuente es <b>${topHon.key}</b> (${topHon.count}).`:'',topPlace?`El lugar con más incidencias de Honestidad es <b>${topPlace.key}</b> (${topPlace.count}).`:'' ];$('#insightsBox').innerHTML=lines.filter(Boolean).map(t=>`<div class="insight">${t}</div>`).join('')}
function reportColumns(){return isAdmin()?['_clase','_empresa','_rubro','_estatus','_fecha','_conductor','_cajero','_autobus','_folio','_anomalia','_ruta','_monto']:['_clase','_empresa','_rubro','_estatus','_fecha','_conductor','_autobus','_folio','_anomalia','_ruta','_monto']}
function renderTable(){const cols=reportColumns(),reportRows=filtered.filter(r=>r._clase==='INCIDENCIA');$('#dataTable thead').innerHTML='<tr>'+cols.map(c=>`<th>${c.slice(1)}</th>`).join('')+'</tr>';$('#dataTable tbody').innerHTML=reportRows.slice(0,800).map(r=>'<tr>'+cols.map(c=>`<td>${c==='_fecha'?(r._fecha?r._fecha.toLocaleDateString('es-MX'):''):c==='_monto'?money(r[c]):clean(r[c])}</td>`).join('')+'</tr>').join('')}
function openDetail(type,key){const rows=filtered.filter(r=>type==='conductor'?r._conductor===key:type==='cajero'?r._cajero===key:false);$('#detailContent').innerHTML=`<h2>${key}</h2><div class="kpi"><span>Total</span><b>${money(sum(rows))}</b><small>${rows.length} registros</small></div>`+rows.slice(0,100).map(r=>`<div class="alert"><b>${r._rubro}</b> · ${money(r._monto)}<br><small>${r._fecha?r._fecha.toLocaleDateString('es-MX'):''} · ${r._anomalia} · ${r._ruta}</small></div>`).join('');$('#detailPanel').classList.add('open')}
function exportCSV(){const reportRows=filtered.filter(r=>r._clase==='INCIDENCIA'),admin=isAdmin(),h=admin?['Clase','Empresa','Rubro','Estatus','Fecha','Conductor','Cajero','Autobus','Folio','Anomalia','Ruta','Monto']:['Clase','Empresa','Rubro','Estatus','Fecha','Conductor','Autobus','Folio','Anomalia','Ruta','Monto'],rows=reportRows.map(r=>admin?[r._clase,r._empresa,r._rubro,r._estatus,r._fecha?r._fecha.toLocaleDateString('es-MX'):'',r._conductor,r._cajero,r._autobus,r._folio,r._anomalia,r._ruta,r._monto]:[r._clase,r._empresa,r._rubro,r._estatus,r._fecha?r._fecha.toLocaleDateString('es-MX'):'',r._conductor,r._autobus,r._folio,r._anomalia,r._ruta,r._monto]),csv=[h,...rows].map(a=>a.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');download(new Blob([csv],{type:'text/csv'}),'reporte-cio-ava.csv')}
function exportExcel(){const data=filtered.filter(r=>r._clase==='INCIDENCIA').map(r=>{const x={Clase:r._clase,Empresa:r._empresa,Rubro:r._rubro,Estatus:r._estatus,Fecha:r._fecha?r._fecha.toLocaleDateString('es-MX'):'',Conductor:r._conductor,Autobus:r._autobus,Folio:r._folio,Anomalia:r._anomalia,Ruta:r._ruta,Monto:r._monto};if(isAdmin())x.Cajero=r._cajero;return x}),w=XLSX.utils.book_new();XLSX.utils.book_append_sheet(w,XLSX.utils.json_to_sheet(data),'AVA');XLSX.writeFile(w,'reporte-cio-ava.xlsx')}
async function exportPDF(){const m=recoveryMetrics(filtered),{jsPDF}=window.jspdf,canvas=await html2canvas($('#captureArea'),{scale:1.1,useCORS:true}),pdf=new jsPDF('p','mm','a4'),w=210,h=canvas.height*w/canvas.width;pdf.setFontSize(15);pdf.text('CIO AVA - Centro de Inteligencia Operativa AVA',14,12);pdf.setFontSize(9);pdf.text(`Recuperación general: ${m.porcentaje.toFixed(2)}% | Recuperado: ${money(m.totalRecuperado)} | Generado en Honestidad: ${money(m.generadoHonestidad)}`,14,17);pdf.addImage(canvas.toDataURL('image/png'),'PNG',0,22,w,h);pdf.save('reporte-cio-ava.pdf')}
function download(b,n){const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=n;a.click();URL.revokeObjectURL(a.href)}function toast(t){$('#toast').textContent=t;$('#toast').classList.add('show');setTimeout(()=>$('#toast').classList.remove('show'),2200)}
async function setup(){
  try{
    window.addEventListener('error',e=>{console.error('AVA runtime error:',e.error||e.message);hideSplash()});
    window.addEventListener('unhandledrejection',e=>{console.error('AVA promise error:',e.reason);hideSplash()});
    document.body.className=cfg.theme==='dark'?'dark':'light';
    if($('#cfgMeta')) $('#cfgMeta').value=cfg.meta;
    if($('#cfgUmbral')) $('#cfgUmbral').value=cfg.umbral;
    if($('#cfgRefresh')) $('#cfgRefresh').value=cfg.refresh;
    $$('.nav').forEach(b=>b.onclick=()=>{$$('.nav').forEach(x=>x.classList.remove('active'));b.classList.add('active');$$('.view').forEach(v=>v.classList.remove('active'));const target=$('#'+b.dataset.view);if(target)target.classList.add('active');if($('#pageTitle'))$('#pageTitle').textContent=b.textContent.trim().replace(/^[^A-Za-zÁÉÍÓÚÑ]+/,'')});
    ['#fEmpresa','#fRubro','#fEstatus','#fDesde','#fHasta','#fSearch'].forEach(sel=>{const el=$(sel);if(el)el.addEventListener('input',applyFilters)});
    on('#clearBtn','click',()=>{$('#fEmpresa').value='TODAS';$('#fRubro').value='TODOS';$('#fEstatus').value='TODOS';$('#fDesde').value='';$('#fHasta').value='';$('#fSearch').value='';applyFilters()});
    on('#themeBtn','click',()=>{document.body.classList.toggle('dark');document.body.classList.toggle('light');cfg.theme=document.body.classList.contains('dark')?'dark':'light';localStorage.setItem('avaCfg',JSON.stringify(cfg));if(raw.length)renderAll()});
    on('#refreshBtn','click',loadData);
    on('#saveCfg','click',()=>{cfg.meta=num($('#cfgMeta').value);cfg.umbral=num($('#cfgUmbral').value);cfg.refresh=num($('#cfgRefresh').value);localStorage.setItem('avaCfg',JSON.stringify(cfg));startTimer();if(raw.length)renderAll();toast('Configuración guardada')});
    on('#csvBtn','click',exportCSV);on('#excelBtn','click',exportExcel);on('#pdfBtn','click',exportPDF);on('#pdfBtn2','click',exportPDF);
    on('#closeDetail','click',()=>$('#detailPanel')?.classList.remove('open'));
    document.body.addEventListener('click',e=>{const x=e.target.closest('[data-type][data-key]');if(x)openDetail(x.dataset.type,x.dataset.key)});
    setTimeout(hideSplash,900);
    const authenticated=await initializeAuth();
    if(authenticated){startTimer();await loadData()}
    setTimeout(hideSplash,120);
  }catch(e){console.error('No se pudo iniciar AVA:',e);hideSplash();setSync('Error de inicio',false,true)}
}
function startTimer(){if(timer)clearInterval(timer);if(session?.token&&cfg.refresh>0)timer=setInterval(loadData,cfg.refresh)}
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',setup,{once:true})}else{setup()}

/* =========================================================
   AUTOBÚS DE AYUDA — asistente local basado en datos cargados
   ========================================================= */
function helpEscape(value){return String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function helpRows(){return filtered.length?filtered:raw}
function helpTopRows(rows,key,mode='total',limit=5){return sorted(group(rows,key),mode).filter(x=>x.key&& !String(x.key).startsWith('SIN ')).slice(0,limit)}
function helpAddMessage(role,html){const box=$('#helpChatMessages');if(!box)return;const item=document.createElement('div');item.className=`help-msg ${role}`;item.innerHTML=`<div class="help-bubble">${html}</div>`;box.appendChild(item);box.scrollTop=box.scrollHeight;return item}
function helpWelcome(){const box=$('#helpChatMessages');if(!box||box.children.length)return;helpAddMessage('bot',`¡Hola! Soy el <b>Asistente CIO AVA</b>. Puedo ayudarte a interpretar los indicadores y consultar los datos autorizados para tu cuenta.<br><br>Prueba con preguntas como:<ul class="help-answer-list"><li>¿Cuál es el total cobrado?</li>${isAdmin()?'<li>¿Quién es el cajero que más recuperó?</li>':''}<li>¿Qué conductor tiene más incidencias?</li><li>¿Dónde ocurre más Honestidad?</li></ul><div class="help-data-note">Trabajo con los filtros que estén activos.</div>`)}
function helpFormatRanking(items,mode='total',noun='registros'){if(!items.length)return 'No encontré datos para esa consulta con los filtros actuales.';return `<ol class="help-answer-list">${items.map(x=>`<li><b>${helpEscape(x.key)}</b> — ${mode==='total'?money(x.total):`${x.count.toLocaleString('es-MX')} ${noun}`}</li>`).join('')}</ol>`}
function helpSpecificEntity(q,rows){
  const search=lc(q.replace(/^(conductor|cajero|autobus|autobús|folio|ruta)\s*/i,''));
  if(search.length<2)return null;
  const matches=rows.filter(r=>lc([r._conductor,...(isAdmin()?[r._cajero]:[]),r._autobus,r._folio,r._ruta].join(' ')).includes(search));
  if(!matches.length)return null;
  const inc=matches.filter(r=>r._clase==='INCIDENCIA'),cob=matches.filter(r=>r._clase==='COBRO');
  const name=matches[0]._conductor!=='SIN CONDUCTOR'&&lc(matches[0]._conductor).includes(search)?matches[0]._conductor:isAdmin()&&matches[0]._cajero!=='SIN CAJERO'&&lc(matches[0]._cajero).includes(search)?matches[0]._cajero:matches[0]._autobus||matches[0]._folio||matches[0]._ruta;
  return `<b>${helpEscape(name)}</b><ul class="help-answer-list"><li>${matches.length.toLocaleString('es-MX')} registros encontrados</li><li>${inc.length.toLocaleString('es-MX')} incidencias por ${money(sum(inc))}</li><li>${cob.length.toLocaleString('es-MX')} cobros por ${money(sum(cob))}</li><li>Pendiente: ${money(sum(inc,'_pendiente'))}</li></ul>`;
}
function helpAnswer(question){
  const q=lc(question);if(!isAdmin()&&/(cajero|cajeros|cobrador|ranking de cobro)/.test(q))return 'Tu cuenta de tipo <b>USUARIO</b> no tiene autorización para consultar información de cajeros.';const rows=helpRows(),inc=rows.filter(r=>r._clase==='INCIDENCIA'),cobros=rows.filter(r=>r._clase==='COBRO'),hon=honesty(rows),otrasCobradas=inc.filter(r=>lc(r._estatus)==='cobrado');
  if(!rows.length)return 'Todavía no hay datos disponibles. Espera a que termine la carga o pulsa <b>Actualizar</b>.';
  const specific=helpSpecificEntity(q,rows);if(specific&&/(conductor|cajero|autobus|autobús|folio|ruta|buscar|consulta)/.test(q))return specific;
  if(/(hola|buenas|ayuda|que puedes|qué puedes|como funciona|cómo funciona)/.test(q))return `Puedo responder sobre <b>cobros, ${isAdmin()?'cajeros, ':''}conductores, Honestidad, rubros, rutas, estatus, autobuses y folios</b>. También puedo indicarte dónde encontrar cada módulo del portal.`;
  if(/(total cobrado|cuanto se ha cobrado|cuánto se ha cobrado|cobrado general)/.test(q)){const total=sum(otrasCobradas);return `El <b>total cobrado general</b> es ${money(total)}, tomado exclusivamente de AVATRT y AVASUR con estatus Cobrado para evitar duplicidades.<div class="help-data-note">TRT y SUR se utilizan solo para identificar y clasificar el desempeño de los cajeros.</div>`}
  if(/(recuperado por cajero|cobrado por cajero|recuperacion de cajeros|recuperación de cajeros)/.test(q))return `Los cajeros han recuperado <b>${money(sum(cobros))}</b> en ${cobros.length.toLocaleString('es-MX')} movimientos.`;
  if(/(top.*cajero|mejor cajero|cajero.*mas|cajero.*más|ranking.*cajero)/.test(q))return `<b>Top de cajeros por recuperación</b>${helpFormatRanking(helpTopRows(cobros,'_cajero','total',10),'total')}`;
  if(/(top.*conductor|conductor.*mas incidencia|conductor.*más incidencia|ranking.*conductor)/.test(q))return `<b>Conductores con más incidencias generales</b>${helpFormatRanking(helpTopRows(inc,'_conductor','count',10),'count','incidencias')}`;
  if(/(honestidad.*gener|generado.*honestidad|importe.*honestidad|cuanto.*honestidad|cuánto.*honestidad)/.test(q))return `Las incidencias de <b>Honestidad</b> generan ${money(sum(hon))} en ${hon.length.toLocaleString('es-MX')} registros.`;
  if(/(top.*honestidad|incidencia.*honestidad|honestidad.*frecuente)/.test(q))return `<b>Incidencias de Honestidad más frecuentes</b>${helpFormatRanking(helpTopRows(hon,'_anomalia','count',10),'count','incidencias')}`;
  if(/(donde.*honestidad|dónde.*honestidad|lugar.*honestidad|ruta.*honestidad)/.test(q))return `<b>Lugares o rutas con más incidencias de Honestidad</b>${helpFormatRanking(helpTopRows(hon,'_ruta','count',10),'count','incidencias')}`;
  if(/(pendiente|por cobrar|adeudo)/.test(q))return `El importe <b>pendiente por cobrar</b> es ${money(sum(inc,'_pendiente'))}, distribuido en ${inc.filter(r=>r._pendiente>0).length.toLocaleString('es-MX')} registros.`;
  if(/(porcentaje|%.*recuper|recuperacion|recuperación)/.test(q)){const m=recoveryMetrics(rows);return `La recuperación general es <b>${m.porcentaje.toFixed(2)}%</b>: ${money(m.totalRecuperado)} recuperados de ${money(m.generadoHonestidad)} generados en Honestidad.`}
  if(/(rubros|rubro)/.test(q)){const g=helpTopRows(inc,'_rubro','count',10);return `<b>Incidencias por rubro</b>${helpFormatRanking(g,'count','incidencias')}`}
  if(/(estatus|status|estado)/.test(q)){const g=helpTopRows(inc,'_estatus','count',10);return `<b>Distribución por estatus</b>${helpFormatRanking(g,'count','registros')}`}
  if(/(ruta|origen|destino|lugar)/.test(q)){const g=helpTopRows(inc,'_ruta','count',10);return `<b>Rutas con más incidencias</b>${helpFormatRanking(g,'count','incidencias')}`}
  if(/(otros rubros|diferentes.*honestidad|fuera.*honestidad)/.test(q)){const others=inc.filter(r=>lc(r._rubro)!=='honestidad');return `Hay <b>${others.length.toLocaleString('es-MX')}</b> incidencias en rubros distintos a Honestidad.`}
  if(/(resumen|panorama|situacion|situación)/.test(q)){const m=recoveryMetrics(rows),topCash=isAdmin()?helpTopRows(cobros,'_cajero','total',1)[0]:null,topDriver=helpTopRows(inc,'_conductor','count',1)[0],topPlace=helpTopRows(hon,'_ruta','count',1)[0];return `<b>Resumen del periodo filtrado</b><ul class="help-answer-list"><li>Recuperación general: ${m.porcentaje.toFixed(2)}%</li><li>Total cobrado: ${money(m.totalRecuperado)}</li><li>Generado en Honestidad: ${money(m.generadoHonestidad)}</li><li>Pendiente ejecutivo: ${money(m.pendiente)}</li>${topCash?`<li>Mejor cajero: ${helpEscape(topCash.key)} (${money(topCash.total)})</li>`:''}${topDriver?`<li>Conductor con más incidencias: ${helpEscape(topDriver.key)} (${topDriver.count})</li>`:''}${topPlace?`<li>Lugar con más Honestidad: ${helpEscape(topPlace.key)} (${topPlace.count})</li>`:''}</ul>`}
  if(/(modulo|módulo|donde veo|dónde veo|navegar)/.test(q))return `Usa la barra lateral: <b>Rubros</b> para distribución, <b>Honestidad</b> para sus tendencias, <b>Conductores</b> y <b>Cajeros</b> para rankings, <b>Rutas</b> para origen-destino, <b>Tendencias</b> para comparativos y <b>Reportes</b> para exportar.`;
  return `No identifiqué completamente la consulta. Puedes preguntar, por ejemplo: <b>“top cajeros”</b>, <b>“total cobrado”</b>, <b>“top conductores”</b>, <b>“lugares de Honestidad”</b>, <b>“incidencias por rubro”</b> o escribir el nombre de un conductor, cajero, autobús o folio.`;
}
function helpAsk(question){const text=clean(question);if(!text)return;helpAddMessage('user',helpEscape(text));const typing=helpAddMessage('bot','<span class="help-typing"><i></i><i></i><i></i></span>');setTimeout(()=>{typing?.remove();helpAddMessage('bot',helpAnswer(text))},320)}
function setupHelpChat(){
  const panel=$('#helpChat'),input=$('#helpChatInput');if(!panel)return;
  const open=()=>{panel.classList.add('open');panel.setAttribute('aria-hidden','false');helpWelcome();setTimeout(()=>input?.focus(),180)};
  const close=()=>{panel.classList.remove('open');panel.setAttribute('aria-hidden','true')};
  on('#helpBusBtn','click',()=>panel.classList.contains('open')?close():open());on('#helpChatClose','click',close);
  on('#helpChatForm','submit',e=>{e.preventDefault();helpAsk(input.value);input.value=''});
  $$('#helpSuggestions [data-question]').forEach(btn=>btn.addEventListener('click',()=>helpAsk(btn.dataset.question)));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&panel.classList.contains('open'))close()});
}
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',setupHelpChat,{once:true})}else{setupHelpChat()}


/* =========================================================
   CIO COPILOT 2.5 — análisis local, pronóstico y alertas
   No envía datos a servicios externos.
   ========================================================= */
function copilotMonthlySeries(rows){
  const inc=rows.filter(r=>r._clase==='INCIDENCIA'&&r._fecha);
  const months=[...new Set(inc.map(r=>r._mes).filter(x=>/^20\d{2}-\d{2}$/.test(x)))].sort();
  return months.map(m=>{
    const monthRows=inc.filter(r=>r._mes===m),hon=monthRows.filter(r=>lc(r._rubro)==='honestidad'),paid=monthRows.filter(r=>lc(r._estatus)==='cobrado');
    const generated=sum(hon),recovered=sum(paid),pct=generated?Math.min(100,recovered/generated*100):0;
    return{month:m,generated,recovered,pct,count:monthRows.length};
  });
}
function copilotLinearForecast(values){
  const ys=values.map(Number).filter(Number.isFinite);if(!ys.length)return{forecast:0,confidence:0,slope:0};if(ys.length===1)return{forecast:ys[0],confidence:35,slope:0};
  const n=ys.length,xMean=(n-1)/2,yMean=ys.reduce((a,b)=>a+b,0)/n;let nume=0,den=0;ys.forEach((y,x)=>{nume+=(x-xMean)*(y-yMean);den+=(x-xMean)**2});const slope=den?nume/den:0,intercept=yMean-slope*xMean,forecast=Math.max(0,intercept+slope*n);
  const predicted=ys.map((_,x)=>intercept+slope*x),ssRes=ys.reduce((a,y,i)=>a+(y-predicted[i])**2,0),ssTot=ys.reduce((a,y)=>a+(y-yMean)**2,0),r2=ssTot?Math.max(0,1-ssRes/ssTot):.5;
  return{forecast,confidence:Math.round(Math.max(35,Math.min(95,r2*100))),slope};
}
function copilotMetrics(){const rows=filtered.length?filtered:raw,m=recoveryMetrics(rows),months=copilotMonthlySeries(rows),forecast=copilotLinearForecast(months.map(x=>x.recovered));return{rows,m,months,forecast,hon:honesty(rows)}}
function copilotBuildInsights(){
  const {rows,m,months,forecast,hon}=copilotMetrics(),items=[];
  if(!rows.length)return[{type:'warning',html:'No hay datos cargados para analizar.'}];
  items.push({type:m.porcentaje>=95?'positive':m.porcentaje>=80?'warning':'critical',html:`La recuperación general es <b>${m.porcentaje.toFixed(2)}%</b>: ${money(m.totalRecuperado)} recuperados de ${money(m.generadoHonestidad)} generados en Honestidad.`});
  if(months.length>=2){const a=months.at(-2),b=months.at(-1),delta=a.recovered?(b.recovered-a.recovered)/a.recovered*100:0;items.push({type:delta>=0?'positive':'warning',html:`La recuperación del último mes ${delta>=0?'aumentó':'disminuyó'} <b>${Math.abs(delta).toFixed(1)}%</b> frente al mes anterior (${money(b.recovered)} vs ${money(a.recovered)}).`})}
  const topDriver=sorted(group(m.incidencias,'_conductor'),'count')[0],topRoute=sorted(group(hon,'_ruta'),'count')[0],topIssue=sorted(group(hon,'_anomalia'),'count')[0];
  if(topDriver)items.push({type:'warning',html:`<b>${helpEscape(topDriver.key)}</b> concentra la mayor cantidad de incidencias generales: ${topDriver.count.toLocaleString('es-MX')}.`});
  if(topRoute)items.push({type:'warning',html:`La ruta o lugar con más eventos de Honestidad es <b>${helpEscape(topRoute.key)}</b> con ${topRoute.count.toLocaleString('es-MX')} incidencias.`});
  if(topIssue)items.push({type:'warning',html:`La incidencia de Honestidad más frecuente es <b>${helpEscape(topIssue.key)}</b> (${topIssue.count.toLocaleString('es-MX')} casos).`});
  if(isAdmin()){const topCash=sorted(group(m.cobrosCajeros,'_cajero'))[0];if(topCash)items.push({type:'positive',html:`El cajero líder en recuperación es <b>${helpEscape(topCash.key)}</b> con ${money(topCash.total)}.`})}
  items.push({type:'positive',html:`El pronóstico estadístico para el siguiente periodo es <b>${money(forecast.forecast)}</b>, con confianza estimada de ${forecast.confidence}%.`});
  return items;
}
function copilotBuildAlerts(){
  const {m,hon,months}=copilotMetrics(),alerts=[],drivers=sorted(group(m.incidencias.filter(r=>r._pendiente>0),'_conductor')).filter(x=>x.total>=cfg.umbral).slice(0,5);
  drivers.forEach(x=>alerts.push({level:'high',icon:'⚠️',title:`Adeudo alto: ${x.key}`,detail:`Pendiente estimado de ${money(x.total)} (umbral ${money(cfg.umbral)}).`}));
  const routes=sorted(group(hon,'_ruta'),'count').slice(0,3);routes.forEach(x=>{if(x.count>=Math.max(10,Math.round(hon.length*.05)))alerts.push({level:'medium',icon:'📍',title:`Concentración de Honestidad`,detail:`${x.key}: ${x.count} incidencias.`})});
  if(months.length>=2&&months.at(-1).recovered<months.at(-2).recovered)alerts.push({level:'medium',icon:'📉',title:'Recuperación a la baja',detail:`El último mes quedó por debajo del anterior.`});
  if(m.porcentaje>=95)alerts.push({level:'ok',icon:'✅',title:'Recuperación favorable',detail:`El indicador general se encuentra en ${m.porcentaje.toFixed(2)}%.`});
  if(!alerts.length)alerts.push({level:'ok',icon:'✅',title:'Sin alertas críticas',detail:'No se detectaron condiciones relevantes con los filtros actuales.'});return alerts.slice(0,10);
}
function renderCopilot(){
  const summary=$('#copilotExecutiveSummary'),alerts=$('#copilotAlerts');if(!summary||!alerts)return;
  summary.innerHTML=copilotBuildInsights().map(x=>`<div class="copilot-insight ${x.type}">${x.html}</div>`).join('');
  alerts.innerHTML=copilotBuildAlerts().map(x=>`<div class="smart-alert ${x.level}"><i>${x.icon}</i><div><b>${helpEscape(x.title)}</b><small>${helpEscape(x.detail)}</small></div></div>`).join('');
  const {months,forecast}=copilotMetrics();$('#copilotForecastAmount').textContent=money(forecast.forecast);$('#copilotForecastLabel').textContent=forecast.slope>=0?'Tendencia proyectada al alza':'Tendencia proyectada a la baja';$('#copilotForecastConfidence').textContent=`Confianza estimada: ${forecast.confidence}%`;$('#copilotForecastBar').style.width=`${forecast.confidence}%`;
  chart('copilotForecastChart','line',{labels:months.map(x=>x.month),datasets:[{label:'Recuperado',data:months.map(x=>x.recovered),borderColor:'#7c3aed',backgroundColor:'rgba(124,58,237,.16)',fill:true,tension:.35},{label:'Pronóstico',data:months.length?[...Array(Math.max(0,months.length-1)).fill(null),months.at(-1).recovered,forecast.forecast]:[],borderColor:'#0ea5e9',borderDash:[7,5],pointRadius:3,tension:.3}]},{plugins:{tooltip:{callbacks:{label:c=>`${c.dataset.label}: ${money(c.raw)}`}}}});
}
function copilotExecutiveText(){const m=recoveryMetrics(filtered.length?filtered:raw),ins=copilotBuildInsights().map(x=>x.html.replace(/<[^>]+>/g,'')).join('\n• ');return `CIO AVA — Resumen Ejecutivo\n\n• ${ins}\n\nRecuperación general: ${m.porcentaje.toFixed(2)}%\nTotal recuperado: ${money(m.totalRecuperado)}\nGenerado en Honestidad: ${money(m.generadoHonestidad)}\nPendiente: ${money(m.pendiente)}`}
async function copilotSendEmail(){
  if(!isAdmin())return;const email=clean($('#copilotEmail').value),msg=$('#copilotEmailMessage');if(!/^\S+@\S+\.\S+$/.test(email)){msg.textContent='Ingresa un correo válido.';return}msg.textContent='Enviando…';
  try{const html=copilotExecutiveText().replace(/\n/g,'<br>');const j=await apiPost({accion:'enviar_resumen_ia',token:session.token,email,asunto:'CIO AVA - Resumen Ejecutivo',html});if(j.error)throw new Error(j.mensaje||'No se pudo enviar');msg.textContent='Resumen enviado correctamente.';toast('Correo enviado')}catch(e){msg.textContent=e.message||'No se pudo enviar el correo.'}
}
async function copilotEnableNotifications(){
  if(!('Notification'in window)){toast('Este navegador no admite notificaciones');return}const permission=await Notification.requestPermission();if(permission!=='granted'){toast('Permiso de notificaciones no concedido');return}const alerts=copilotBuildAlerts().filter(x=>x.level==='high');new Notification('CIO AVA',{body:alerts.length?`${alerts.length} alerta(s) crítica(s) detectada(s).`:'No hay alertas críticas.',icon:'assets/pwa/icon-192.png'});toast('Notificaciones activadas')
}
function setupCopilot(){
  on('#copilotAnalyzeBtn','click',()=>{renderCopilot();toast('Análisis actualizado')});on('#copilotPdfBtn','click',exportPDF);on('#copilotEmailBtn','click',copilotSendEmail);on('#copilotNotifyBtn','click',copilotEnableNotifications);
  on('#copilotQuestionForm','submit',e=>{e.preventDefault();const q=clean($('#copilotQuestion').value);$('#copilotAnswer').innerHTML=q?helpAnswer(q):'Escribe una pregunta para analizar.'});
  document.addEventListener('cioava:data-rendered',renderCopilot);
}
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',setupCopilot,{once:true})}else{setupCopilot()}
