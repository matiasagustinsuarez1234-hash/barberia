import { useEffect, useState } from 'react';
import api from '../../utils/api';
import { normalizeArgPhoneAny } from '../../utils/phoneUtils';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace('/api', '');

export default function TabEmpresas() {
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

    if (form.whatsappNumber) {
      const { phone: normalizedWa, error: waError } = normalizeArgPhoneAny(form.whatsappNumber);
      if (waError) {
        setMsg(waError);
        setMsgType('error');
        return;
      }
      form.whatsappNumber = normalizedWa;
    }

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
      setMsg(editing ? 'Empresa actualizada' : 'Empresa creada');
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
    if (!confirm('Eliminar empresa?\n\nSe eliminarán en cascada todos sus barberos, actividades, turnos, horarios y suscripciones.\n\nEsta accion NO se puede deshacer.')) return;
    await api.delete(`/shops/${id}`);
    load();
  };

  return (
    <div>
      <form className="admin-form" onSubmit={handleSubmit}>
        <h3>{editing ? 'Editar Empresa' : 'Nueva Empresa'}</h3>
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
          <button type="submit" className="btn-confirm">{editing ? 'Guardar Cambios' : 'Crear Empresa'}</button>
          {editing && <button type="button" className="btn-secondary" onClick={cancelEdit}>Cancelar</button>}
        </div>
        {msg && <p className={msgType === 'success' ? 'success-text' : 'error-text'}>{msg}</p>}
      </form>

      <div className="admin-list">
        {shops.length === 0 && <p className="empty-msg">No hay empresas registradas.</p>}
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
