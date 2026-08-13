# Venta de Empanadas Guayacán 2026 🥟

App de venta de empanadas (pino/queso) para el Colegio Andino Montessori — CEPAMA.
Misma lógica que **Bingo Andino**: se reserva el stock al hacer el pedido, la
tesorería verifica la transferencia en el panel admin, y ahí se dispara el
correo con el comprobante automáticamente.

## Estructura

```
empanadas-guayacan-2026/
├── index.html      → tienda (lo que ven los apoderados)
├── admin.html       → panel de verificación de pagos
├── Codigo.gs         → backend (Google Apps Script)
└── assets/logo.jpg   → logo del colegio
```

## Paso a paso para dejarlo funcionando

### 1. Crea la Google Sheet
1. Crea una hoja nueva llamada **"Empanadas Guayacán 2026 - Datos"**.
2. Crea 2 pestañas con estos nombres EXACTOS:
   - `Pedidos` — en la fila 1 pon estos encabezados (columnas A→K):
     `Codigo | Fecha | Etapa | Alumno | Curso | WhatsApp | Correo | CantPino | CantQueso | Total | Estado`
   - `Config` — en `A1` escribe `StockPino` y en `B1` el número `200`.
     En `A2` escribe `StockQueso` y en `B2` el número `50`.
3. Copia el **ID de la hoja** (está en la URL, entre `/d/` y `/edit`).

### 2. Configura el backend (Apps Script)
1. En la misma Sheet: **Extensiones → Apps Script**.
2. Borra el contenido y pega el de `Codigo.gs`.
3. Reemplaza:
   - `SHEET_ID` → el ID que copiaste en el paso 1.
   - `CORREO_ADMIN` → tu correo (recibe copia de cada comprobante).
   - `CARPETA_DRIVE_ID` → (opcional) ID de una carpeta de Drive para los reportes.
4. **Implementar → Nueva implementación → Aplicación web**
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier usuario**
5. Copia la URL que te entrega (termina en `/exec`).

### 3. Conecta el frontend
1. En `index.html`, reemplaza `API_URL` y `WHATSAPP_ADMIN` (el número que recibe
   los pedidos por WhatsApp) por tus datos.
2. En `admin.html`, reemplaza `API_URL` por la misma URL.

### 4. Publica en GitHub Pages
1. Crea el repo (por ejemplo dentro de tu organización `cepamaandino`, igual
   que tesorería y bingo).
2. Sube estos 4 archivos/carpeta.
3. Settings → Pages → Deploy from branch → `main` / `root`.
4. Tu tienda quedará en algo como:
   `https://cepamaandino.github.io/empanadas-guayacan-2026/`
   y el panel admin en:
   `https://cepamaandino.github.io/empanadas-guayacan-2026/admin.html`
   (comparte este link solo con tesorería, no es público).

## Cómo funciona

- **Stock**: 200 pino / 50 queso, se descuenta apenas alguien genera un pedido
  (igual que las cartillas del bingo se reservaban al elegir el número).
- **Promoción 2x$6.000**: se calcula automático sobre el total de unidades
  (mezclando pino y queso), sin importar la combinación.
- **Código correlativo**: `EMP-001`, `EMP-002`, etc.
- **Verificación**: en `admin.html` la tesorería revisa cada transferencia y
  aprieta "Verificar" → ahí se envía el correo con el comprobante automático.
  Si rechaza un pedido, el stock reservado se devuelve automáticamente.
- **WhatsApp a cada apoderado**: no existe una forma 100% gratis de enviarlo
  automático desde el servidor, así que en `admin.html` cada pedido tiene
  botones de 1 clic:
  - **📲 Comprobante** (pedidos Pendientes) → abre WhatsApp al número del
    apoderado con el detalle del pedido y los datos para transferir.
  - **📲 Aprobación** (pedidos Verificados) → abre WhatsApp avisando que ya
    puede pasar a retirar sus empanadas en el stand.
- **Entrega en el stand**: cuando el apoderado retira sus empanadas, se
  aprieta **✅ Entregado** en el panel — así el pedido no se puede volver a
  cobrar por error.
- **Reporte a Drive**: botón "Exportar reporte a Drive" en el admin genera un
  CSV con todos los pedidos y lo guarda en la carpeta que configuraste.

## Nota sobre el diseño

Colores de la bandera chilena (azul/rojo/blanco), con el logo del colegio y
el título en dos tipografías: "Anton" (sello, bien fuerte, para el nombre) y
"Caveat" (manuscrita, para el acento "Guayacán 2026"), igual espíritu que el
póster de la Fonda Andina.
