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

/** Genera el HTML completo de las 6 tarjetas para imprimir */
function buildPrintHtml({ qrPng, shopImgDataUrl, shopName }) {
  const hasImg = !!shopImgDataUrl;
  const qrSizeMm = hasImg ? 44 : 58;

  const imgBlock = hasImg
    ? `<img class="shop-img" src="${shopImgDataUrl}" alt="${shopName}">`
    : '';

  const card = `
    <div class="card">
      ${imgBlock}
      <img class="qr" src="${qrPng}" alt="QR turnos">
      <p class="name">${shopName}</p>
    </div>`;

  const cards = Array(6).fill(card).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Tarjetas QR — ${shopName}</title>
<style>
  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

  @page { size: A4 portrait; margin: 10mm; }

  body {
    font-family: Arial, Helvetica, sans-serif;
    background: #fff;
    color: #111;
  }

  .hint {
    text-align: center;
    color: #999;
    font-size: 10px;
    padding: 6px 0 10px;
    letter-spacing: 0.02em;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(2, 92mm);
    grid-template-rows: repeat(3, 86mm);
    gap: 4mm;
    justify-content: center;
  }

  .card {
    width: 92mm;
    height: 86mm;
    border: 0.4mm dashed #bbb;
    border-radius: 3mm;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4mm 5mm;
    gap: 2.5mm;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .shop-img {
    max-height: 19mm;
    max-width: 80mm;
    object-fit: contain;
  }

  .qr {
    width: ${qrSizeMm}mm;
    height: ${qrSizeMm}mm;
    display: block;
    image-rendering: pixelated;
  }

  .name {
    font-size: 10.5pt;
    font-weight: 700;
    text-align: center;
    line-height: 1.2;
    max-width: 80mm;
  }

  @media print {
    .hint { display: none; }
  }
</style>
</head>
<body>
  <p class="hint">
    Imprimí y recortá por las líneas punteadas &nbsp;·&nbsp;
    Para guardar como PDF usá "Guardar como PDF" en el diálogo de impresión
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
