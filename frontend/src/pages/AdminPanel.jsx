import { useEffect, useState } from 'react';
import { QRCode } from 'react-qr-code';
import api from '../utils/api';
import { useAuth } from '../context/AuthProvider';

const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
const STATUS_LABEL = { pending: 'Pendiente', confirmed: 'Confirmado', cancelled: 'Cancelado' };
const STATUS_CLASS = { pending: 'badge-pending', confirmed: 'badge-confirmed', cancelled: 'badge-cancelled' };
const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace('/api', '');

const SUPER_TABS = ['Barberias', 'Admins', 'Planes', 'Suscripciones'];
const SHOP_TABS = ['Turnos', 'Barberos', 'Actividades', 'Horarios', 'Dias Cerrados', 'Clientes', 'Configuracion', 'WhatsApp', 'QR'];

export default function AdminPanel() {
  const { role } = useAuth();
  const isSuperAdmin = role === 'superadmin';
  const tabs = isSuperAdmin ? SUPER_TABS : SHOP_TABS;
  const [tab, setTab] = useState(tabs[0]);
  const [shop, setShop] = useState(null);
  const [shopLoading, setShopLoading] = useState(true);
  const [copyMsg, setCopyMsg] = useState('');

  useEffect(() => {
    if (isSuperAdmin) return;
    api.get('/shops')
      .then((r) => setShop(r.data.shops?.[0] || null))
      .catch(() => {})
      .finally(() => setShopLoading(false));
  }, [isSuperAdmin]);

  const shopUrl = shop?.slug ? `${window.location.origin}/${shop.slug}/turnos` : null;
  const handlePrintQr = () => window.print();
  const handleCopyUrl = async () => {
    if (!shopUrl) return;
    await navigator.clipboard.writeText(shopUrl);
    setCopyMsg('Copiado al portapapeles');
    setTimeout(() => setCopyMsg(''), 2500);
  };

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
            {tab === 'Planes' && <TabPlanes />}
            {tab === 'Suscripciones' && <TabSuscripciones />}
          </>
        ) : (
          <>
            {tab === 'Turnos' && <TabTurnos />}
            {tab === 'Barberos' && <TabBarberos />}
            {tab === 'Actividades' && <TabActividades />}
            {tab === 'Horarios' && <TabHorarios />}
            {tab === 'Dias Cerrados' && <TabDiasCerrados />}
            {tab === 'Clientes' && <TabClientes />}
            {tab === 'Configuracion' && <TabConfig />}
            {tab === 'WhatsApp' && <TabWhatsApp />}
            {tab === 'QR' && <TabQR shop={shop} shopLoading={shopLoading} shopUrl={shopUrl} copyMsg={copyMsg} handleCopyUrl={handleCopyUrl} handlePrintQr={handlePrintQr} />}
          </>
        )}
      </div>
    </div>
  );
}

