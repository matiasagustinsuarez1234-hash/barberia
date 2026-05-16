import { QRCode } from 'react-qr-code';

export default function TabQR({ shop, shopLoading, shopUrl, copyMsg, handleCopyUrl, handlePrintQr }) {
  return (
    <div className="qr-tab">
      <h3>QR para pedir turnos</h3>
      <p>Imprimí o compartí este código para que tus clientes lleguen directo a tu página de reservas.</p>
      <div className="qr-card">
        <div className="qr-card-header">
          <div>
            <p className="qr-label">URL pública</p>
            {shopLoading ? (
              <p>Cargando barbería...</p>
            ) : shop ? (
              <p className="qr-url">{shopUrl}</p>
            ) : (
              <p>No hay slug definido para tu barbería.</p>
            )}
          </div>
          <div className="qr-actions">
            <button type="button" className="btn-confirm-sm" onClick={handlePrintQr} disabled={shopLoading || !shopUrl}>Imprimir QR</button>
            <button type="button" className="btn-secondary" onClick={handleCopyUrl} disabled={!shopUrl}>Copiar enlace</button>
          </div>
        </div>
        <div className="qr-card-body">
          <div className="qr-preview">
            {shopUrl ? (
              <QRCode value={shopUrl} size={180} />
            ) : (
              <p>Definí un slug en la barbería para generar la URL de turnos.</p>
            )}
          </div>
          {copyMsg && <div className="copy-msg">{copyMsg}</div>}
        </div>
      </div>
    </div>
  );
}
