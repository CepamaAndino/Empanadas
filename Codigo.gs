/**
 * VENTA DE EMPANADAS GUAYACÁN 2026 — Backend (Google Apps Script)
 * Colegio Andino Montessori · CEPAMA
 *
 * INSTRUCCIONES DE INSTALACIÓN
 * 1. Crea una Google Sheet nueva llamada "Empanadas Guayacán 2026 - Datos".
 * 2. En esa sheet crea 2 hojas (tabs), llamadas EXACTAMENTE así:
 *      - "Pedidos"
 *      - "Config"
 *    En "Pedidos" pon estos encabezados en la fila 1 (columna A a K):
 *      Codigo | Fecha | Etapa | Alumno | Curso | WhatsApp | Correo | CantPino | CantQueso | Total | Estado
 *    En "Config" pon en A1 "StockPino" y B1 el número 200
 *              y en A2 "StockQueso" y B2 el número 50
 * 3. Extensiones > Apps Script. Pega este código en Codigo.gs.
 * 4. Reemplaza CARPETA_DRIVE_ID abajo por el ID de una carpeta de Drive donde
 *    quieras que se guarden los reportes CSV (o déjalo vacío para usar Mi unidad).
 * 5. Reemplaza CORREO_ADMIN por tu correo (para copia de notificaciones).
 * 6. Implementar > Nueva implementación > Aplicación web.
 *    - Ejecutar como: Yo
 *    - Quién tiene acceso: Cualquier usuario
 *    Copia la URL y pégala en API_URL dentro de index.html y admin.html.
 */

const SHEET_ID = "1YweawXKB204XMn0Wg062cSWXvWvQASP9YjdprzZYU_w";
const CARPETA_DRIVE_ID = ""; // opcional: ID de carpeta de Drive para los reportes
const CORREO_ADMIN = "cepama.andino.montessori@gmail.com";
const STOCK_INICIAL_PINO = 200;
const STOCK_INICIAL_QUESO = 50;
const PRECIO = 3500;
const PROMO_PAR = 6000;

function doGet(e) {
  const accion = e.parameter.action;
  if (accion === "stock") {
    const s = obtenerStock();
    return jsonOut({ ok: true, stock_pino: s.pino, stock_queso: s.queso });
  }
  if (accion === "listar") {
    return jsonOut({ ok: true, pedidos: listarPedidos() });
  }
  return jsonOut({ ok: false, mensaje: "Acción no reconocida" });
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonOut({ ok: false, mensaje: "Solicitud inválida" });
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    if (body.action === "crear_pedido") return crearPedido(body);
    if (body.action === "verificar_pago") return verificarPago(body);
    if (body.action === "rechazar_pago") return rechazarPago(body);
    if (body.action === "marcar_entregado") return marcarEntregado(body);
    if (body.action === "exportar_reporte") return exportarReporteDrive();
    return jsonOut({ ok: false, mensaje: "Acción no reconocida" });
  } finally {
    lock.releaseLock();
  }
}

function getSheet(nombre) {
  return SpreadsheetApp.openById(SHEET_ID).getSheetByName(nombre);
}

function obtenerStock() {
  const cfg = getSheet("Config");
  return {
    pino: Number(cfg.getRange("B1").getValue()),
    queso: Number(cfg.getRange("B2").getValue())
  };
}

function setStock(pino, queso) {
  const cfg = getSheet("Config");
  cfg.getRange("B1").setValue(pino);
  cfg.getRange("B2").setValue(queso);
}

function siguienteCodigo() {
  const sh = getSheet("Pedidos");
  const ultimaFila = sh.getLastRow();
  const n = ultimaFila < 2 ? 1 : ultimaFila; // fila 1 = encabezado
  return "EMP-" + String(n).padStart(3, "0");
}

function crearPedido(body) {
  const cantPino = Number(body.cantidad_pino) || 0;
  const cantQueso = Number(body.cantidad_queso) || 0;

  if (cantPino <= 0 && cantQueso <= 0) {
    return jsonOut({ ok: false, mensaje: "Selecciona al menos una empanada." });
  }

  const stock = obtenerStock();
  if (cantPino > stock.pino) {
    return jsonOut({ ok: false, mensaje: "No queda suficiente stock de pino.", stock_pino: stock.pino, stock_queso: stock.queso });
  }
  if (cantQueso > stock.queso) {
    return jsonOut({ ok: false, mensaje: "No queda suficiente stock de queso.", stock_pino: stock.pino, stock_queso: stock.queso });
  }

  // recalculamos el total en servidor (no confiamos ciegamente en el cliente)
  const totalUnidades = cantPino + cantQueso;
  const pares = Math.floor(totalUnidades / 2);
  const sueltas = totalUnidades % 2;
  const total = pares * PROMO_PAR + sueltas * PRECIO;

  // reservamos stock de inmediato (misma lógica que Bingo Andino: se descuenta al pedir,
  // y se restaura si el pago es rechazado)
  const nuevoPino = stock.pino - cantPino;
  const nuevoQueso = stock.queso - cantQueso;
  setStock(nuevoPino, nuevoQueso);

  const codigo = siguienteCodigo();
  const sh = getSheet("Pedidos");
  sh.appendRow([
    codigo,
    new Date(),
    body.etapa || "",
    body.nombre || "",
    body.curso || "",
    body.whatsapp || "",
    body.correo || "",
    cantPino,
    cantQueso,
    total,
    "Pendiente"
  ]);

  return jsonOut({
    ok: true,
    codigo: codigo,
    total: total,
    stock_pino: nuevoPino,
    stock_queso: nuevoQueso
  });
}

