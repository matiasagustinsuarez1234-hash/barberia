import { useEffect, useState } from 'react';
import api from '../../utils/api';

export default function TabSuscripciones() {
  const [subs, setSubs] = useState([]);
  const [shops, setShops] = useState([]);
  const [plans, setPlans] = useState([]);
  const [form, setForm] = useState({ shop: '', plan: '', status: 'active' });
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState('');

  const load = () => {
    api.get('/subscriptions').then((r) => setSubs(r.data.subscriptions)).catch(() => {});
    api.get('/shops').then((r) => setShops(r.data.shops)).catch(() => {});
    api.get('/plans').then((r) => setPlans(r.data.plans)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg('');
    try {
      await api.post('/subscriptions', form);
      setForm({ shop: '', plan: '', status: 'active' });
      setMsg('Suscripcion asignada correctamente');
      setMsgType('success');
      load();
    } catch (err) {
      setMsg(err.response?.data?.msg || 'Error');
      setMsgType('error');
    }
  };

  const shopsWithSub = new Set(subs.map((s) => s.shop?._id));

  return (
    <div>
      <form className="admin-form" onSubmit={handleSubmit}>
        <h3>Asignar Plan a Barberia</h3>
        <select name="shop" value={form.shop} onChange={handleChange} required>
          <option value="">Seleccionar empresa *</option>
          {shops.map((s) => (
            <option key={s._id} value={s._id}>{s.name}{shopsWithSub.has(s._id) ? ' (tiene plan)' : ''}</option>
          ))}
        </select>
        <select name="plan" value={form.plan} onChange={handleChange} required>
          <option value="">Seleccionar plan *</option>
          {plans.map((p) => (
            <option key={p._id} value={p._id}>{p.name} — ${p.price.toLocaleString('es-AR')}/mes — {p.maxBarbers} barbero{p.maxBarbers !== 1 ? 's' : ''}</option>
          ))}
        </select>
        <select name="status" value={form.status} onChange={handleChange}>
          <option value="active">Activa</option>
          <option value="cancelled">Cancelada</option>
          <option value="expired">Vencida</option>
        </select>
        <div className="form-actions">
          <button type="submit" className="btn-confirm">Asignar / Actualizar Plan</button>
        </div>
        {msg && <p className={msgType === 'success' ? 'success-text' : 'error-text'}>{msg}</p>}
      </form>

      <div className="admin-list">
        <h4 style={{ margin: '12px 0 8px' }}>Suscripciones activas</h4>
        {subs.length === 0 && <p className="empty-msg">No hay suscripciones asignadas.</p>}
        {subs.map((s) => (
          <div key={s._id} className={`admin-list-item ${s.status !== 'active' ? 'inactive' : ''}`}>
            <div>
              <strong>{s.shop?.name || 'Barberia eliminada'}</strong>
              <span className="tag-list">{s.plan?.name}</span>
              <span className="tag-list">${s.plan?.price?.toLocaleString('es-AR')}/mes</span>
              <span className="tag-list">Hasta {s.plan?.maxBarbers} barbero{s.plan?.maxBarbers !== 1 ? 's' : ''}</span>
              {s.plan?.includesReminders && <span className="tag-list plan-tag">Con recordatorios</span>}
              <span className={`tag-list ${s.status === 'active' ? '' : 'tag-inactive'}`}>{s.status === 'active' ? 'Activa' : s.status === 'cancelled' ? 'Cancelada' : 'Vencida'}</span>
            </div>
            <div className="item-actions">
              <button
                type="button"
                className="btn-icon"
                title="Editar"
                onClick={() => setForm({ shop: s.shop?._id || '', plan: s.plan?._id || '', status: s.status })}
              >✏</button>
              <button
                type="button"
                className="btn-icon btn-danger"
                title="Eliminar"
                onClick={async () => {
                  if (!confirm('Eliminar esta suscripcion?')) return;
                  await api.delete(`/subscriptions/${s._id}`);
                  load();
                }}
              >🗑</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
