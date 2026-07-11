/**
 * CIO AVA v1.0 — acceso, roles, administración y auditoría
 * Hoja requerida: USUARIOS
 * Columnas mínimas:
 * USUARIO | CONTRASEÑA | TIPO DE CUENTA | NOMBRE
 *
 * Columnas de auditoría creadas automáticamente:
 * ACTIVO | ULTIMO ACCESO | TOTAL ACCESOS | ULTIMO EQUIPO | FECHA CREACION
 */
const ID_SHEET = '1wD0bEDZznFkTmcvcRu1sGpHreataA5vpU0-ce2zVMlk';
const HOJA_USUARIOS = 'USUARIOS';
const HOJA_AUDITORIA = 'AUDITORIA';
const HOJAS_DATOS = ['TRT', 'SUR', 'AVATRT', 'AVASUR'];
const DURACION_SESION_SEGUNDOS = 21600; // 6 horas
const PREFIJO_SESION = 'CIO_AVA_SESSION_';
const COLUMNAS_USUARIO = [
  'USUARIO', 'CONTRASEÑA', 'TIPO DE CUENTA', 'NOMBRE',
  'ACTIVO', 'ULTIMO ACCESO', 'TOTAL ACCESOS', 'ULTIMO EQUIPO', 'FECHA CREACION'
];

function doGet(e) {
  e = e || { parameter: {} };
  const p = e.parameter || {};
  const accion = String(p.accion || 'inicio').toLowerCase();
  try {
    if (accion === 'inicio') return respuesta({ error: false, mensaje: 'API CIO AVA Enterprise 2.5 activa', autenticacion: true, administracionUsuarios: true });
    if (accion === 'usuarios') return listarUsuarios();
    if (accion === 'sesion') return validarSesionPublica(p.token);
    if (accion === 'datos') return obtenerDatosSeguro(p.hoja, p.token);
    if (accion === 'admin_usuarios') return listarUsuariosAdmin(p.token);
    if (accion === 'admin_auditoria') return listarAuditoriaAdmin(p.token, p.limite);
    return respuesta({ error: true, mensaje: 'Acción inválida' });
  } catch (error) {
    return respuesta({ error: true, mensaje: error.message || String(error) });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const accion = String(body.accion || '').toLowerCase();
    if (accion === 'login') return iniciarSesion(body.usuario, body.contrasena, body.equipo);
    if (accion === 'logout') return cerrarSesion(body.token);
    if (accion === 'admin_crear_usuario') return crearUsuarioAdmin(body);
    if (accion === 'admin_restaurar_contrasena') return restaurarContrasenaAdmin(body);
    if (accion === 'admin_cambiar_estado') return cambiarEstadoUsuarioAdmin(body);
    if (accion === 'auditoria') return registrarAuditoriaPublica(body);
    if (accion === 'enviar_resumen_ia') return enviarResumenIA_(body);
    return respuesta({ error: true, mensaje: 'Acción POST inválida' });
  } catch (error) {
    return respuesta({ error: true, mensaje: error.message || String(error) });
  }
}

function listarUsuarios() {
  const usuarios = leerUsuarios_()
    .filter(u => u.activo)
    .map(u => ({ usuario: u.usuario, nombre: u.nombre || u.usuario }))
    .filter(u => u.usuario);
  return respuesta({ error: false, usuarios: usuarios });
}