function buscarFilaPorCodigo(codigo) {
  const sh = getSheet("Pedidos");
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === codigo) return { fila: i + 1, datos: data[i] };
  }
  return null;
}

function verificarPago(body) {
  const encontrado = buscarFilaPorCodigo(body.codigo);
  if (!encontrado) return jsonOut({ ok: false, mensaje: "Pedido no encontrado." });

  const sh = getSheet("Pedidos");
  sh.getRange(encontrado.fila, 11).setValue("Verificado"); // columna K = Estado

  const [codigo, fecha, etapa, nombre, curso, whatsapp, correo, cantPino, cantQueso, total] = encontrado.datos;
  enviarCorreoComprobante(correo, nombre, curso, codigo, cantPino, cantQueso, total);

  return jsonOut({ ok: true });
}

function rechazarPago(body) {
  const encontrado = buscarFilaPorCodigo(body.codigo);
  if (!encontrado) return jsonOut({ ok: false, mensaje: "Pedido no encontrado." });

  const [codigo, fecha, etapa, nombre, curso, whatsapp, correo, cantPino, cantQueso] = encontrado.datos;

  // restauramos el stock reservado
  const stock = obtenerStock();
  setStock(stock.pino + Number(cantPino), stock.queso + Number(cantQueso));

  const sh = getSheet("Pedidos");
  sh.getRange(encontrado.fila, 11).setValue("Rechazado");

  return jsonOut({ ok: true });
}

function marcarEntregado(body) {
  const encontrado = buscarFilaPorCodigo(body.codigo);
  if (!encontrado) return jsonOut({ ok: false, mensaje: "Pedido no encontrado." });

  const estadoActual = encontrado.datos[10];
  if (estadoActual !== "Verificado") {
    return jsonOut({ ok: false, mensaje: "Solo se puede marcar como entregado un pedido ya verificado." });
  }

  const sh = getSheet("Pedidos");
  sh.getRange(encontrado.fila, 11).setValue("Entregado");

  return jsonOut({ ok: true });
}

function listarPedidos() {
  const sh = getSheet("Pedidos");
  const data = sh.getDataRange().getValues();
  const out = [];
  for (let i = 1; i < data.length; i++) {
    out.push({
      codigo: data[i][0],
      fecha: data[i][1],
      etapa: data[i][2],
      nombre: data[i][3],
      curso: data[i][4],
      whatsapp: data[i][5],
      correo: data[i][6],
      cantidad_pino: data[i][7],
      cantidad_queso: data[i][8],
      total: data[i][9],
      estado: data[i][10]
    });
  }
  return out;
}

function enviarCorreoComprobante(correo, nombre, curso, codigo, cantPino, cantQueso, total) {
  const asunto = "Comprobante de compra — Empanadas Guayacán 2026 (" + codigo + ")";
  const cuerpo =
    "¡Hola!\n\n" +
    "Confirmamos tu compra de Empanadas Guayacán 2026, Colegio Andino Montessori.\n\n" +
    "Código de compra: " + codigo + "\n" +
    "Alumno/a: " + nombre + "\n" +
    "Curso: " + curso + "\n" +
    "Empanadas de pino: " + cantPino + "\n" +
    "Empanadas de queso: " + cantQueso + "\n" +
    "Total pagado: $" + Number(total).toLocaleString("es-CL") + "\n\n" +
    "Tu pago fue verificado. ¡Gracias por apoyar a CEPAMA!\n\n" +
    "Colegio Andino Montessori";

  MailApp.sendEmail({
    to: correo,
    cc: CORREO_ADMIN,
    subject: asunto,
    body: cuerpo
  });
}

/**
 * Genera un CSV con todos los pedidos y lo guarda en Drive.
 * Se llama desde el panel de administración (botón "Exportar reporte a Drive").
 */
function exportarReporteDrive() {
  const pedidos = listarPedidos();
  let csv = "Codigo,Fecha,Etapa,Alumno,Curso,WhatsApp,Correo,CantPino,CantQueso,Total,Estado\n";
  pedidos.forEach(p => {
    csv += [p.codigo, p.fecha, p.etapa, p.nombre, p.curso, p.whatsapp, p.correo, p.cantidad_pino, p.cantidad_queso, p.total, p.estado]
      .map(v => '"' + String(v).replace(/"/g, '""') + '"').join(",") + "\n";
  });

  const nombreArchivo = "Reporte Empanadas Guayacan 2026 - " + Utilities.formatDate(new Date(), "GMT-4", "yyyy-MM-dd HH.mm") + ".csv";
  const carpeta = CARPETA_DRIVE_ID ? DriveApp.getFolderById(CARPETA_DRIVE_ID) : DriveApp.getRootFolder();
  const archivo = carpeta.createFile(nombreArchivo, csv, MimeType.CSV);

  return jsonOut({ ok: true, url: archivo.getUrl() });
}

// Permite llamar exportarReporteDrive también vía POST desde el admin
function doPost_exportar(e) {
  return exportarReporteDrive();
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
