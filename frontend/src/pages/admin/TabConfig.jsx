import { useEffect, useState } from 'react';
import api from '../../utils/api';
import { normalizeArgPhoneAny } from '../../utils/phoneUtils';

export default function TabConfig() {
  const [shop, setShop] = useState(null);
  const [loading, setLoading] = useState(true);

  const [waNumber, setWaNumber] = useState('');
  const [waMsg, setWaMsg] = useState('');
  const [waMsgType, setWaMsgType] = useState('success');
  const [waLoading, setWaLoading] = useState(false);

  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwMsg, setPwMsg] = useState('');
  const [pwMsgType, setPwMsgType] = useState('error');
  const [pwLoading, setPwLoading] = useState(false);

  useEffect(() => {
    api.get('/shops')
      .then((r) => {
        const s = r.data.shops?.[0] || null;
        setShop(s);
        setWaNumber(s?.whatsappNumber ?? '');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleWaSubmit = async (e) => {
    e.preventDefault();
    setWaMsg('');

    let normalized = '';
    if (waNumber.trim()) {
      const { phone, error } = normalizeArgPhoneAny(waNumber);
      if (error) {
        setWaMsgType('error');
        return setWaMsg(error);
      }
      normalized = phone;
    }

    setWaLoading(true);
    try {
      const res = await api.patch(`/shops/${shop._id}/whatsapp-number`, { whatsappNumber: normalized });
      setShop(res.data.shop);
      setWaNumber(res.data.shop.whatsappNumber ?? '');
      setWaMsgType('success');
      setWaMsg(normalized ? 'Número guardado. Te llegará copia de cada turno.' : 'Número eliminado. No recibirás notificaciones.');
    } catch (err) {
      setWaMsgType('error');
      setWaMsg(err.response?.data?.msg || 'Error guardando número');
    } finally {
      setWaLoading(false);
    }
  };

  const handlePwChange = (e) => setPwForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handlePwSubmit = async (e) => {
    e.preventDefault();
    setPwMsg('');
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwMsgType('error');
      return setPwMsg('Las claves nuevas no coinciden');
    }
    setPwLoading(true);
    try {
      const resp = await api.put('/auth/me/password', {
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword,
      });
      setPwMsgType('success');
      setPwMsg(resp.data.msg);
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setPwMsgType('error');
      setPwMsg(err.response?.data?.msg || 'Error actualizando la clave');
    } finally {
      setPwLoading(false);
    }
  };

  if (loading) return <p>Cargando...</p>;

  return (
    <div>
      <h3>Número de WhatsApp del negocio</h3>
      <p className="wa-subtitle">
        A este número te llega copia de cada turno nuevo. Si lo dejás vacío, no recibís notificaciones.
      </p>
      <form className="admin-form" onSubmit={handleWaSubmit}>
        <input
          type="text"
          placeholder="Ej: 1161234567 (sin el 0 ni el 15)"
          value={waNumber}
          onChange={(e) => setWaNumber(e.target.value)}
        />
        {waMsg && <p className={waMsgType === 'success' ? 'success-text' : 'error-text'}>{waMsg}</p>}
        <button type="submit" className="btn-confirm" disabled={waLoading}>
          {waLoading ? 'Guardando...' : 'Guardar número'}
        </button>
      </form>

      <h3 style={{ marginTop: '24px' }}>Cambiar mi clave</h3>
      <form className="admin-form" onSubmit={handlePwSubmit}>
        <input
          name="currentPassword"
          type="password"
          placeholder="Clave actual"
          value={pwForm.currentPassword}
          onChange={handlePwChange}
          required
        />
        <input
          name="newPassword"
          type="password"
          placeholder="Nueva clave (minimo 6 caracteres)"
          value={pwForm.newPassword}
          onChange={handlePwChange}
          required
        />
        <input
          name="confirmPassword"
          type="password"
          placeholder="Confirmar nueva clave"
          value={pwForm.confirmPassword}
          onChange={handlePwChange}
          required
        />
        {pwMsg && <p className={pwMsgType === 'success' ? 'success-text' : 'error-text'}>{pwMsg}</p>}
        <button type="submit" className="btn-confirm" disabled={pwLoading}>
          {pwLoading ? 'Guardando...' : 'Cambiar clave'}
        </button>
      </form>
    </div>
  );
}