function iniciarSesion(usuario, contrasena, equipo) {
  usuario = normalizarTexto_(usuario).toUpperCase();
  contrasena = normalizarContrasena_(contrasena);
  equipo = limpiarEquipo_(equipo);
  if (!usuario || !contrasena) return respuesta({ autorizado: false, mensaje: 'Usuario y contraseña son obligatorios.' });

  const hoja = obtenerHojaUsuarios_();
  const estructura = obtenerEstructuraUsuarios_(hoja);
  const usuarios = leerUsuariosDesdeHoja_(hoja, estructura);
  const registro = usuarios.find(u => u.usuario === usuario);
  if (!registro || registro.contrasena !== contrasena) {
    Utilities.sleep(350);
    return respuesta({ autorizado: false, mensaje: 'Usuario o contraseña incorrectos.' });
  }
  if (!registro.activo) return respuesta({ autorizado: false, mensaje: 'La cuenta está desactivada. Contacta a un administrador.' });

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  let ultimoAcceso = registro.ultimoAcceso || null;
  let totalAccesos = Number(registro.totalAccesos || 0) + 1;
  const ahora = new Date();
  try {
    hoja.getRange(registro.fila, estructura.indices['ULTIMO ACCESO'] + 1).setValue(ahora);
    hoja.getRange(registro.fila, estructura.indices['TOTAL ACCESOS'] + 1).setValue(totalAccesos);
    hoja.getRange(registro.fila, estructura.indices['ULTIMO EQUIPO'] + 1).setValue(equipo || 'No disponible');
    if (!registro.fechaCreacion) hoja.getRange(registro.fila, estructura.indices['FECHA CREACION'] + 1).setValue(ahora);
  } finally {
    lock.releaseLock();
  }

  const rol = registro.rol === 'ADMINISTRADOR' ? 'ADMINISTRADOR' : 'USUARIO';
  const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  const ahoraMs = Date.now();
  const sesion = {
    usuario: usuario,
    nombre: registro.nombre || usuario,
    rol: rol,
    ultimoAcceso: ultimoAcceso ? new Date(ultimoAcceso).getTime() : null,
    totalAccesos: totalAccesos,
    equipo: equipo || 'No disponible',
    creada: ahoraMs,
    expira: ahoraMs + DURACION_SESION_SEGUNDOS * 1000
  };
  guardarSesion_(token, sesion);
  registrarAuditoria_(sesion, 'INICIO_SESION', 'ACCESO', 'Inicio de sesión correcto', equipo);
  return respuesta({
    autorizado: true,
    token: token,
    usuario: usuario,
    nombre: sesion.nombre,
    rol: rol,
    ultimoAcceso: sesion.ultimoAcceso,
    totalAccesos: totalAccesos,
    expira: sesion.expira
  });
}

function validarSesionPublica(token) {
  const sesion = obtenerSesion_(token);
  if (!sesion) return respuesta({ autorizado: false, codigo: 'SESION_INVALIDA', mensaje: 'La sesión no existe o expiró.' });
  return respuesta({ autorizado: true, usuario: sesion.usuario, nombre: sesion.nombre || sesion.usuario, rol: sesion.rol, ultimoAcceso: sesion.ultimoAcceso || null, totalAccesos: sesion.totalAccesos || 0, expira: sesion.expira });
}

function cerrarSesion(token) {
  const sesion = obtenerSesion_(token);
  if (sesion) registrarAuditoria_(sesion, 'CIERRE_SESION', 'ACCESO', 'Cierre de sesión', sesion.equipo || '');
  if (token) eliminarSesion_(String(token));
  return respuesta({ error: false, mensaje: 'Sesión cerrada.' });
}

function listarUsuariosAdmin(token) {
  exigirAdministrador_(token);
  const usuarios = leerUsuarios_().map(u => ({
    usuario: u.usuario,
    nombre: u.nombre || u.usuario,
    rol: u.rol,
    activo: u.activo,
    ultimoAcceso: serializarFecha_(u.ultimoAcceso),
    totalAccesos: Number(u.totalAccesos || 0),
    ultimoEquipo: u.ultimoEquipo || 'No disponible',
    fechaCreacion: serializarFecha_(u.fechaCreacion)
  }));
  return respuesta({ error: false, usuarios: usuarios });
}

