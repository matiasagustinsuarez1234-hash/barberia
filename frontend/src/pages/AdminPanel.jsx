import { useEffect, useState } from 'react';
import { QRCode } from 'react-qr-code';
import api from '../utils/api';
import { useAuth } from '../context/AuthProvider';

const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
const STATUS_LABEL = { pending: 'Pendiente', confirmed: 'Confirmado', cancelled: 'Cancelado' };
const STATUS_CLASS = { pending: 'badge-pending', confirmed: 'badge-confirmed', cancelled: 'badge-cancelled' };
const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace('/api', '');

const SUPER_TABS = ['Barberias', 'Admins'];
const SHOP_TABS = ['Turnos', 'Barberos', 'Actividades', 'Horarios', 'Clientes', 'Configuracion', 'WhatsApp'];

export default function AdminPanel() {
  const { role } = useAuth();
  const isSuperAdmin = role === 'superadmin';
  const tabs = isSuperAdmin ? SUPER_TABS : SHOP_TABS;
  const [tab, setTab] = useState(tabs[0]);

  return (
    <div className="admin-card">
      <h1>Panel {isSuperAdmin ? 'Super Admin' : 'Admin'}</h1>
      <div className="tabs">
        {tabs.map((t) => (
          <button key={t} type="button" className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      <div className="tab-content">
        {isSuperAdmin ? (
          <>
            {tab === 'Barberias' && <TabBarberias />}
            {tab === 'Admins' && <TabAdmins />}
          </>
        ) : (
          <>
            {tab === 'Turnos' && <TabTurnos />}
            {tab === 'Barberos' && <TabBarberos />}
            {tab === 'Actividades' && <TabActividades />}
            {tab === 'Horarios' && <TabHorarios />}
            {tab === 'Clientes' && <TabClientes />}
            {tab === 'Configuracion' && <TabConfig />}
            {tab === 'WhatsApp' && <TabWhatsApp />}
          </>
        )}
      </div>
    </div>
  );
}

/* ======= BARBERIAS (superadmin) ======= */
function TabBarberias() {
  const [shops, setShops] = useState([]);
  const emptyForm = { name: '', slug: '', cuit: '', address: '', whatsappNumber: '' };
  const [form, setForm] = useState(emptyForm);
  const [imageFile, setImageFile] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [editing, setEditing] = useState(null);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState('');

  const load = () => api.get('/shops').then((r) => setShops(r.data.shops)).catch(() => {});
  useEffect(() => { load(); }, []);

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg('');
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v); });
    if (imageFile) fd.append('image', imageFile);
    if (logoFile) fd.append('logo', logoFile);
    try {
      editing ? await api.put(`/shops/${editing}`, fd) : await api.post('/shops', fd);
      setForm(emptyForm);
      setImageFile(null);
      setLogoFile(null);
      setEditing(null);
      setMsg(editing ? 'Barberia actualizada' : 'Barberia creada');
      setMsgType('success');
      load();
    } catch (err) {
      setMsg(err.response?.data?.msg || 'Error');
      setMsgType('error');
    }
  };

  const editShop = (s) => {
    setEditing(s._id);
    setForm({ name: s.name, slug: s.slug || '', cuit: s.cuit || '', address: s.address || '', whatsappNumber: s.whatsappNumber || '' });
    setImageFile(null);
    setLogoFile(null);
    setMsg('');
  };

  const cancelEdit = () => { setEditing(null); setForm(emptyForm); setImageFile(null); setLogoFile(null); setMsg(''); };

  const toggleActive = async (s) => { await api.put(`/shops/${s._id}`, { active: !s.active }); load(); };

  const deleteShop = async (id) => {
    if (!confirm('Eliminar barberia? Esta accion no se puede deshacer.')) return;
    await api.delete(`/shops/${id}`);
    load();
  };

  return (
    <div>
      <form className="admin-form" onSubmit={handleSubmit}>
        <h3>{editing ? 'Editar Barberia' : 'Nueva Barberia'}</h3>
        <input name="name" placeholder="Nombre *" value={form.name} onChange={handleChange} required />
        <div className="slug-field">
          <input
            name="slug"
            placeholder="Identificador URL (ej: barberia01)"
            value={form.slug}
            onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
            title="Solo letras minusculas, numeros y guiones"
          />
          {form.slug && (
            <small className="slug-preview">URL de turnos: <strong>/{form.slug}/turnos</strong></small>
          )}
        </div>
        <input name="cuit" placeholder="CUIT / CUIL / DNI" value={form.cuit} onChange={handleChange} />
        <input name="address" placeholder="Domicilio" value={form.address} onChange={handleChange} />
        <input name="whatsappNumber" placeholder="WhatsApp (ej: 5491100000000)" value={form.whatsappNumber} onChange={handleChange} />
        <div className="file-upload-row">
          <label className="file-upload-label">
            <span>Imagen de la barberia</span>
            <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files[0] || null)} />
            <span className="file-name-hint">{imageFile ? imageFile.name : 'Sin archivo seleccionado'}</span>
          </label>
          <label className="file-upload-label">
            <span>Logo</span>
            <input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files[0] || null)} />
            <span className="file-name-hint">{logoFile ? logoFile.name : 'Sin archivo seleccionado'}</span>
          </label>
        </div>
        <div className="form-actions">
          <button type="submit" className="btn-confirm">{editing ? 'Guardar Cambios' : 'Crear Barberia'}</button>
          {editing && <button type="button" className="btn-secondary" onClick={cancelEdit}>Cancelar</button>}
        </div>
        {msg && <p className={msgType === 'success' ? 'success-text' : 'error-text'}>{msg}</p>}
      </form>

      <div className="admin-list">
        {shops.length === 0 && <p className="empty-msg">No hay barberias registradas.</p>}
        {shops.map((s) => (
          <div key={s._id} className={`admin-list-item shop-item ${!s.active ? 'inactive' : ''}`}>
            <div className="shop-item-thumbs">
              {s.logo && <img src={`${API_BASE}${s.logo}`} alt="logo" className="shop-thumb" />}
              {!s.logo && s.image && <img src={`${API_BASE}${s.image}`} alt="imagen" className="shop-thumb" />}
            </div>
            <div className="shop-item-info">
              <strong>{s.name}</strong>
              {s.slug && <span className="tag-list slug-tag">/{s.slug}/turnos</span>}
              {s.cuit && <span className="tag-list">CUIT/DNI: {s.cuit}</span>}
              {s.address && <span className="tag-list">{s.address}</span>}
              {!s.active && <span className="tag-list tag-inactive">Inactiva</span>}
            </div>
            <div className="item-actions">
              <button type="button" className="btn-icon" onClick={() => toggleActive(s)} title={s.active ? 'Desactivar' : 'Activar'}>
                {s.active ? '✓' : '✗'}
              </button>
              <button type="button" className="btn-icon" onClick={() => editShop(s)}>✏</button>
              <button type="button" className="btn-icon btn-danger" onClick={() => deleteShop(s._id)}>🗑</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ======= ADMINS (superadmin) ======= */
function TabAdmins() {
  const [admins, setAdmins] = useState([]);
  const [shops, setShops] = useState([]);
  const emptyForm = { username: '', password: '', shop: '' };
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState('');

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
          <option value="">Seleccionar barberia *</option>
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
          <div key={a._id} className="admin-list-item">
            <div>
              <strong>@{a.username}</strong>
              <span className="tag-list">{a.shop ? a.shop.name : <em>Sin barberia asignada</em>}</span>
            </div>
            <div className="item-actions">
              <button type="button" className="btn-icon" onClick={() => editAdmin(a)}>✏</button>
              <button type="button" className="btn-icon btn-danger" onClick={() => deleteAdmin(a._id)}>🗑</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ======= TURNOS (shopadmin) ======= */
function TabTurnos() {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    api.get('/reservations').then((r) => setReservations(r.data.reservations)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const changeStatus = async (id, status) => {
    await api.patch(`/reservations/${id}/status`, { status });
    setReservations((prev) => prev.map((r) => r._id === id ? { ...r, status } : r));
  };

  const visible = filter === 'all' ? reservations : reservations.filter((r) => r.status === filter);

  if (loading) return <p>Cargando...</p>;

  return (
    <div>
      <div className="filter-bar">
        {['all', 'pending', 'confirmed', 'cancelled'].map((f) => (
          <button key={f} type="button" className={`filter-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {f === 'all' ? 'Todos' : STATUS_LABEL[f]}
          </button>
        ))}
      </div>
      {visible.length === 0 ? <p className="empty-msg">Sin turnos.</p> : (
        <div className="reservations-list">
          {visible.map((r) => (
            <div key={r._id} className={`reservation-item ${r.status}`}>
              <div className="reservation-header">
                <span className="reservation-date">{r.date} - {r.time}</span>
                <span className={`badge ${STATUS_CLASS[r.status]}`}>{STATUS_LABEL[r.status]}</span>
              </div>
              <div className="reservation-body">
                <strong>{r.client?.name}</strong> &mdash; {r.activity?.title} con {r.barber?.name}
              </div>
              {r.status !== 'cancelled' && (
                <div className="reservation-actions">
                  {r.status === 'pending' && (
                    <button type="button" className="btn-small btn-confirm-sm" onClick={() => changeStatus(r._id, 'confirmed')}>Confirmar</button>
                  )}
                  <button type="button" className="btn-small btn-cancel-sm" onClick={() => changeStatus(r._id, 'cancelled')}>Cancelar</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ======= BARBEROS (shopadmin) ======= */
function TabBarberos() {
  const [barbers, setBarbers] = useState([]);
  const [form, setForm] = useState({ name: '', whatsapp: '', specialties: '' });
  const [editing, setEditing] = useState(null);
  const [msg, setMsg] = useState('');

  const load = () => api.get('/barbers').then((r) => setBarbers(r.data.barbers)).catch(() => {});
  useEffect(() => { load(); }, []);
  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg('');
    const payload = { ...form, specialties: form.specialties.split(',').map((s) => s.trim()).filter(Boolean) };
    try {
      editing ? await api.put(`/barbers/${editing}`, payload) : await api.post('/barbers', payload);
      setForm({ name: '', whatsapp: '', specialties: '' });
      setEditing(null);
      load();
    } catch (err) { setMsg(err.response?.data?.msg || 'Error'); }
  };

  const editBarber = (b) => { setEditing(b._id); setForm({ name: b.name, whatsapp: b.whatsapp || '', specialties: (b.specialties || []).join(', ') }); };
  const toggleActive = async (b) => { await api.put(`/barbers/${b._id}`, { active: !b.active }); load(); };
  const deleteBarber = async (id) => { if (!confirm('Eliminar barbero?')) return; await api.delete(`/barbers/${id}`); load(); };

  return (
    <div>
      <form className="admin-form" onSubmit={handleSubmit}>
        <h3>{editing ? 'Editar Barbero' : 'Nuevo Barbero'}</h3>
        <input name="name" placeholder="Nombre *" value={form.name} onChange={handleChange} required />
        <input name="whatsapp" placeholder="WhatsApp (ej: 5491100000000)" value={form.whatsapp} onChange={handleChange} />
        <input name="specialties" placeholder="Especialidades (separadas por coma)" value={form.specialties} onChange={handleChange} />
        <div className="form-actions">
          <button type="submit" className="btn-confirm">{editing ? 'Guardar' : 'Agregar'}</button>
          {editing && <button type="button" className="btn-secondary" onClick={() => { setEditing(null); setForm({ name: '', whatsapp: '', specialties: '' }); }}>Cancelar</button>}
        </div>
        {msg && <p className="error-text">{msg}</p>}
      </form>
      <div className="admin-list">
        {barbers.map((b) => (
          <div key={b._id} className={`admin-list-item ${!b.active ? 'inactive' : ''}`}>
            <div><strong>{b.name}</strong>{b.specialties?.length > 0 && <span className="tag-list">{b.specialties.join(', ')}</span>}</div>
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

/* ======= ACTIVIDADES (shopadmin) ======= */
function TabActividades() {
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

  const editActivity = (a) => { setEditing(a._id); setForm({ title: a.title, description: a.description || '', durationMinutes: a.durationMinutes, price: a.price }); };
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

/* ======= HORARIOS (shopadmin) ======= */
function TabHorarios() {
  const [schedules, setSchedules] = useState([]);
  const [barbers, setBarbers] = useState([]);
  const [form, setForm] = useState({ barber: '', weekdays: [], startTime: '10:00', endTime: '20:00', slotMinutes: 30 });
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState('error');

  const load = () => {
    api.get('/schedules').then((r) => setSchedules(r.data.schedules)).catch(() => {});
    api.get('/barbers').then((r) => setBarbers(r.data.barbers)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const toggleWeekday = (day) => {
    setForm((p) => ({
      ...p,
      weekdays: p.weekdays.includes(day)
        ? p.weekdays.filter((d) => d !== day)
        : [...p.weekdays, day],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg('');
    if (form.weekdays.length === 0) {
      setMsgType('error');
      setMsg('Selecciona al menos un dia');
      return;
    }
    const errors = [];
    for (const weekday of [...form.weekdays].sort()) {
      try {
        await api.post('/schedules', { ...form, weekday });
      } catch (err) {
        errors.push(`${WEEKDAYS[weekday]}: ${err.response?.data?.msg || 'Error'}`);
      }
    }
    if (errors.length > 0) {
      setMsgType('error');
      setMsg(errors.join(' | '));
    } else {
      setMsgType('success');
      setMsg('Horarios guardados correctamente');
    }
    setForm((p) => ({ ...p, weekdays: [], startTime: '10:00', endTime: '20:00', slotMinutes: 30 }));
    load();
  };

  const deleteSchedule = async (id) => { if (!confirm('Eliminar horario?')) return; await api.delete(`/schedules/${id}`); load(); };

  return (
    <div>
      <form className="admin-form" onSubmit={handleSubmit}>
        <h3>Asignar Horario</h3>
        <select name="barber" value={form.barber} onChange={handleChange} required>
          <option value="">Seleccionar barbero *</option>
          {barbers.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
        </select>
        <div className="weekday-chips">
          {WEEKDAYS.map((d, i) => (
            <label key={i} className={`weekday-chip ${form.weekdays.includes(i) ? 'selected' : ''}`}>
              <input type="checkbox" checked={form.weekdays.includes(i)} onChange={() => toggleWeekday(i)} />
              {d}
            </label>
          ))}
        </div>
        <div className="form-row">
          <label>Inicio<input name="startTime" type="time" value={form.startTime} onChange={handleChange} /></label>
          <label>Fin<input name="endTime" type="time" value={form.endTime} onChange={handleChange} /></label>
          <label>Slot (min)<input name="slotMinutes" type="number" value={form.slotMinutes} onChange={handleChange} /></label>
        </div>
        <button type="submit" className="btn-confirm">Guardar Horario</button>
        {msg && <p className={msgType === 'success' ? 'success-text' : 'error-text'}>{msg}</p>}
      </form>
      <div className="admin-list">
        {schedules.map((s) => (
          <div key={s._id} className="admin-list-item">
            <div>
              <strong>{s.barber?.name}</strong> &mdash;
              <span className="tag-list">{WEEKDAYS[s.weekday]}: {s.startTime} - {s.endTime} ({s.slotMinutes} min)</span>
            </div>
            <div className="item-actions">
              <button type="button" className="btn-icon btn-danger" onClick={() => deleteSchedule(s._id)}>🗑</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ======= CLIENTES (shopadmin) ======= */
function TabClientes() {
  const [clients, setClients] = useState([]);
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
      <div className="admin-list">
        {clients.length === 0 && <p className="empty-msg">Sin clientes aun.</p>}
        {clients.map((c) => (
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
      </div>
    </div>
  );
}

/* ======= CONFIG (shopadmin) ======= */
function TabConfig() {
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

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
    </div>
  );
}

/* ======= WHATSAPP (shopadmin) ======= */
function TabWhatsApp() {
  const [status, setStatus] = useState('disconnected');
  const [qrValue, setQrValue] = useState(null);

  const poll = async () => {
    try {
      const res = await api.get('/whatsapp/status');
      setStatus(res.data.status);
      if (res.data.status === 'qr') {
        const qrRes = await api.get('/whatsapp/qr');
        setQrValue(qrRes.data.qr);
      } else {
        setQrValue(null);
      }
    } catch { /* ignore */ }
  };

  useEffect(() => {
    poll();
  }, []);

  useEffect(() => {
    if (status === 'ready' || status === 'disconnected') return;
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [status]);

  const handleConnect = async () => {
    setStatus('connecting');
    try {
      await api.post('/whatsapp/connect');
      poll();
    } catch { setStatus('disconnected'); }
  };

  const handleDisconnect = async () => {
    try {
      await api.post('/whatsapp/disconnect');
      setStatus('disconnected');
      setQrValue(null);
    } catch { /* ignore */ }
  };

  return (
    <div className="whatsapp-tab">
      <h3>Conexion WhatsApp</h3>
      {status === 'ready' && (
        <div className="wa-connected">
          <p className="success-text">WhatsApp conectado</p>
          <button type="button" className="btn-secondary" onClick={handleDisconnect}>Desconectar</button>
        </div>
      )}
      {status === 'disconnected' && (
        <div className="wa-disconnected">
          <p>No hay una sesion de WhatsApp activa.</p>
          <button type="button" className="btn-confirm" onClick={handleConnect}>Conectar WhatsApp</button>
        </div>
      )}
      {(status === 'connecting' || status === 'qr') && (
        <div className="wa-qr">
          {status === 'connecting' && !qrValue && <p>Iniciando conexion...</p>}
          {qrValue && (
            <>
              <p>Escaneá este QR con WhatsApp para vincular tu cuenta:</p>
              <div className="qr-wrapper">
                <QRCode value={qrValue} size={220} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
