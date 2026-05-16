import { useEffect, useState } from 'react';
import api from '../../utils/api';

export default function TabPlanes() {
  const [plans, setPlans] = useState([]);
  const emptyForm = { name: '', description: '', price: '', maxBarbers: 1, includesReminders: false };
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState('');

  const load = () => api.get('/plans').then((r) => setPlans(r.data.plans)).catch(() => {});
  useEffect(() => { load(); }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((p) => ({ ...p, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg('');
    try {
      const payload = { ...form, price: Number(form.price), maxBarbers: Number(form.maxBarbers) };
      editing ? await api.put(`/plans/${editing}`, payload) : await api.post('/plans', payload);
      setForm(emptyForm);
      setEditing(null);
      setMsg(editing ? 'Plan actualizado' : 'Plan creado');
      setMsgType('success');
      load();
    } catch (err) {
      setMsg(err.response?.data?.msg || 'Error');
      setMsgType('error');
    }
  };

  const editPlan = (p) => {
    setEditing(p._id);
    setForm({ name: p.name, description: p.description || '', price: p.price, maxBarbers: p.maxBarbers, includesReminders: p.includesReminders });
    setMsg('');
  };

  const deletePlan = async (id) => {
    if (!confirm('Eliminar plan? Las barberias con este plan quedarán sin plan asignado.')) return;
    await api.delete(`/plans/${id}`);
    load();
  };

  return (
    <div>
      <form className="admin-form" onSubmit={handleSubmit}>
        <h3>{editing ? 'Editar Plan' : 'Nuevo Plan'}</h3>
        <input name="name" placeholder="Nombre del plan *" value={form.name} onChange={handleChange} required />
        <input name="description" placeholder="Descripcion (opcional)" value={form.description} onChange={handleChange} />
        <input name="price" type="number" min="0" placeholder="Precio mensual (ARS) *" value={form.price} onChange={handleChange} required />
        <div className="field-row">
          <label>Max. barberos</label>
          <input name="maxBarbers" type="number" min="1" value={form.maxBarbers} onChange={handleChange} required style={{ width: '80px' }} />
        </div>
        <label className="checkbox-label">
          <input name="includesReminders" type="checkbox" checked={form.includesReminders} onChange={handleChange} />
          Incluye recordatorios por WhatsApp
        </label>
        <div className="form-actions">
          <button type="submit" className="btn-confirm">{editing ? 'Guardar Cambios' : 'Crear Plan'}</button>
          {editing && <button type="button" className="btn-secondary" onClick={() => { setEditing(null); setForm(emptyForm); setMsg(''); }}>Cancelar</button>}
        </div>
        {msg && <p className={msgType === 'success' ? 'success-text' : 'error-text'}>{msg}</p>}
      </form>

      <div className="admin-list">
        {plans.length === 0 && <p className="empty-msg">No hay planes definidos.</p>}
        {plans.map((p) => (
          <div key={p._id} className={`admin-list-item ${!p.active ? 'inactive' : ''}`}>
            <div>
              <strong>{p.name}</strong>
              <span className="tag-list">${p.price.toLocaleString('es-AR')}/mes</span>
              <span className="tag-list">Hasta {p.maxBarbers} barbero{p.maxBarbers !== 1 ? 's' : ''}</span>
              {p.includesReminders && <span className="tag-list plan-tag">Con recordatorios</span>}
              {p.description && <span className="tag-list">{p.description}</span>}
            </div>
            <div className="item-actions">
              <button type="button" className="btn-icon" onClick={() => editPlan(p)}>✏</button>
              <button type="button" className="btn-icon btn-danger" onClick={() => deletePlan(p._id)}>🗑</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