function crearUsuarioAdmin(body) {
  exigirAdministrador_(body.token);
  const usuario = normalizarTexto_(body.usuario).toUpperCase();
  const nombre = normalizarTexto_(body.nombre).replace(/\s+/g, ' ');
  const contrasena = normalizarContrasena_(body.contrasena);
  const rol = normalizarTexto_(body.rol).toUpperCase() === 'ADMINISTRADOR' ? 'ADMINISTRADOR' : 'USUARIO';
  if (!usuario || !nombre || !contrasena) return respuesta({ error: true, mensaje: 'Usuario, nombre y contraseña son obligatorios.' });
  if (contrasena.length < 4) return respuesta({ error: true, mensaje: 'La contraseña debe tener al menos 4 caracteres.' });

  const hoja = obtenerHojaUsuarios_();
  const estructura = obtenerEstructuraUsuarios_(hoja);
  const existentes = leerUsuariosDesdeHoja_(hoja, estructura);
  if (existentes.some(u => u.usuario === usuario)) return respuesta({ error: true, mensaje: 'Ya existe un usuario con ese identificador.' });

  const fila = new Array(estructura.headers.length).fill('');
  fila[estructura.indices['USUARIO']] = usuario;
  fila[estructura.indices['CONTRASENA']] = contrasena;
  fila[estructura.indices['TIPO DE CUENTA']] = rol;
  fila[estructura.indices['NOMBRE']] = nombre;
  fila[estructura.indices['ACTIVO']] = 'SI';
  fila[estructura.indices['TOTAL ACCESOS']] = 0;
  fila[estructura.indices['FECHA CREACION']] = new Date();
  hoja.appendRow(fila);
  const sesion = obtenerSesion_(body.token);
  registrarAuditoria_(sesion, 'CREAR_USUARIO', 'ADMINISTRACION', 'Creó la cuenta ' + usuario + ' (' + rol + ')', sesion ? sesion.equipo : '');
  return respuesta({ error: false, mensaje: 'Usuario creado correctamente.' });
}

function restaurarContrasenaAdmin(body) {
  const sesion = exigirAdministrador_(body.token);
  const usuario = normalizarTexto_(body.usuario).toUpperCase();
  const nueva = normalizarContrasena_(body.nuevaContrasena);
  if (!usuario || !nueva) return respuesta({ error: true, mensaje: 'Usuario y nueva contraseña son obligatorios.' });
  if (nueva.length < 4) return respuesta({ error: true, mensaje: 'La contraseña debe tener al menos 4 caracteres.' });
  const ctx = localizarUsuario_(usuario);
  if (!ctx.registro) return respuesta({ error: true, mensaje: 'No se encontró el usuario.' });
  ctx.hoja.getRange(ctx.registro.fila, ctx.estructura.indices['CONTRASEÑA'] + 1).setValue(nueva);
  cerrarSesionesDeUsuario_(usuario, sesion.usuario === usuario ? body.token : null);
  registrarAuditoria_(sesion, 'CAMBIAR_CONTRASENA', 'ADMINISTRACION', 'Restableció la contraseña de ' + usuario, sesion.equipo || '');
  return respuesta({ error: false, mensaje: 'Contraseña restablecida correctamente.' });
}

function cambiarEstadoUsuarioAdmin(body) {
  const sesion = exigirAdministrador_(body.token);
  const usuario = normalizarTexto_(body.usuario).toUpperCase();
  const activo = body.activo === true || String(body.activo).toUpperCase() === 'SI' || String(body.activo).toLowerCase() === 'true';
  if (!usuario) return respuesta({ error: true, mensaje: 'Usuario obligatorio.' });
  if (usuario === sesion.usuario && !activo) return respuesta({ error: true, mensaje: 'No puedes desactivar tu propia cuenta mientras la estás usando.' });
  const ctx = localizarUsuario_(usuario);
  if (!ctx.registro) return respuesta({ error: true, mensaje: 'No se encontró el usuario.' });
  ctx.hoja.getRange(ctx.registro.fila, ctx.estructura.indices['ACTIVO'] + 1).setValue(activo ? 'SI' : 'NO');
  if (!activo) cerrarSesionesDeUsuario_(usuario, null);
  registrarAuditoria_(sesion, 'CAMBIAR_ESTADO', 'ADMINISTRACION', (activo ? 'Activó' : 'Desactivó') + ' la cuenta ' + usuario, sesion.equipo || '');
  return respuesta({ error: false, mensaje: activo ? 'Usuario activado.' : 'Usuario desactivado.' });
}



