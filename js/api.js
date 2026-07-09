const API_URL = 'https://script.google.com/macros/s/AKfycbxpX9FNMZZDL72L76vS4keCiWC3xPb79_cMkpcBk0_AqktKHizk7j5A6r53brRN9y9d/exec';
const HOJAS = [
  { nombre:'TRT', empresa:'TRT', tipo:'COBRADO' },
  { nombre:'SUR', empresa:'SUR', tipo:'COBRADO' },
  { nombre:'AVATRT', empresa:'TRT', tipo:'ADEUDO' },
  { nombre:'AVASUR', empresa:'SUR', tipo:'ADEUDO' }
];
async function apiDatos(hoja){
  const url = `${API_URL}?accion=datos&hoja=${encodeURIComponent(hoja)}`;
  const res = await fetch(url, { cache:'no-store' });
  if(!res.ok) throw new Error(`HTTP ${res.status} en ${hoja}`);
  const json = await res.json();
  if(json.error) throw new Error(json.mensaje || `Error en ${hoja}`);
  return json.datos || [];
}
async function cargarTodo(){
  const resultados = await Promise.allSettled(HOJAS.map(async h=>{
    const datos = await apiDatos(h.nombre);
    return datos.map(r=>normalizarRegistro(r,h));
  }));
  const errores = resultados.filter(r=>r.status==='rejected').map(r=>r.reason.message);
  const data = resultados.filter(r=>r.status==='fulfilled').flatMap(r=>r.value);
  return { data, errores };
}
function normalizarRegistro(r, meta){
  const cajero = meta.tipo === 'ADEUDO'
    ? pick(r, ['Preceptor','Analista','Nombre Cajero','Cajero','Cajero Cobro','Usuario Cajero','Nombre del Cajero'])
    : pick(r, ['Nombre Cajero','Cajero','Cajero Cobro','Usuario Cajero','Nombre del Cajero']);
  const conductor = pick(r, ['Conductor','Nombre Conductor','Operador','Nombre Operador']);
  const fecha = meta.tipo === 'ADEUDO'
    ? pick(r, ['Fecha Corrida','Fecha del Viaje','Fecha Viaje','Fecha','Fecha Cobro','Fecha de Viaje','Fecha Recepción Reporte'])
    : pick(r, ['Fecha del Viaje','Fecha Viaje','Fecha','Fecha Cobro','Fecha de Viaje']);
  const viaje = pick(r, ['Viaje','Id Viaje','ID Viaje','No Viaje','Número de Viaje','Num Viaje','Folio','Reporte']);
  const montoRaw = meta.tipo === 'ADEUDO'
    ? pick(r, ['Por Cobrar','Monto Adeudo','Adeudo','Saldo','Costo','Monto','Importe','Total'])
    : pick(r, ['Monto Recuperado','Monto Cobrado','Monto','Importe','Total','Por Cobrar']);
  return {
    raw:r,
    tipo:meta.tipo,
    empresa:meta.empresa,
    hoja:meta.nombre,
    cajero:clean(cajero) || 'SIN CAJERO',
    conductor:clean(conductor) || 'SIN CONDUCTOR',
    fecha:normalizarFecha(fecha),
    viaje:clean(viaje) || '',
    monto:parseMoney(montoRaw),
    estatus: clean(pick(r, ['Estatus','Status','Estado'])) || ''
  };
}
function pick(obj, names){
  for(const n of names){ if(obj[n] !== undefined && obj[n] !== null && String(obj[n]).trim() !== '') return obj[n]; }
  const keys = Object.keys(obj || {});
  for(const n of names){
    const nk = norm(n); const k = keys.find(x=>norm(x)===nk || norm(x).includes(nk) || nk.includes(norm(x)));
    if(k && obj[k] !== undefined && String(obj[k]).trim() !== '') return obj[k];
  }
  return '';
}
function norm(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');}
function clean(v){return String(v ?? '').trim();}
function parseMoney(v){
  if(typeof v === 'number') return isFinite(v)?v:0;
  let s = String(v ?? '')
    .replace(/\$/g,'')
    .replace(/,/g,'')
    .replace(/%/g,'')
    .replace(/\s/g,'')
    .replace(/[()]/g,'-');
  const n = Number(s); return isFinite(n)?Math.abs(n):0;
}
function normalizarFecha(v){
  if(!v) return '';
  if(v instanceof Date) return v.toISOString().slice(0,10);
  const s = String(v).trim();
  const d = new Date(s); if(!isNaN(d)) return d.toISOString().slice(0,10);
  const m = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if(m){ const y = m[3].length===2 ? '20'+m[3] : m[3]; return `${y}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`; }
  return s.slice(0,10);
}