/* ======= BARBERIAS (superadmin) ======= */
function TabBarberias() {
  const [shops, setShops] = useState([]);
  const emptyForm = { name: '', slug: '', cuit: '', address: '', whatsappNumber: '', areaCode: '11' };
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
    setForm({ name: s.name, slug: s.slug || '', cuit: s.cuit || '', address: s.address || '', whatsappNumber: s.whatsappNumber || '', areaCode: s.areaCode || '11' });
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
        <div className="field-row">
          <label style={{ fontSize: '0.9rem', whiteSpace: 'nowrap' }}>Caracteristica local</label>
          <input
            name="areaCode"
            placeholder="ej: 11, 341, 351"
            value={form.areaCode}
            onChange={(e) => setForm((p) => ({ ...p, areaCode: e.target.value.replace(/\D/g, '') }))}
            style={{ width: '100px' }}
            title="Codigo de area sin el 0 inicial. Ej: 11 (CABA), 341 (Rosario), 351 (Cordoba)"
          />
          <small style={{ color: '#888', fontSize: '0.8rem' }}>Sin el 0. Ej: 11, 341, 351, 387</small>
        </div>
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

/* ======= TURNOS (shopadmin) ======= */
function TabTurnos() {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [cancelingId, setCancelingId] = useState(null);
  const [cancelReason, setCancelReason] = useState('');

  useEffect(() => {
    api.get('/reservations').then((r) => setReservations(r.data.reservations)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const changeStatus = async (id, status, reason) => {
    await api.patch(`/reservations/${id}/status`, { status, reason });
    setReservations((prev) => prev.map((r) => r._id === id ? { ...r, status } : r));
  };

  const handleCancel = async (id) => {
    await changeStatus(id, 'cancelled', cancelReason);
    setCancelingId(null);
    setCancelReason('');
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
              {r.cancellationReason && (
                <div className="cancellation-reason">Motivo: {r.cancellationReason}</div>
              )}
              {r.status !== 'cancelled' && (
                <div className="reservation-actions">
                  {r.status === 'pending' && (
                    <button type="button" className="btn-small btn-confirm-sm" onClick={() => changeStatus(r._id, 'confirmed')}>Confirmar</button>
                  )}
                  {cancelingId === r._id ? (
                    <div className="cancel-reason-form">
                      <input
                        type="text"
                        placeholder="Motivo (opcional)"
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        autoFocus
                      />
                      <button type="button" className="btn-small btn-cancel-sm" onClick={() => handleCancel(r._id)}>Confirmar cancelacion</button>
                      <button type="button" className="btn-small" onClick={() => { setCancelingId(null); setCancelReason(''); }}>Volver</button>
                    </div>
                  ) : (
                    <button type="button" className="btn-small btn-cancel-sm" onClick={() => setCancelingId(r._id)}>Cancelar</button>
                  )}
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
      setForm({ name: '', whatsapp: '', specialties: '' });
      setEditing(null);
      setMsg('');
      load();
    } catch (err) { setMsg(err.response?.data?.msg || 'Error'); setMsgType('error'); }
  };

  const editBarber = (b) => { setEditing(b._id); setForm({ name: b.name, whatsapp: b.whatsapp || '', specialties: (b.specialties || []).join(', '), surchargeType: b.surchargeType || 'none', surchargeValue: b.surchargeValue || 0 }); };
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

/* ======= DIAS CERRADOS (shopadmin) ======= */
function TabDiasCerrados() {
  const [closedDays, setClosedDays] = useState([]);
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState('error');
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState(null); // { date, reason, count, reservations }

  const load = () => api.get('/closed-days').then((r) => setClosedDays(r.data.closedDays)).catch(() => {});
  useEffect(() => { load(); }, []);

  const handleCheck = async (e) => {
    e.preventDefault();
    setMsg('');
    if (!date) return setMsg('Selecciona una fecha');
    setLoading(true);
    try {
      const resp = await api.get(`/closed-days/check?date=${date}`);
      setConfirm({ date, reason, count: resp.data.count, reservations: resp.data.reservations });
    } catch (err) {
      setMsg(err.response?.data?.msg || 'Error verificando turnos');
      setMsgType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const resp = await api.post('/closed-days', { date: confirm.date, reason: confirm.reason });
      setMsgType('success');
      setMsg(
        resp.data.cancelledCount > 0
          ? `Dia cerrado. Se cancelaron ${resp.data.cancelledCount} turno${resp.data.cancelledCount !== 1 ? 's' : ''} y los clientes fueron notificados.`
          : 'Dia marcado como cerrado. No habia turnos pendientes.'
      );
      setDate('');
      setReason('');
      setConfirm(null);
      load();
    } catch (err) {
      setMsg(err.response?.data?.msg || 'Error cerrando el dia');
      setMsgType('error');
      setConfirm(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    await api.delete(`/closed-days/${id}`);
    load();
  };

  return (
    <div>
      {!confirm ? (
        <form className="admin-form" onSubmit={handleCheck}>
          <h3>Marcar dia no laborable</h3>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            required
          />
          <input
            type="text"
            placeholder="Motivo (opcional, se envia a los clientes)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          {msg && <p className={msgType === 'success' ? 'success-text' : 'error-text'}>{msg}</p>}
          <button type="submit" className="btn-confirm" disabled={loading}>
            {loading ? 'Verificando...' : 'Continuar'}
          </button>
        </form>
      ) : (
        <div className="admin-form">
          <h3>Confirmar cierre del dia</h3>
          <p><strong>Fecha:</strong> {confirm.date}</p>
          {confirm.reason && <p><strong>Motivo:</strong> {confirm.reason}</p>}
          {confirm.count > 0 ? (
            <>
              <p className="error-text">
                Hay <strong>{confirm.count} turno{confirm.count !== 1 ? 's' : ''} pactado{confirm.count !== 1 ? 's' : ''}</strong> para este dia.
                Al confirmar, se cancelaran automaticamente y los clientes seran notificados por WhatsApp.
              </p>
              <div className="admin-list" style={{ marginBottom: '12px' }}>
                {confirm.reservations.map((r) => (
                  <div key={r._id} className="admin-list-item">
                    <div>
                      <strong>{r.client?.name}</strong>
                      <span className="tag-list">{r.time} — {r.activity?.title} con {r.barber?.name}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="success-text">No hay turnos pactados para este dia.</p>
          )}
          <div className="form-actions">
            <button type="button" className="btn-confirm" onClick={handleConfirm} disabled={loading}>
              {loading ? 'Procesando...' : 'Si, cerrar el dia'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setConfirm(null)}>Cancelar</button>
          </div>
        </div>
      )}

      <h3 style={{ marginTop: '24px' }}>Dias cerrados programados</h3>
      <div className="admin-list">
        {closedDays.length === 0 && <p className="empty-msg">No hay dias cerrados programados.</p>}
        {closedDays.map((d) => (
          <div key={d._id} className="admin-list-item">
            <div>
              <strong>{d.date}</strong>
              {d.reason && <span className="tag-list">{d.reason}</span>}
            </div>
            <div className="item-actions">
              <button type="button" className="btn-icon btn-danger" title="Reabrir dia" onClick={() => handleDelete(d._id)}>🗑</button>
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

function TabQR({ shop, shopLoading, shopUrl, copyMsg, handleCopyUrl, handlePrintQr }) {
  return (
    <div className="qr-tab">
      <h3>QR para pedir turnos</h3>
      <p>Imprimí o compartí este código para que tus clientes lleguen directo a tu página de reservas.</p>
      <div className="qr-card">
        <div className="qr-card-header">
          <div>
            <p className="qr-label">URL pública</p>
            {shopLoading ? (
              <p>Cargando barbería...</p>
            ) : shop ? (
              <p className="qr-url">{shopUrl}</p>
            ) : (
              <p>No hay slug definido para tu barbería.</p>
            )}
          </div>
          <div className="qr-actions">
            <button type="button" className="btn-confirm-sm" onClick={handlePrintQr} disabled={shopLoading || !shopUrl}>Imprimir QR</button>
            <button type="button" className="btn-secondary" onClick={handleCopyUrl} disabled={!shopUrl}>Copiar enlace</button>
          </div>
        </div>
        <div className="qr-card-body">
          <div className="qr-preview">
            {shopUrl ? (
              <QRCode value={shopUrl} size={180} />
            ) : (
              <p>Definí un slug en la barbería para generar la URL de turnos.</p>
            )}
          </div>
          {copyMsg && <div className="copy-msg">{copyMsg}</div>}
        </div>
      </div>
    </div>
  );
}

/* ======= PLANES (superadmin) ======= */
function TabPlanes() {
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

/* ======= SUSCRIPCIONES (superadmin) ======= */
function TabSuscripciones() {
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
          <option value="">Seleccionar barberia *</option>
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
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
