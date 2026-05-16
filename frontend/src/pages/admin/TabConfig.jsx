import { useEffect, useState } from 'react';
import api from '../../utils/api';

export default function TabConfig() {
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwMsg, setPwMsg] = useState('');
  const [pwMsgType, setPwMsgType] = useState('error');
  const [pwLoading, setPwLoading] = useState(false);

  useEffect(() => {
    api.get('/shops').then((r) => setShops(r.data.shops)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const togglePayment = async (id) => {
    try {
      const resp = await api.patch(`/shops/${id}/payment`);
      setShops((prev) => prev.map((s) => s._id === id ? resp.data.shop : s));
      setMsg('Metodo de pago actualizado');
    } catch { setMsg('Error actualizando pago'); }
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
      <h3>Configuracion de Barberia</h3>
      {msg && <p className="success-text">{msg}</p>}
      {shops.map((s) => (
        <div key={s._id} className="shop-config-card">
          <div className="shop-info">
            <strong>{s.name}</strong>
            {s.address && <span>{s.address}</span>}
            {s.phone && <span>{s.phone}</span>}
          </div>
          <div className="toggle-row">
            <span>MercadoPago</span>
            <label className="toggle-switch">
              <input type="checkbox" checked={s.mercadopagoEnabled} onChange={() => togglePayment(s._id)} />
              <span className="toggle-slider" />
            </label>
            <span className={s.mercadopagoEnabled ? 'text-active' : 'text-inactive'}>
              {s.mercadopagoEnabled ? 'Activo' : 'Inactivo'}
            </span>
          </div>
        </div>
      ))}

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
