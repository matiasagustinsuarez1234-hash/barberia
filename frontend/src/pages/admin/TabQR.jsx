import { QRCode } from 'react-qr-code';

export default function TabQR({ shop, shopLoading, shopUrl, copyMsg, handleCopyUrl, handlePrintQr }) {
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
          {/* Columna izquierda: QR */}
          <div className="qr-left">
            <div className="qr-code-wrapper">
              <QRCode value={shopUrl} size={200} />
            </div>
            <p className="qr-scan-hint">Escaneá con la cámara del celular</p>
          </div>

          {/* Columna derecha: info + acciones */}
          <div className="qr-right">
            <div className="qr-shop-name">{shop?.name}</div>

            <div className="qr-url-block">
              <span className="qr-url-label">URL pública</span>
              <span className="qr-url-text">{shopUrl}</span>
            </div>

            <div className="qr-actions-stack">
              <button
                type="button"
                className="btn-confirm qr-btn"
                onClick={handleCopyUrl}
              >
                📋 Copiar enlace
              </button>
              <button
                type="button"
                className="btn-secondary qr-btn"
                onClick={handlePrintQr}
              >
                🖨 Imprimir QR
              </button>
            </div>

            {copyMsg && <div className="qr-copy-toast">{copyMsg}</div>}

            <p className="qr-tip">
              💡 <strong>Tip:</strong> pegá el QR en la puerta del local o en las redes sociales para que los clientes saquen turno solos.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
