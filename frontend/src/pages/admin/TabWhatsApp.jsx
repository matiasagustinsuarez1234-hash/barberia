import { useEffect, useState } from 'react';
import api from '../../utils/api';

export default function TabWhatsApp() {
  const [configured, setConfigured] = useState(false);
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [hasToken, setHasToken] = useState(false);
  const [form, setForm] = useState({ phoneNumberId: '', token: '' });
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState('success');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      const res = await api.get('/whatsapp/meta');
      setConfigured(res.data.configured);
      setPhoneNumberId(res.data.phoneNumberId ?? '');
      setHasToken(res.data.hasToken);
    } catch { /* ignore */ }
  };

  useEffect(() => { load(); }, []);

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSave = async (e) => {
    e.preventDefault();
    setMsg('');
    setLoading(true);
    try {
      await api.put('/whatsapp/meta', { phoneNumberId: form.phoneNumberId, token: form.token });
      setMsgType('success');
      setMsg('Credenciales guardadas. Los mensajes se enviarán desde tu número de Meta.');
      setForm({ phoneNumberId: '', token: '' });
      load();
    } catch (err) {
      setMsgType('error');
      setMsg(err.response?.data?.msg || 'Error guardando credenciales');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    if (!window.confirm('¿Eliminar las credenciales de Meta? Se volverá a usar el WhatsApp central.')) return;
    try {
      await api.delete('/whatsapp/meta');
      setMsgType('success');
      setMsg('Credenciales eliminadas. Se usará el WhatsApp central.');
      load();
    } catch {
      setMsgType('error');
      setMsg('Error eliminando credenciales');
    }
  };

  return (
    <div>
      <h3>WhatsApp Business API</h3>
      <p className="wa-subtitle">
        Si tenés una cuenta de Meta Business con WhatsApp API, podés configurar tu propio número para enviar los mensajes. Si no configurás nada, se usa el número central del sistema.
      </p>

      <div className="shop-config-card" style={{ marginBottom: '20px' }}>
        <p>
          <strong>Estado actual: </strong>
          {configured
            ? `Usando tu número propio (Phone Number ID: ${phoneNumberId})`
            : 'Usando el número central del sistema'}
        </p>
        {configured && (
          <button type="button" className="btn-secondary" onClick={handleClear}>
            Quitar configuración propia
          </button>
        )}
      </div>

      <h4>{configured ? 'Actualizar credenciales' : 'Configurar tu número de Meta'}</h4>
      <form className="admin-form" onSubmit={handleSave}>
        <input
          name="phoneNumberId"
          type="text"
          placeholder="Phone Number ID (de Meta Developer Console)"
          value={form.phoneNumberId}
          onChange={handleChange}
          required
        />
        <input
          name="token"
          type="password"
          placeholder={hasToken && configured ? 'Token (dejá vacío para no cambiarlo — no aplica)' : 'Access Token permanente'}
          value={form.token}
          onChange={handleChange}
          required
        />
        <p className="form-hint">
          Encontrás el Phone Number ID y el token en{' '}
          <strong>Meta for Developers → Tu app → WhatsApp → API Setup</strong>.
          Usá un token permanente (System User Token), no el temporal de 24hs.
        </p>
        {msg && <p className={msgType === 'success' ? 'success-text' : 'error-text'}>{msg}</p>}
        <button type="submit" className="btn-confirm" disabled={loading}>
          {loading ? 'Guardando...' : 'Guardar credenciales'}
        </button>
      </form>
    </div>
  );
}
