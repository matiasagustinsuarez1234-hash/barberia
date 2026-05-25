import { useEffect, useState } from 'react';
import api from '../../utils/api';

export default function TabClientes() {
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ name: '', username: '', password: '', phone: '', email: '' });
  const [editing, setEditing] = useState(null);
  const [msg, setMsg] = useState('');

  const load = () => api.get('/clients').then((r) => setClients(r.data.clients)).catch(() => {});
  useEffect(() => { load(); }, []);
  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg('');
    try {
      if (editing) {
        const { username, ...updateData } = form;
        if (!updateData.password) delete updateData.password;
        await api.put(`/clients/${editing}`, updateData);
      } else {
        await api.post('/clients', form);
      }
      setForm({ name: '', username: '', password: '', phone: '', email: '' });
      setEditing(null);
      load();
    } catch (err) { setMsg(err.response?.data?.msg || 'Error'); }
  };

  const editClient = (c) => {
    setEditing(c._id);
    setForm({ name: c.name, username: c.username, password: '', phone: c.phone || '', email: c.email || '' });
  };

  const deleteClient = async (id) => { if (!confirm('Eliminar cliente?')) return; await api.delete(`/clients/${id}`); load(); };

  return (
    <div>
      <form className="admin-form" onSubmit={handleSubmit}>
        <h3>{editing ? 'Editar Cliente' : 'Nuevo Cliente'}</h3>
        <input name="name" placeholder="Nombre *" value={form.name} onChange={handleChange} required />
        {!editing && <input name="username" placeholder="Usuario *" value={form.username} onChange={handleChange} required />}
        <input name="password" type="password" placeholder={editing ? 'Nueva contrasena (dejar vacio para no cambiar)' : 'Contrasena *'} value={form.password} onChange={handleChange} required={!editing} />
        <input name="phone" placeholder="Telefono" value={form.phone} onChange={handleChange} />
        <input name="email" type="email" placeholder="Email" value={form.email} onChange={handleChange} />
        <div className="form-actions">
          <button type="submit" className="btn-confirm">{editing ? 'Guardar' : 'Crear Cliente'}</button>
          {editing && <button type="button" className="btn-secondary" onClick={() => { setEditing(null); setForm({ name: '', username: '', password: '', phone: '', email: '' }); }}>Cancelar</button>}
        </div>
        {msg && <p className="error-text">{msg}</p>}
      </form>
      <div className="client-search-bar">
        <input
          type="text"
          placeholder="Buscar por nombre..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button type="button" onClick={() => setSearch('')}>✕</button>
        )}
      </div>

      <div className="admin-list">
        {clients.length === 0 && <p className="empty-msg">Sin clientes aun.</p>}
        {clients
          .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
          .map((c) => (
          <div key={c._id} className="admin-list-item">
            <div>
              <strong>{c.name}</strong>
              <span className="tag-list">@{c.username}</span>
              {c.phone && <span className="tag-list">{c.phone}</span>}
            </div>
            <div className="item-actions">
              <button type="button" className="btn-icon" onClick={() => editClient(c)}>✏</button>
              <button type="button" className="btn-icon btn-danger" onClick={() => deleteClient(c._id)}>🗑</button>
            </div>
          </div>
        ))}
        {clients.length > 0 && search && clients.filter((c) => c.name.toLowerCase().includes(search.toLowerCase())).length === 0 && (
          <p className="empty-msg">Sin resultados para "{search}".</p>
        )}
      </div>
    </div>
  );
}