function enviarResumenIA_(body) {
  const sesion = exigirAdministrador_(body.token);
  const email = normalizarTexto_(body.email);
  const asunto = normalizarTexto_(body.asunto || 'CIO AVA - Resumen Ejecutivo');
  const html = String(body.html || '');
  if (!/^\S+@\S+\.\S+$/.test(email)) return respuesta({ error: true, mensaje: 'Correo no válido.' });
  if (!html) return respuesta({ error: true, mensaje: 'El resumen está vacío.' });
  MailApp.sendEmail({
    to: email,
    subject: asunto,
    htmlBody: '<div style="font-family:Arial,sans-serif;line-height:1.55"><h2 style="color:#5b21b6">CIO AVA</h2><p><b>Centro de Inteligencia Operativa AVA</b></p><hr>' + html + '<hr><small>Gerencia Regional de Recaudación VHT · Mobility ADO</small></div>',
    name: 'CIO AVA'
  });
  registrarAuditoria_(sesion, 'ENVIO_RESUMEN_IA', 'CIO_COPILOT', 'Envió resumen ejecutivo a ' + email, sesion.equipo || '');
  return respuesta({ error: false, mensaje: 'Resumen enviado.' });
}

function registrarAuditoriaPublica(body) {
  const sesion = obtenerSesion_(body.token);
  if (!sesion) return respuesta({ error: true, codigo: 'SESION_INVALIDA', mensaje: 'La sesión no existe o expiró.' });
  const accion = normalizarClave_(body.evento || body.tipo || 'ACTIVIDAD').slice(0, 60);
  const modulo = normalizarTexto_(body.modulo || 'SISTEMA').slice(0, 80);
  const detalle = normalizarTexto_(body.detalle || '').slice(0, 500);
  registrarAuditoria_(sesion, accion, modulo, detalle, limpiarEquipo_(body.equipo || sesion.equipo));
  return respuesta({ error: false });
}

function listarAuditoriaAdmin(token, limite) {
  exigirAdministrador_(token);
  const hoja = obtenerHojaAuditoria_();
  const valores = hoja.getDataRange().getValues();
  const max = Math.min(Math.max(Number(limite || 500), 1), 2000);
  if (valores.length < 2) return respuesta({ error: false, registros: [] });
  const rows = valores.slice(1).filter(r => r.some(v => v !== '' && v !== null)).slice(-max).reverse();
  const registros = rows.map(r => ({
    fecha: serializarFecha_(r[0]), usuario: normalizarTexto_(r[1]), nombre: normalizarTexto_(r[2]),
    rol: normalizarTexto_(r[3]), accion: normalizarTexto_(r[4]), modulo: normalizarTexto_(r[5]),
    detalle: normalizarTexto_(r[6]), equipo: normalizarTexto_(r[7])
  }));
  return respuesta({ error: false, registros: registros });
}

function registrarAuditoria_(sesion, accion, modulo, detalle, equipo) {
  if (!sesion) return;
  try {
    const hoja = obtenerHojaAuditoria_();
    hoja.appendRow([new Date(), sesion.usuario || '', sesion.nombre || '', sesion.rol || '', accion || '', modulo || '', detalle || '', limpiarEquipo_(equipo || sesion.equipo || '')]);
  } catch (e) { console.error('Auditoría:', e); }
}

function obtenerHojaAuditoria_() {
  const ss = SpreadsheetApp.openById(ID_SHEET);
  let hoja = ss.getSheetByName(HOJA_AUDITORIA);
  if (!hoja) hoja = ss.insertSheet(HOJA_AUDITORIA);
  const headers = ['FECHA','USUARIO','NOMBRE','ROL','ACCION','MODULO','DETALLE','EQUIPO'];
  if (hoja.getLastRow() === 0) hoja.getRange(1,1,1,headers.length).setValues([headers]);
  else {
    const current = hoja.getRange(1,1,1,Math.max(hoja.getLastColumn(),headers.length)).getValues()[0];
    headers.forEach((h,i)=>{ if (normalizarClave_(current[i]) !== h) hoja.getRange(1,i+1).setValue(h); });
  }
  hoja.getRange(1,1,1,headers.length).setFontWeight('bold');
  return hoja;
}

