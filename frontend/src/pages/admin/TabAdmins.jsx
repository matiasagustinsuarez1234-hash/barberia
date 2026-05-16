import { useEffect, useState } from 'react';
import api from '../../utils/api';

export default function TabAdmins() {
  const [admins, setAdmins] = useState([]);
  const [shops, setShops] = useState([]);
  const emptyForm = { username: '', password: '', shop: '' };
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState('');
  const [resetingId, setResetingId] = useState(null);
  const [resetPassword, setResetPassword] = useState('');

  const load = () => {
    api.get('/auth/admins').then((r) => setAdmins(r.data.admins.filter((a) => a.role !== 'superadmin'))).catch(() => {});
    api.get('/shops').then((r) => setShops(r.data.shops)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg('');
    try {
      if (editing) {
        const payload = { shop: form.shop };
        if (form.password) payload.password = form.password;
        await api.put(`/auth/admins/${editing}`, payload);
        setMsg('Administrador actualizado');
      } else {
        await api.post('/auth/create-admin', { ...form, role: 'shopadmin' });
        setMsg('Administrador creado');
      }
      setMsgType('success');
      setForm(emptyForm);
      setEditing(null);
      load();
    } catch (err) {
      setMsg(err.response?.data?.msg || 'Error');
      setMsgType('error');
    }
  };

  const editAdmin = (a) => {
    setEditing(a._id);
    setForm({ username: a.username, password: '', shop: a.shop?._id || '' });
    setMsg('');
  };

  const cancelEdit = () => { setEditing(null); setForm(emptyForm); setMsg(''); };

  const handleResetPassword = async (id) => {
    if (!resetPassword || resetPassword.length < 6) {
      return setMsg('La clave debe tener al menos 6 caracteres');
    }
    try {
      await api.put(`/auth/admins/${id}`, { password: resetPassword });
      setMsg('Clave blanqueada correctamente');
      setMsgType('success');
      setResetingId(null);
      setResetPassword('');
    } catch (err) {
      setMsg(err.response?.data?.msg || 'Error');
      setMsgType('error');
    }
  };

  const deleteAdmin = async (id) => {
    if (!confirm('Eliminar administrador?')) return;
    await api.delete(`/auth/admins/${id}`);
    load();
  };

  return (
    <div>
      <form className="admin-form" onSubmit={handleSubmit}>
        <h3>{editing ? 'Editar Admin Cliente' : 'Nuevo Admin Cliente'}</h3>
        {!editing && (
          <input name="username" placeholder="Usuario *" value={form.username} onChange={handleChange} required />
        )}
        <input
          name="password"
          type="password"
          placeholder={editing ? 'Nueva contrasena (dejar vacio para no cambiar)' : 'Contrasena *'}
          value={form.password}
          onChange={handleChange}
          required={!editing}
        />
        <select name="shop" value={form.shop} onChange={handleChange} required>
          <option value="">Seleccionar empresa *</option>
          {shops.map((s) => (
            <option key={s._id} value={s._id}>{s.name}</option>
          ))}
        </select>
        <div className="form-actions">
          <button type="submit" className="btn-confirm">{editing ? 'Guardar Cambios' : 'Crear Admin'}</button>
          {editing && <button type="button" className="btn-secondary" onClick={cancelEdit}>Cancelar</button>}
        </div>
        {msg && <p className={msgType === 'success' ? 'success-text' : 'error-text'}>{msg}</p>}
      </form>

      <div className="admin-list">
        {admins.length === 0 && <p className="empty-msg">No hay administradores de barberias.</p>}
        {admins.map((a) => (
          <div key={a._id} className="admin-list-item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>@{a.username}</strong>
                <span className="tag-list">{a.shop ? a.shop.name : <em>Sin barberia asignada</em>}</span>
              </div>
              <div className="item-actions">
                <button type="button" className="btn-icon" title="Blanquear clave" onClick={() => { setResetingId(resetingId === a._id ? null : a._id); setResetPassword(''); setMsg(''); }}>🔑</button>
                <button type="button" className="btn-icon" onClick={() => editAdmin(a)}>✏</button>
                <button type="button" className="btn-icon btn-danger" onClick={() => deleteAdmin(a._id)}>🗑</button>
              </div>
            </div>
            {resetingId === a._id && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <input
                  type="password"
                  placeholder="Nueva clave (min. 6 caracteres)"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button type="button" className="btn-confirm" onClick={() => handleResetPassword(a._id)}>Guardar</button>
                <button type="button" className="btn-secondary" onClick={() => { setResetingId(null); setResetPassword(''); }}>Cancelar</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
