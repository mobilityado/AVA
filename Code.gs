/**
 * CIO AVA v44 — API con nombre, bienvenida y roles
 * Hoja requerida: USUARIOS
 * Columnas: USUARIO | CONTRASEÑA | TIPO DE CUENTA | NOMBRE
 */
const ID_SHEET = '1wD0bEDZznFkTmcvcRu1sGpHreataA5vpU0-ce2zVMlk';
const HOJA_USUARIOS = 'USUARIOS';
const HOJAS_DATOS = ['TRT', 'SUR', 'AVATRT', 'AVASUR'];
const DURACION_SESION_SEGUNDOS = 21600; // 6 horas
const PREFIJO_SESION = 'CIO_AVA_SESSION_';

function doGet(e) {
  e = e || { parameter: {} };
  const p = e.parameter || {};
  const accion = String(p.accion || 'inicio').toLowerCase();
  try {
    if (accion === 'inicio') return respuesta({ error: false, mensaje: 'API CIO AVA v44 activa', autenticacion: true });
    if (accion === 'usuarios') return listarUsuarios();
    if (accion === 'sesion') return validarSesionPublica(p.token);
    if (accion === 'datos') return obtenerDatosSeguro(p.hoja, p.token);
    return respuesta({ error: true, mensaje: 'Acción inválida' });
  } catch (error) {
    return respuesta({ error: true, mensaje: error.message || String(error) });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const accion = String(body.accion || '').toLowerCase();
    if (accion === 'login') return iniciarSesion(body.usuario, body.contrasena);
    if (accion === 'logout') return cerrarSesion(body.token);
    return respuesta({ error: true, mensaje: 'Acción POST inválida' });
  } catch (error) {
    return respuesta({ error: true, mensaje: error.message || String(error) });
  }
}

function listarUsuarios() {
  const usuarios = leerUsuarios_().map(u => ({ usuario: u.usuario, nombre: u.nombre || u.usuario })).filter(u => u.usuario);
  return respuesta({ error: false, usuarios: usuarios });
}

function iniciarSesion(usuario, contrasena) {
  usuario = normalizarTexto_(usuario).toUpperCase();
  contrasena = normalizarContrasena_(contrasena);
  if (!usuario || !contrasena) return respuesta({ autorizado: false, mensaje: 'Usuario y contraseña son obligatorios.' });

  const registro = leerUsuarios_().find(u => u.usuario === usuario);
  if (!registro || registro.contrasena !== contrasena) {
    Utilities.sleep(350);
    return respuesta({ autorizado: false, mensaje: 'Usuario o contraseña incorrectos.' });
  }

  const rol = registro.rol === 'ADMINISTRADOR' ? 'ADMINISTRADOR' : 'USUARIO';
  const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  const ahora = Date.now();
  const props = PropertiesService.getScriptProperties();
  const claveUltimo = 'CIO_AVA_LAST_' + usuario;
  const ultimoAcceso = Number(props.getProperty(claveUltimo) || 0) || null;
  props.setProperty(claveUltimo, String(ahora));
  const sesion = {
    usuario: usuario,
    nombre: registro.nombre || usuario,
    rol: rol,
    ultimoAcceso: ultimoAcceso,
    creada: ahora,
    expira: ahora + DURACION_SESION_SEGUNDOS * 1000
  };
  CacheService.getScriptCache().put(PREFIJO_SESION + token, JSON.stringify(sesion), DURACION_SESION_SEGUNDOS);
  return respuesta({
    autorizado: true,
    token: token,
    usuario: usuario,
    nombre: sesion.nombre,
    rol: rol,
    ultimoAcceso: ultimoAcceso,
    expira: sesion.expira
  });
}

function validarSesionPublica(token) {
  const sesion = obtenerSesion_(token);
  if (!sesion) return respuesta({ autorizado: false, codigo: 'SESION_INVALIDA', mensaje: 'La sesión no existe o expiró.' });
  return respuesta({ autorizado: true, usuario: sesion.usuario, nombre: sesion.nombre || sesion.usuario, rol: sesion.rol, ultimoAcceso: sesion.ultimoAcceso || null, expira: sesion.expira });
}

function cerrarSesion(token) {
  if (token) CacheService.getScriptCache().remove(PREFIJO_SESION + String(token));
  return respuesta({ error: false, mensaje: 'Sesión cerrada.' });
}

function obtenerDatosSeguro(nombreHoja, token) {
  const sesion = obtenerSesion_(token);
  if (!sesion) return respuesta({ error: true, autorizado: false, codigo: 'SESION_INVALIDA', mensaje: 'Inicia sesión nuevamente.' });

  nombreHoja = normalizarTexto_(nombreHoja);
  if (HOJAS_DATOS.indexOf(nombreHoja) === -1) {
    return respuesta({ error: true, codigo: 'HOJA_NO_PERMITIDA', mensaje: 'La hoja solicitada no está permitida.' });
  }

  const ss = SpreadsheetApp.openById(ID_SHEET);
  const hoja = ss.getSheetByName(nombreHoja);
  if (!hoja) return respuesta({ error: true, mensaje: 'No existe la hoja: ' + nombreHoja });

  const rango = hoja.getDataRange();
  const valores = rango.getValues();
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

function leerUsuarios_() {
  const hoja = SpreadsheetApp.openById(ID_SHEET).getSheetByName(HOJA_USUARIOS);
  if (!hoja) throw new Error('No existe la pestaña ' + HOJA_USUARIOS + '.');
  const valores = hoja.getDataRange().getValues();
  if (valores.length < 2) return [];
  const headers = valores[0].map(h => normalizarClave_(h));
  const iu = headers.indexOf('USUARIO');
  const ip = headers.indexOf('CONTRASENA');
  const ir = headers.indexOf('TIPO DE CUENTA');
  const inombre = headers.indexOf('NOMBRE');
  if (iu < 0 || ip < 0 || ir < 0) throw new Error('USUARIOS debe contener USUARIO, CONTRASEÑA y TIPO DE CUENTA.');

  return valores.slice(1).map(f => ({
    usuario: normalizarTexto_(f[iu]).toUpperCase(),
    contrasena: normalizarContrasena_(f[ip]),
    rol: normalizarTexto_(f[ir]).toUpperCase(),
    nombre: inombre >= 0 ? normalizarTexto_(f[inombre]).replace(/\s+/g, ' ') : ''
  })).filter(u => u.usuario && u.contrasena);
}

function obtenerSesion_(token) {
  token = String(token || '').trim();
  if (!token || token.length < 30) return null;
  const raw = CacheService.getScriptCache().get(PREFIJO_SESION + token);
  if (!raw) return null;
  try {
    const sesion = JSON.parse(raw);
    if (!sesion.expira || Date.now() > sesion.expira) {
      CacheService.getScriptCache().remove(PREFIJO_SESION + token);
      return null;
    }
    return sesion;
  } catch (_) { return null; }
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

function serializarValor_(valor) {
  if (valor instanceof Date) return Utilities.formatDate(valor, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  return valor;
}

function normalizarTexto_(valor) {
  if (valor === null || valor === undefined) return '';
  return String(valor).trim();
}

function normalizarContrasena_(valor) {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'number' && Math.floor(valor) === valor) return String(valor);
  return String(valor).trim().replace(/\.0$/, '');
}

function normalizarClave_(valor) {
  return normalizarTexto_(valor).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
}

function respuesta(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