function obtenerDatosSeguro(nombreHoja, token) {
  const sesion = obtenerSesion_(token);
  if (!sesion) return respuesta({ error: true, autorizado: false, codigo: 'SESION_INVALIDA', mensaje: 'Inicia sesión nuevamente.' });
  nombreHoja = normalizarTexto_(nombreHoja);
  if (HOJAS_DATOS.indexOf(nombreHoja) === -1) return respuesta({ error: true, codigo: 'HOJA_NO_PERMITIDA', mensaje: 'La hoja solicitada no está permitida.' });

  const ss = SpreadsheetApp.openById(ID_SHEET);
  const hoja = ss.getSheetByName(nombreHoja);
  if (!hoja) return respuesta({ error: true, mensaje: 'No existe la hoja: ' + nombreHoja });
  const valores = hoja.getDataRange().getValues();
  if (valores.length < 2) return respuesta({ error: false, hoja: nombreHoja, rol: sesion.rol, datos: [] });
  const encabezados = valores[0].map(h => normalizarTexto_(h));
  const datos = [];
  for (let i = 1; i < valores.length; i++) {
    const fila = valores[i];
    if (fila.every(v => v === '' || v === null)) continue;
    const obj = {};
    encabezados.forEach((h, c) => { if (h) obj[h] = serializarValor_(fila[c]); });
    datos.push(sesion.rol === 'ADMINISTRADOR' ? obj : ocultarCajeros_(obj));
  }
  return respuesta({ error: false, autorizado: true, hoja: nombreHoja, rol: sesion.rol, datos: datos });
}

function obtenerHojaUsuarios_() {
  const hoja = SpreadsheetApp.openById(ID_SHEET).getSheetByName(HOJA_USUARIOS);
  if (!hoja) throw new Error('No existe la pestaña ' + HOJA_USUARIOS + '.');
  asegurarColumnasUsuarios_(hoja);
  return hoja;
}

function asegurarColumnasUsuarios_(hoja) {
  const lastCol = Math.max(hoja.getLastColumn(), 1);
  const existentes = hoja.getRange(1, 1, 1, lastCol).getValues()[0].map(normalizarClave_);
  COLUMNAS_USUARIO.forEach(nombre => {
    if (existentes.indexOf(normalizarClave_(nombre)) < 0) {
      hoja.getRange(1, hoja.getLastColumn() + 1).setValue(nombre);
      existentes.push(normalizarClave_(nombre));
    }
  });
  hoja.getRange(1, 1, 1, hoja.getLastColumn()).setFontWeight('bold');
}

function obtenerEstructuraUsuarios_(hoja) {
  asegurarColumnasUsuarios_(hoja);
  const headersOriginales = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
  const headers = headersOriginales.map(normalizarClave_);
  const indices = {};
  COLUMNAS_USUARIO.forEach(c => { indices[c] = headers.indexOf(normalizarClave_(c)); });
  if (indices['USUARIO'] < 0 || indices['CONTRASEÑA'] < 0 || indices['TIPO DE CUENTA'] < 0) throw new Error('USUARIOS debe contener USUARIO, CONTRASEÑA y TIPO DE CUENTA.');
  return { headers: headersOriginales, indices: indices };
}

function leerUsuarios_() {
  const hoja = obtenerHojaUsuarios_();
  return leerUsuariosDesdeHoja_(hoja, obtenerEstructuraUsuarios_(hoja));
}

function leerUsuariosDesdeHoja_(hoja, estructura) {
  const valores = hoja.getDataRange().getValues();
  if (valores.length < 2) return [];
  const i = estructura.indices;
  return valores.slice(1).map((f, idx) => ({
    fila: idx + 2,
    usuario: normalizarTexto_(f[i['USUARIO']]).toUpperCase(),
    contrasena: normalizarContrasena_(f[i['CONTRASEÑA']]),
    rol: normalizarTexto_(f[i['TIPO DE CUENTA']]).toUpperCase() === 'ADMINISTRADOR' ? 'ADMINISTRADOR' : 'USUARIO',
    nombre: i['NOMBRE'] >= 0 ? normalizarTexto_(f[i['NOMBRE']]).replace(/\s+/g, ' ') : '',
    activo: valorActivo_(i['ACTIVO'] >= 0 ? f[i['ACTIVO']] : ''),
    ultimoAcceso: i['ULTIMO ACCESO'] >= 0 ? f[i['ULTIMO ACCESO']] : null,
    totalAccesos: i['TOTAL ACCESOS'] >= 0 ? Number(f[i['TOTAL ACCESOS']] || 0) : 0,
    ultimoEquipo: i['ULTIMO EQUIPO'] >= 0 ? normalizarTexto_(f[i['ULTIMO EQUIPO']]) : '',
    fechaCreacion: i['FECHA CREACION'] >= 0 ? f[i['FECHA CREACION']] : null
  })).filter(u => u.usuario && u.contrasena);
}

