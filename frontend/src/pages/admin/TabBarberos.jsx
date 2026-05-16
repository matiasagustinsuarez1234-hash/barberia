import { useEffect, useState } from 'react';
import api from '../../utils/api';

export default function TabBarberos() {
  const [barbers, setBarbers] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [form, setForm] = useState({ name: '', whatsapp: '', specialties: '', surchargeType: 'none', surchargeValue: 0 });
  const [editing, setEditing] = useState(null);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState('error');

  const load = () => {
    api.get('/barbers').then((r) => setBarbers(r.data.barbers)).catch(() => {});
    api.get('/subscriptions/mine').then((r) => setSubscription(r.data.subscription)).catch(() => {});
  };
  useEffect(() => { load(); }, []);
  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg('');
    const payload = { ...form, specialties: form.specialties.split(',').map((s) => s.trim()).filter(Boolean) };
    try {
      editing ? await api.put(`/barbers/${editing}`, payload) : await api.post('/barbers', payload);
      setForm({ name: '', whatsapp: '', specialties: '', surchargeType: 'none', surchargeValue: 0 });
      setEditing(null);
      setMsg('');
      load();
    } catch (err) { setMsg(err.response?.data?.msg || 'Error'); setMsgType('error'); }
  };

  const editBarber = (b) => {
    setEditing(b._id);
    setForm({ name: b.name, whatsapp: b.whatsapp || '', specialties: (b.specialties || []).join(', '), surchargeType: b.surchargeType || 'none', surchargeValue: b.surchargeValue || 0 });
  };
  const toggleActive = async (b) => { await api.put(`/barbers/${b._id}`, { active: !b.active }); load(); };
  const deleteBarber = async (id) => { if (!confirm('Eliminar barbero?')) return; await api.delete(`/barbers/${id}`); load(); };

  const maxBarbers = subscription?.plan?.maxBarbers;
  const atLimit = subscription && barbers.length >= maxBarbers;
  const overLimit = subscription && barbers.length > maxBarbers;

  return (
    <div>
      {subscription && (
        <div className={`plan-banner ${atLimit ? 'plan-banner-limit' : ''}`}>
          <div>
            <span>Plan: <strong>{subscription.plan?.name}</strong> &mdash; {barbers.length} / {maxBarbers} barbero{maxBarbers !== 1 ? 's' : ''}</span>
            {subscription.plan?.includesReminders && <span className="plan-tag">Con recordatorios</span>}
            {overLimit && (
              <p className="plan-over-msg">
                Tenes {barbers.length} barberos cargados pero tu plan actual cubre hasta {maxBarbers}.
                Contacta al administrador para regularizar tu plan.
                De no hacerlo, el proximo mes se te asignara automaticamente el plan que corresponda a la cantidad de barberos que tenes.
              </p>
            )}
          </div>
        </div>
      )}
      <form className="admin-form" onSubmit={handleSubmit}>
        <h3>{editing ? 'Editar Barbero' : 'Nuevo Barbero'}</h3>
        <input name="name" placeholder="Nombre *" value={form.name} onChange={handleChange} required />
        <input name="whatsapp" placeholder="WhatsApp (ej: 5491100000000)" value={form.whatsapp} onChange={handleChange} />
        <input name="specialties" placeholder="Especialidades (separadas por coma)" value={form.specialties} onChange={handleChange} />
        <div className="field-row">
          <label style={{ fontSize: '0.9rem', whiteSpace: 'nowrap' }}>Recargo</label>
          <select name="surchargeType" value={form.surchargeType} onChange={handleChange} style={{ flex: 1 }}>
            <option value="none">Sin recargo</option>
            <option value="percent">Porcentaje (%)</option>
            <option value="fixed">Monto fijo ($)</option>
          </select>
          {form.surchargeType !== 'none' && (
            <input
              name="surchargeValue"
              type="number"
              min="0"
              placeholder={form.surchargeType === 'percent' ? 'Ej: 10' : 'Ej: 2000'}
              value={form.surchargeValue}
              onChange={handleChange}
              style={{ width: '100px' }}
            />
          )}
        </div>
        <div className="form-actions">
          <button type="submit" className="btn-confirm" disabled={!editing && atLimit}>{editing ? 'Guardar' : 'Agregar'}</button>
          {editing && <button type="button" className="btn-secondary" onClick={() => { setEditing(null); setForm({ name: '', whatsapp: '', specialties: '', surchargeType: 'none', surchargeValue: 0 }); }}>Cancelar</button>}
        </div>
        {msg && <p className={msgType === 'error' ? 'error-text' : 'success-text'}>{msg}</p>}
      </form>
      <div className="admin-list">
        {barbers.map((b) => (
          <div key={b._id} className={`admin-list-item ${!b.active ? 'inactive' : ''}`}>
            <div>
              <strong>{b.name}</strong>
              {b.specialties?.length > 0 && <span className="tag-list">{b.specialties.join(', ')}</span>}
              {b.surchargeType && b.surchargeType !== 'none' && b.surchargeValue > 0 && (
                <span className="tag-list">
                  +{b.surchargeType === 'percent' ? `${b.surchargeValue}%` : `$${Number(b.surchargeValue).toLocaleString('es-AR')}`}
                </span>
              )}
            </div>
            <div className="item-actions">
              <button type="button" className="btn-icon" onClick={() => toggleActive(b)} title={b.active ? 'Desactivar' : 'Activar'}>{b.active ? '✓' : '✗'}</button>
              <button type="button" className="btn-icon" onClick={() => editBarber(b)}>✏</button>
              <button type="button" className="btn-icon btn-danger" onClick={() => deleteBarber(b._id)}>🗑</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
