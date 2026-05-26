import { useEffect, useState } from 'react';
import api from '../../utils/api';

export default function TabBarberos() {
  const [barbers, setBarbers]           = useState([]);
  const [activities, setActivities]     = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [form, setForm]                 = useState({ name: '', whatsapp: '', specialties: '', surchargeType: 'none', surchargeValue: 0 });
  const [editing, setEditing]           = useState(null);
  const [msg, setMsg]                   = useState('');
  const [msgType, setMsgType]           = useState('error');
  const [actPanel, setActPanel]         = useState(null); // id del barbero con panel de actividades abierto
  const [actSaving, setActSaving]       = useState(false);

  const load = () => {
    api.get('/barbers').then((r) => setBarbers(r.data.barbers)).catch(() => {});
    api.get('/activities').then((r) => setActivities(r.data.activities || [])).catch(() => {});
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
      load();
    } catch (err) { setMsg(err.response?.data?.msg || 'Error'); setMsgType('error'); }
  };

  const editBarber = (b) => {
    setEditing(b._id);
    setActPanel(null);
    setForm({ name: b.name, whatsapp: b.whatsapp || '', specialties: (b.specialties || []).join(', '), surchargeType: b.surchargeType || 'none', surchargeValue: b.surchargeValue || 0 });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleActive  = async (b) => { await api.put(`/barbers/${b._id}`, { active: !b.active }); load(); };
  const deleteBarber  = async (id) => { if (!confirm('Eliminar barbero?')) return; await api.delete(`/barbers/${id}`); load(); };

  // ── Actividades del barbero ──────────────────────────────────────────────
  const toggleActPanel = (barberId) => setActPanel(actPanel === barberId ? null : barberId);

  const handleToggleActivity = async (barber, actId) => {
    const current = barber.activities?.map(a => typeof a === 'object' ? a._id : a) || [];
    const next    = current.includes(actId)
      ? current.filter(id => id !== actId)
      : [...current, actId];
    setActSaving(true);
    try {
      await api.put(`/barbers/${barber._id}`, { activities: next });
      load();
    } catch { /* */ }
    setActSaving(false);
  };

  const maxBarbers = subscription?.plan?.maxBarbers;
  const atLimit    = subscription && barbers.length >= maxBarbers;
  const overLimit  = subscription && barbers.length > maxBarbers;

  return (
    <div>
      {subscription && (
        <div className={`plan-banner ${atLimit ? 'plan-banner-limit' : ''}`}>
          <div>
            <span>Plan: <strong>{subscription.plan?.name}</strong> &mdash; {barbers.length} / {maxBarbers} profesional{maxBarbers !== 1 ? 'es' : ''}</span>
            {subscription.plan?.includesReminders && <span className="plan-tag">Con recordatorios</span>}
            {overLimit && (
              <p className="plan-over-msg">
                Tenés {barbers.length} profesionales cargados pero tu plan actual cubre hasta {maxBarbers}.
                Contactá al administrador para regularizar tu plan.
              </p>
            )}
          </div>
        </div>
      )}

      <form className="admin-form" onSubmit={handleSubmit}>
        <h3>{editing ? 'Editar Profesional' : 'Nuevo Profesional'}</h3>
        <input name="name" placeholder="Nombre *" value={form.name} onChange={handleChange} required />
        {/* <input name="whatsapp" placeholder="WhatsApp (ej: 5491100000000)" value={form.whatsapp} onChange={handleChange} /> */}
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
          {editing && (
            <button type="button" className="btn-secondary" onClick={() => { setEditing(null); setForm({ name: '', whatsapp: '', specialties: '', surchargeType: 'none', surchargeValue: 0 }); }}>
              Cancelar
            </button>
          )}
        </div>
        {msg && <p className={msgType === 'error' ? 'error-text' : 'success-text'}>{msg}</p>}
      </form>

      <div className="admin-list">
        {barbers.map((b) => {
          const barberActIds = (b.activities || []).map(a => typeof a === 'object' ? a._id : a);
          const isOpen       = actPanel === b._id;

          return (
            <div key={b._id} className={`admin-list-item barber-item ${!b.active ? 'inactive' : ''}`}>
              <div className="barber-item-top">
                <div>
                  <strong>{b.name}</strong>
                  {b.specialties?.length > 0 && <span className="tag-list">{b.specialties.join(', ')}</span>}
                  {b.surchargeType && b.surchargeType !== 'none' && b.surchargeValue > 0 && (
                    <span className="tag-list">
                      +{b.surchargeType === 'percent' ? `${b.surchargeValue}%` : `$${Number(b.surchargeValue).toLocaleString('es-AR')}`}
                    </span>
                  )}
                  {barberActIds.length > 0 && (
                    <span className="tag-list tag-activities">
                      {barberActIds.length} servicio{barberActIds.length !== 1 ? 's' : ''}
                    </span>
                  )}
                  {barberActIds.length === 0 && (
                    <span className="tag-list tag-no-activities">Sin servicios asignados</span>
                  )}
                </div>
                <div className="item-actions">
                  <button
                    type="button"
                    className={`btn-icon${isOpen ? ' active' : ''}`}
                    onClick={() => toggleActPanel(b._id)}
                    title="Servicios que realiza"
                  >✂</button>
                  <button type="button" className="btn-icon" onClick={() => toggleActive(b)} title={b.active ? 'Desactivar' : 'Activar'}>{b.active ? '✓' : '✗'}</button>
                  <button type="button" className="btn-icon" onClick={() => editBarber(b)}>✏</button>
                  <button type="button" className="btn-icon btn-danger" onClick={() => deleteBarber(b._id)}>🗑</button>
                </div>
              </div>

              {/* Panel de actividades */}
              {isOpen && (
                <div className="barber-act-panel">
                  <p className="barber-act-title">Servicios que realiza {b.name.split(' ')[0]}:</p>
                  {activities.length === 0 && <p className="empty-msg">No hay servicios cargados.</p>}
                  <div className="barber-act-grid">
                    {activities.map((act) => {
                      const checked = barberActIds.includes(act._id);
                      return (
                        <label key={act._id} className={`barber-act-item${checked ? ' checked' : ''}`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={actSaving}
                            onChange={() => handleToggleActivity(b, act._id)}
                          />
                          <div className="barber-act-info">
                            <span className="barber-act-name">{act.title}</span>
                            <span className="barber-act-detail">{act.durationMinutes} min · ${Number(act.price).toLocaleString('es-AR')}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
