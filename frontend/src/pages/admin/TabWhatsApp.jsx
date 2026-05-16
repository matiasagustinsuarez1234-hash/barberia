import { useEffect, useState } from 'react';
import { QRCode } from 'react-qr-code';
import api from '../../utils/api';

export default function TabWhatsApp() {
  const [status, setStatus] = useState('disconnected');
  const [qrValue, setQrValue] = useState(null);

  const poll = async () => {
    try {
      const res = await api.get('/whatsapp/status');
      setStatus(res.data.status);
      if (res.data.status === 'qr') {
        const qrRes = await api.get('/whatsapp/qr');
        setQrValue(qrRes.data.qr);
      } else {
        setQrValue(null);
      }
    } catch { /* ignore */ }
  };

  useEffect(() => {
    poll();
  }, []);

  useEffect(() => {
    if (status === 'ready' || status === 'disconnected') return;
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [status]);

  const handleConnect = async () => {
    setStatus('connecting');
    try {
      await api.post('/whatsapp/connect');
      poll();
    } catch { setStatus('disconnected'); }
  };

  const handleDisconnect = async () => {
    try {
      await api.post('/whatsapp/disconnect');
      setStatus('disconnected');
      setQrValue(null);
    } catch { /* ignore */ }
  };

  return (
    <div className="whatsapp-tab">
      <h3>Conexion WhatsApp</h3>
      {status === 'ready' && (
        <div className="wa-connected">
          <p className="success-text">WhatsApp conectado</p>
          <button type="button" className="btn-secondary" onClick={handleDisconnect}>Desconectar</button>
        </div>
      )}
      {status === 'disconnected' && (
        <div className="wa-disconnected">
          <p>No hay una sesion de WhatsApp activa.</p>
          <button type="button" className="btn-confirm" onClick={handleConnect}>Conectar WhatsApp</button>
        </div>
      )}
      {(status === 'connecting' || status === 'qr') && (
        <div className="wa-qr">
          {status === 'connecting' && !qrValue && <p>Iniciando conexion...</p>}
          {qrValue && (
            <>
              <p>Escaneá este QR con WhatsApp para vincular tu cuenta:</p>
              <div className="qr-wrapper">
                <QRCode value={qrValue} size={220} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
