import { useRef, useState } from 'react';
import { QRCode } from 'react-qr-code';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace('/api', '');

/** Convierte el SVG del QR a PNG data URL via canvas */
async function svgToPng(svgEl, size = 500) {
  const svgString = new XMLSerializer().serializeToString(svgEl);
  const blob = new Blob([svgString], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('SVG load error')); };
    img.src = url;
  });
}

/** Descarga una imagen remota como data URL (base64) para incrustarla en el HTML */
async function fetchAsDataUrl(url) {
  try {
    const resp = await fetch(url);
    const blob = await resp.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Genera el HTML con 8 estilos distintos de tarjeta para elegir */
function buildPrintHtml({ qrPng, shopImgDataUrl, shopName }) {
  const hasImg = !!shopImgDataUrl;
  const n = shopName;
  const q = qrPng;
  const im = shopImgDataUrl;

  // Bloque imagen reutilizable
  const imgNormal  = hasImg ? `<img class="si" src="${im}" alt="">` : '';
  const imgWhite   = hasImg ? `<img class="si" src="${im}" alt="" style="filter:brightness(0) invert(1);opacity:.85">` : '';
  const imgBox     = hasImg ? `<div class="img-box">${imgNormal}</div>` : '';

  const cards = `

<!-- 1: Horizontal clásico: QR izq | imagen+nombre der -->
<div class="card" style="flex-direction:row;overflow:hidden">
  <div class="col" style="width:50mm;background:#fff;justify-content:center">
    <img class="qr" src="${q}">
  </div>
  <div style="width:.3mm;background:#e0e0e0;margin:5mm 0;flex-shrink:0"></div>
  <div class="col" style="flex:1;background:#fff;gap:2.5mm">
    ${imgNormal}<p class="nm">${n}</p><p class="sh">Escaneá para sacar turno</p>
  </div>
  <span class="num">1</span>
</div>

<!-- 2: Invertido: imagen+nombre izq | QR der -->
<div class="card" style="flex-direction:row;overflow:hidden">
  <div class="col" style="flex:1;background:#fff;gap:2.5mm">
    ${imgNormal}<p class="nm">${n}</p><p class="sh">Reservá tu turno online</p>
  </div>
  <div style="width:.3mm;background:#e0e0e0;margin:5mm 0;flex-shrink:0"></div>
  <div class="col" style="width:50mm;background:#fff;justify-content:center">
    <img class="qr" src="${q}">
  </div>
  <span class="num">2</span>
</div>

<!-- 3: Dark: fondo negro -->
<div class="card" style="flex-direction:row;overflow:hidden;background:#111">
  <div class="col" style="width:50mm;background:#111;justify-content:center">
    <img class="qr" src="${q}" style="filter:invert(1)">
  </div>
  <div style="width:.3mm;background:#333;margin:5mm 0;flex-shrink:0"></div>
  <div class="col" style="flex:1;background:#111;gap:2.5mm">
    ${imgBox}<p class="nm" style="color:#fff">${n}</p><p class="sh" style="color:#777">Escaneá para sacar turno</p>
  </div>
  <span class="num" style="color:#444">3</span>
</div>

<!-- 4: Verde oscuro -->
<div class="card" style="flex-direction:row;overflow:hidden">
  <div class="col" style="width:50mm;background:#fff;justify-content:center">
    <img class="qr" src="${q}">
  </div>
  <div style="width:.3mm;background:#1a7a4a44;margin:4mm 0;flex-shrink:0"></div>
  <div class="col" style="flex:1;background:#1a7a4a;gap:2.5mm">
    ${imgBox}<p class="nm" style="color:#fff">${n}</p><p class="sh" style="color:#a8d5bc">Escaneá para sacar turno</p>
  </div>
  <span class="num" style="color:#1a7a4a">4</span>
</div>

<!-- 5: Solo nombre grande (sin imagen, QR grande) -->
<div class="card" style="flex-direction:row;overflow:hidden">
  <div class="col" style="width:48mm;background:#fff;justify-content:center">
    <img class="qr" src="${q}" style="width:37mm;height:37mm">
  </div>
  <div style="width:.3mm;background:#e0e0e0;margin:5mm 0;flex-shrink:0"></div>
  <div class="col" style="flex:1;background:#fff;gap:3mm">
    <p style="font-size:11pt;font-weight:900;color:#111;text-transform:uppercase;letter-spacing:.04em;text-align:center;line-height:1.2">${n}</p>
    <p class="sh">Escaneá y reservá<br>tu turno online</p>
  </div>
  <span class="num">5</span>
</div>

<!-- 6: Banner superior con nombre, QR+imagen abajo -->
<div class="card" style="flex-direction:column;overflow:hidden">
  <div style="background:#111;width:100%;padding:2.5mm 5mm;display:flex;align-items:center;justify-content:center;flex-shrink:0">
    <p style="color:#fff;font-size:9pt;font-weight:700;text-transform:uppercase;letter-spacing:.06em">${n}</p>
  </div>
  <div style="flex:1;display:flex;align-items:center;justify-content:center;gap:5mm;padding:2mm 4mm;background:#fff">
    <img class="qr" src="${q}" style="width:37mm;height:37mm">
    ${hasImg ? `<img class="si" src="${im}" alt="" style="max-height:28mm;max-width:35mm">` : ''}
  </div>
  <span class="num">6</span>
</div>

<!-- 7: Marco interior doble -->
<div class="card" style="padding:3mm;justify-content:center;align-items:center;background:#fff">
  <div style="border:.4mm solid #111;border-radius:2mm;width:100%;height:100%;display:flex;align-items:center;justify-content:center;gap:3mm;padding:2.5mm 3mm">
    <img class="qr" src="${q}" style="width:34mm;height:34mm;flex-shrink:0">
    <div style="display:flex;flex-direction:column;align-items:center;gap:2mm">
      ${hasImg ? `<img class="si" src="${im}" alt="" style="max-height:18mm;max-width:33mm">` : ''}
      <p class="nm" style="font-size:7.5pt">${n}</p>
      <p class="sh">Escaneá para sacar turno</p>
    </div>
  </div>
  <span class="num">7</span>
</div>

<!-- 8: Imagen de fondo semitransparente -->
<div class="card" style="position:relative;justify-content:center;align-items:center;flex-direction:row;gap:4mm;overflow:hidden;background:#fff">
  ${hasImg ? `<img src="${im}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.1">` : ''}
  <img class="qr" src="${q}" style="position:relative;width:36mm;height:36mm;background:#fff;padding:1mm;border-radius:1.5mm;box-shadow:0 0 0 .3mm #ddd">
  <div style="position:relative;display:flex;flex-direction:column;align-items:center;gap:2.5mm;flex:1">
    ${hasImg ? `<img class="si" src="${im}" alt="" style="max-height:20mm;max-width:100%">` : ''}
    <p class="nm">${n}</p>
    <p class="sh">Escaneá para sacar turno</p>
  </div>
  <span class="num">8</span>
</div>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Estilos QR — ${n}</title>
<style>
  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: A4 portrait; margin: 10mm; }

  body { font-family: Arial, Helvetica, sans-serif; background: #fff; }

  .hint {
    text-align: center; color: #999; font-size: 9.5px;
    padding: 4px 0 8px; letter-spacing: .02em;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(2, 88mm);
    grid-template-rows: repeat(4, 54mm);
    gap: 4mm 6mm;
    justify-content: center;
  }

  /* Base de todas las tarjetas */
  .card {
    width: 88mm; height: 54mm;
    border: .4mm dashed #bbb;
    border-radius: 3mm;
    display: flex; align-items: stretch;
    break-inside: avoid; page-break-inside: avoid;
    position: relative;
  }

  /* Columna flex genérica */
  .col {
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    padding: 3.5mm 4mm;
  }

  /* Imagen de la tienda */
  .si { max-height: 26mm; max-width: 100%; object-fit: contain; }

  /* Contenedor blanco para imagen sobre fondo oscuro */
  .img-box {
    background: #fff; border-radius: 1.5mm;
    padding: 1.5mm 2mm; display: flex;
    align-items: center; justify-content: center;
  }
  .img-box .si { max-height: 20mm; max-width: 30mm; }

  /* QR estándar */
  .qr { width: 36mm; height: 36mm; display: block; image-rendering: pixelated; }

  /* Nombre */
  .nm {
    font-size: 8pt; font-weight: 700; text-align: center;
    text-transform: uppercase; letter-spacing: .04em;
    line-height: 1.2; color: #111;
  }

  /* Subtexto */
  .sh { font-size: 6pt; color: #aaa; text-align: center; line-height: 1.3; }

  /* Número de estilo */
  .num {
    position: absolute; bottom: 1.5mm; right: 2mm;
    font-size: 6pt; color: #ccc; font-weight: 700;
  }

  @media print { .hint { display: none; } }
</style>
</head>
<body>
  <p class="hint">
    Elegí el estilo que más te gusta (numerados en la esquina inferior derecha) &nbsp;·&nbsp;
    Pedí ese número multiplicado para imprimir en serie
  </p>
  <div class="grid">${cards}</div>
</body>
</html>`;
}

export default function TabQR({ shop, shopLoading, shopUrl, copyMsg, handleCopyUrl }) {
  const qrRef = useRef(null);
  const [generating, setGenerating] = useState(false);

  const handlePrintCards = async () => {
    if (!shopUrl || !qrRef.current) return;
    setGenerating(true);
    try {
      // 1. Convertir el SVG del QR a PNG
      const svgEl = qrRef.current.querySelector('svg');
      if (!svgEl) return;
      const qrPng = await svgToPng(svgEl, 600);

      // 2. Imagen de la empresa (usa `image`, no `logo`) → base64
      const shopImgDataUrl = shop?.image
        ? await fetchAsDataUrl(`${API_BASE}${shop.image}`)
        : null;

      // 3. Abrir ventana con las tarjetas y disparar impresión
      const html = buildPrintHtml({
        qrPng,
        shopImgDataUrl,
        shopName: shop?.name || '',
      });

      const win = window.open('', '_blank');
      if (!win) {
        alert('Habilitá las ventanas emergentes para este sitio e intentá de nuevo.');
        return;
      }
      win.document.open();
      win.document.write(html);
      win.document.close();
      win.focus();
      // Esperar a que las imágenes carguen antes de imprimir
      win.addEventListener('load', () => setTimeout(() => win.print(), 500));
    } catch (e) {
      console.error('Error generando tarjetas:', e);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="qr-tab">
      <div className="qr-page-header">
        <h3>Código QR de turnos</h3>
        <p>Compartí o imprimí este QR para que tus clientes reserven desde el celular, sin llamadas.</p>
      </div>

      {shopLoading ? (
        <p>Cargando...</p>
      ) : !shopUrl ? (
        <div className="qr-empty">
          <span className="qr-empty-icon">📎</span>
          <p>Definí un <strong>identificador URL</strong> en los datos de la empresa para generar el QR.</p>
        </div>
      ) : (
        <div className="qr-main-card">
          {/* QR de pantalla */}
          <div className="qr-left">
            <div className="qr-code-wrapper" ref={qrRef}>
              <QRCode value={shopUrl} size={200} />
            </div>
            <p className="qr-scan-hint">Escaneá con la cámara del celular</p>
          </div>

          {/* Info + acciones */}
          <div className="qr-right">
            <div className="qr-shop-name">{shop?.name}</div>

            <div className="qr-url-block">
              <span className="qr-url-label">URL pública</span>
              <span className="qr-url-text">{shopUrl}</span>
            </div>

            <div className="qr-actions-stack">
              <button type="button" className="btn-confirm qr-btn" onClick={handleCopyUrl}>
                📋 Copiar enlace
              </button>
              <button
                type="button"
                className="btn-secondary qr-btn"
                onClick={handlePrintCards}
                disabled={generating}
              >
                {generating ? 'Generando...' : '🖨 Tarjetas para imprimir'}
              </button>
            </div>

            {copyMsg && <div className="qr-copy-toast">{copyMsg}</div>}

            <p className="qr-tip">
              💡 El botón genera <strong>6 tarjetas en hoja A4</strong> con el QR y el logo de tu negocio,
              con líneas de corte. Desde el diálogo de impresión podés guardar directamente como PDF.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