function localizarUsuario_(usuario) {
  const hoja = obtenerHojaUsuarios_();
  const estructura = obtenerEstructuraUsuarios_(hoja);
  const registro = leerUsuariosDesdeHoja_(hoja, estructura).find(u => u.usuario === usuario);
  return { hoja: hoja, estructura: estructura, registro: registro };
}

function exigirAdministrador_(token) {
  const sesion = obtenerSesion_(token);
  if (!sesion) throw new Error('La sesión no existe o expiró.');
  if (sesion.rol !== 'ADMINISTRADOR') throw new Error('Esta acción requiere una cuenta de administrador.');
  return sesion;
}

function cerrarSesionesDeUsuario_(usuario, tokenConservar) {
  const props = PropertiesService.getScriptProperties();
  const all = props.getProperties();
  Object.keys(all).forEach(k => {
    if (k.indexOf(PREFIJO_SESION) !== 0) return;
    if (tokenConservar && k === PREFIJO_SESION + tokenConservar) return;
    try {
      const sesion = JSON.parse(all[k]);
      if (sesion.usuario === usuario) props.deleteProperty(k);
    } catch (_) {}
  });
}

function guardarSesion_(token, sesion) {
  const props = PropertiesService.getScriptProperties();
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try { props.setProperty(PREFIJO_SESION + token, JSON.stringify(sesion)); }
  finally { lock.releaseLock(); }
}
function eliminarSesion_(token) { PropertiesService.getScriptProperties().deleteProperty(PREFIJO_SESION + token); }
function obtenerSesion_(token) {
  token = String(token || '').trim();
  if (!token || token.length < 30) return null;
  const props = PropertiesService.getScriptProperties();
  const clave = PREFIJO_SESION + token;
  const raw = props.getProperty(clave);
  if (!raw) return null;
  try {
    const sesion = JSON.parse(raw);
    if (!sesion.expira || Date.now() > sesion.expira) { props.deleteProperty(clave); return null; }
    return sesion;
  } catch (_) { props.deleteProperty(clave); return null; }
}

function ocultarCajeros_(obj) {
  const limpio = {};
  Object.keys(obj).forEach(k => {
    const clave = normalizarClave_(k);
    if (clave.indexOf('CAJERO') >= 0 || clave.indexOf('COBRADOR') >= 0) return;
    limpio[k] = obj[k];
  });
  return limpio;
}
function serializarValor_(valor) { return valor instanceof Date ? Utilities.formatDate(valor, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss') : valor; }
function serializarFecha_(valor) {
  if (!valor) return null;
  const d = valor instanceof Date ? valor : new Date(valor);
  return isNaN(d.getTime()) ? null : Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
}
function valorActivo_(valor) {
  const s = normalizarClave_(valor);
  if (!s) return true; // compatibilidad con filas existentes
  return ['SI', 'S', 'TRUE', 'VERDADERO', '1', 'ACTIVO'].indexOf(s) >= 0;
}
function limpiarEquipo_(equipo) { return normalizarTexto_(equipo).replace(/[\r\n\t]+/g, ' ').slice(0, 500); }
function normalizarTexto_(valor) { return valor === null || valor === undefined ? '' : String(valor).trim(); }
function normalizarContrasena_(valor) {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'number' && Math.floor(valor) === valor) return String(valor);
  return String(valor).trim().replace(/\.0$/, '');
}
function normalizarClave_(valor) { return normalizarTexto_(valor).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase(); }
function respuesta(data) { return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON); }
