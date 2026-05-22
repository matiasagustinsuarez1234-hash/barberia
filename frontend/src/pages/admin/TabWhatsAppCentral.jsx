import { useEffect, useState } from 'react';
import { QRCode } from 'react-qr-code';
import api from '../../utils/api';

export default function TabWhatsAppCentral() {
  const [status, setStatus] = useState('disconnected');
  const [phone, setPhone] = useState(null);
  const [qrValue, setQrValue] = useState(null);
  const [shops, setShops] = useState([]);
  const [toggling, setToggling] = useState(null);

  const pollStatus = async () => {
    try {
      const res = await api.get('/whatsapp/central/status');
      setStatus(res.data.status);
      setPhone(res.data.phone ?? null);
      if (res.data.status === 'qr') {
        const qrRes = await api.get('/whatsapp/central/qr');
        setQrValue(qrRes.data.qr);
      } else {
        setQrValue(null);
      }
    } catch { /* ignore */ }
  };

  const loadShops = async () => {
    try {
      const res = await api.get('/whatsapp/central/shops');
      setShops(res.data.shops || []);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    pollStatus();
    loadShops();
  }, []);

  useEffect(() => {
    if (status === 'ready' || status === 'disconnected') return;
    const interval = setInterval(pollStatus, 3000);
    return () => clearInterval(interval);
  }, [status]);

  const handleConnect = async () => {
    setStatus('connecting');
    try {
      await api.post('/whatsapp/central/connect');
      pollStatus();
    } catch { setStatus('disconnected'); }
  };

  const handleDisconnect = async () => {
    try {
      await api.post('/whatsapp/central/disconnect');
      setStatus('disconnected');
      setQrValue(null);
    } catch { /* ignore */ }
  };

  const handleToggle = async (shopId) => {
    setToggling(shopId);
    try {
      const res = await api.patch(`/whatsapp/central/shops/${shopId}/toggle`);
      setShops((prev) =>
        prev.map((s) => s._id === shopId ? { ...s, whatsappEnabled: res.data.whatsappEnabled } : s)
      );
    } catch { /* ignore */ }
    setToggling(null);
  };

  return (
    <div className="whatsapp-tab">
      <h3>WhatsApp Central</h3>
      <p className="wa-subtitle">Este número único envía mensajes a todos los negocios habilitados.</p>

      <div className="wa-session-box">
        {status === 'ready' && (
          <div className="wa-connected">
            <p className="success-text">✅ WhatsApp central conectado</p>
            {phone && <p className="wa-phone">Línea: +{phone}</p>}
            <button type="button" className="btn-secondary" onClick={handleDisconnect}>Desconectar</button>
          </div>
        )}
        {status === 'disconnected' && (
          <div className="wa-disconnected">
            <p>No hay sesión central activa.</p>
            <button type="button" className="btn-confirm" onClick={handleConnect}>Conectar WhatsApp central</button>
          </div>
        )}
        {(status === 'connecting' || status === 'qr') && (
          <div className="wa-qr">
            {status === 'connecting' && !qrValue && <p>Iniciando conexión...</p>}
            {qrValue && (
              <>
                <p>Escaneá este QR con el WhatsApp del número central:</p>
                <div className="qr-wrapper">
                  <QRCode value={qrValue} size={220} />
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <h3 className="wa-shops-title">Empresas</h3>
      <div className="wa-shops-list">
        {shops.map((shop) => (
          <div key={shop._id} className="wa-shop-row">
            <span className="wa-shop-name">{shop.name}</span>
            <button
              type="button"
              className={`wa-toggle ${shop.whatsappEnabled ? 'enabled' : 'disabled'}`}
              onClick={() => handleToggle(shop._id)}
              disabled={toggling === shop._id}
            >
              {shop.whatsappEnabled ? 'Habilitado' : 'Deshabilitado'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
