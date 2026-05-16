import { useEffect, useState } from 'react';
import api from '../../utils/api';

export default function TabActividades() {
  const [activities, setActivities] = useState([]);
  const [form, setForm] = useState({ title: '', description: '', durationMinutes: 45, price: 0 });
  const [editing, setEditing] = useState(null);
  const [msg, setMsg] = useState('');

  const load = () => api.get('/activities').then((r) => setActivities(r.data.activities)).catch(() => {});
  useEffect(() => { load(); }, []);
  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg('');
    try {
      editing ? await api.put(`/activities/${editing}`, form) : await api.post('/activities', form);
      setForm({ title: '', description: '', durationMinutes: 45, price: 0 });
      setEditing(null);
      load();
    } catch (err) { setMsg(err.response?.data?.msg || 'Error'); }
  };

  const editActivity = (a) => {
    setEditing(a._id);
    setForm({ title: a.title, description: a.description || '', durationMinutes: a.durationMinutes, price: a.price });
  };
  const toggleActive = async (a) => { await api.put(`/activities/${a._id}`, { active: !a.active }); load(); };
  const deleteActivity = async (id) => { if (!confirm('Eliminar actividad?')) return; await api.delete(`/activities/${id}`); load(); };

  return (
    <div>
      <form className="admin-form" onSubmit={handleSubmit}>
        <h3>{editing ? 'Editar Actividad' : 'Nueva Actividad'}</h3>
        <input name="title" placeholder="Titulo *" value={form.title} onChange={handleChange} required />
        <input name="description" placeholder="Descripcion" value={form.description} onChange={handleChange} />
        <input name="durationMinutes" type="number" placeholder="Duracion (minutos)" value={form.durationMinutes} onChange={handleChange} />
        <input name="price" type="number" placeholder="Precio" value={form.price} onChange={handleChange} />
        <div className="form-actions">
          <button type="submit" className="btn-confirm">{editing ? 'Guardar' : 'Agregar'}</button>
          {editing && <button type="button" className="btn-secondary" onClick={() => { setEditing(null); setForm({ title: '', description: '', durationMinutes: 45, price: 0 }); }}>Cancelar</button>}
        </div>
        {msg && <p className="error-text">{msg}</p>}
      </form>
      <div className="admin-list">
        {activities.map((a) => (
          <div key={a._id} className={`admin-list-item ${!a.active ? 'inactive' : ''}`}>
            <div>
              <strong>{a.title}</strong>
              <span className="price-tag-sm">${Number(a.price).toLocaleString('es-AR')}</span>
              <span className="tag-list">{a.durationMinutes} min</span>
            </div>
            <div className="item-actions">
              <button type="button" className="btn-icon" onClick={() => toggleActive(a)} title={a.active ? 'Desactivar' : 'Activar'}>{a.active ? '✓' : '✗'}</button>
              <button type="button" className="btn-icon" onClick={() => editActivity(a)}>✏</button>
              <button type="button" className="btn-icon btn-danger" onClick={() => deleteActivity(a._id)}>🗑</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
