import { useEffect, useState } from 'react';
import api from '../../utils/api';
import { normalizeArgPhoneAny } from '../../utils/phoneUtils';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace('/api', '');

export default function TabConfig() {
  const [shop, setShop]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [includesWA, setIncludesWA] = useState(false); // plan.includesReminders

  const [waNumber, setWaNumber]   = useState('');
  const [waMsg, setWaMsg]         = useState('');
  const [waMsgType, setWaMsgType] = useState('success');
  const [waLoading, setWaLoading] = useState(false);

  // Notificaciones
  const [notifyAdmin, setNotifyAdmin]   = useState(true);
  const [notifyClient, setNotifyClient] = useState(true);
  const [notifMsg, setNotifMsg]         = useState('');
  const [notifLoading, setNotifLoading] = useState(false);

  // Turnos grupales
  const [allowGroup, setAllowGroup]     = useState(false);
  const [groupMsg, setGroupMsg]         = useState('');
  const [groupLoading, setGroupLoading] = useState(false);

  // Logo
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [logoMsg, setLogoMsg] = useState('');
  const [logoMsgType, setLogoMsgType] = useState('success');
  const [logoLoading, setLogoLoading] = useState(false);

  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwMsg, setPwMsg] = useState('');
  const [pwMsgType, setPwMsgType] = useState('error');
  const [pwLoading, setPwLoading] = useState(false);

  useEffect(() => {
    Promise.all([api.get('/shops'), api.get('/subscriptions/mine')])
      .then(([shopRes, subRes]) => {
        const s = shopRes.data.shops?.[0] || null;
        setShop(s);
        setWaNumber(s?.whatsappNumber ?? '');
        setNotifyAdmin(s?.notifyAdminOnBooking !== false);
        setNotifyClient(s?.notifyClientOnBooking !== false);
        setAllowGroup(s?.allowGroupBooking === true);
        setIncludesWA(subRes.data.subscription?.plan?.includesReminders === true);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleWaSubmit = async (e) => {
    e.preventDefault();
    setWaMsg('');

    let normalized = '';
    if (waNumber.trim()) {
      const { phone, error } = normalizeArgPhoneAny(waNumber);
      if (error) {
        setWaMsgType('error');
        return setWaMsg(error);
      }
      normalized = phone;
    }

    setWaLoading(true);
    try {
      const res = await api.patch(`/shops/${shop._id}/whatsapp-number`, { whatsappNumber: normalized });
      setShop(res.data.shop);
      setWaNumber(res.data.shop.whatsappNumber ?? '');
      setWaMsgType('success');
      setWaMsg(normalized ? 'Número guardado.' : 'Número eliminado.');
    } catch (err) {
      setWaMsgType('error');
      setWaMsg(err.response?.data?.msg || 'Error guardando número');
    } finally {
      setWaLoading(false);
    }
  };

  const handleNotifSubmit = async (e) => {
    e.preventDefault();
    setNotifMsg('');
    setNotifLoading(true);
    try {
      await api.put(`/shops/${shop._id}`, {
        notifyAdminOnBooking: notifyAdmin,
        notifyClientOnBooking: notifyClient,
      });
      setNotifMsg('Preferencias guardadas');
    } catch {
      setNotifMsg('Error guardando preferencias');
    } finally {
      setNotifLoading(false);
    }
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0] || null;
    setLogoFile(file);
    setLogoMsg('');
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setLogoPreview(ev.target.result);
      reader.readAsDataURL(file);
    } else {
      setLogoPreview(null);
    }
  };

  const handleLogoSubmit = async (e) => {
    e.preventDefault();
    if (!logoFile) return;
    setLogoLoading(true);
    setLogoMsg('');
    try {
      const fd = new FormData();
      fd.append('logo', logoFile);
      const res = await api.put(`/shops/${shop._id}`, fd);
      setShop(res.data.shop);
      setLogoFile(null);
      setLogoPreview(null);
      setLogoMsgType('success');
      setLogoMsg('Logo actualizado correctamente');
    } catch (err) {
      setLogoMsgType('error');
      setLogoMsg(err.response?.data?.msg || 'Error subiendo el logo');
    } finally {
      setLogoLoading(false);
    }
  };

  const handleGroupSubmit = async (e) => {
    e.preventDefault();
    setGroupMsg('');
    setGroupLoading(true);
    try {
      await api.put(`/shops/${shop._id}`, { allowGroupBooking: allowGroup });
      setGroupMsg('Preferencia guardada');
    } catch {
      setGroupMsg('Error guardando preferencia');
    } finally {
      setGroupLoading(false);
    }
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

  const currentLogo = shop?.logo || shop?.image;

  return (
    <div>
      {/* ── Logo ── */}
      <h3>Logo del negocio</h3>
      <p className="wa-subtitle">Este logo aparece en la pantalla de turnos que ven tus clientes.</p>
      <div className="logo-config-row">
        <div className="logo-current">
          {currentLogo ? (
            <img src={`${API_BASE}${currentLogo}`} alt="Logo actual" className="logo-preview-img" />
          ) : (
            <div className="logo-placeholder">Sin logo</div>
          )}
          <span className="logo-current-label">Logo actual</span>
        </div>
        <form className="admin-form logo-form" onSubmit={handleLogoSubmit}>
          <label className="file-upload-label">
            <span>Seleccioná una imagen</span>
            <input
              type="file"
              accept="image/*"
              onChange={handleLogoChange}
            />
            <span className="file-name-hint">{logoFile ? logoFile.name : 'Sin archivo seleccionado'}</span>
          </label>
          {logoPreview && (
            <div className="logo-preview-new">
              <img src={logoPreview} alt="Vista previa" className="logo-preview-img" />
              <span className="logo-current-label">Vista previa</span>
            </div>
          )}
          {logoMsg && <p className={logoMsgType === 'success' ? 'success-text' : 'error-text'}>{logoMsg}</p>}
          <button type="submit" className="btn-confirm" disabled={logoLoading || !logoFile}>
            {logoLoading ? 'Subiendo...' : 'Guardar logo'}
          </button>
        </form>
      </div>

      {/* WhatsApp deshabilitado — secciones ocultas temporalmente */}

      {/* ── Tipo de reservas ── */}
      <h3 style={{ marginTop: '28px' }}>Tipo de reservas</h3>
      <p className="wa-subtitle">Definí si tus clientes pueden reservar turnos en grupo desde el booking.</p>
      <form className="admin-form" onSubmit={handleGroupSubmit}>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={allowGroup}
            onChange={(e) => { setAllowGroup(e.target.checked); setGroupMsg(''); }}
          />
          Permitir reservas en grupo
        </label>
        <small className="field-hint">
          {allowGroup
            ? 'Los clientes pueden reservar turnos consecutivos para varias personas.'
            : 'Solo se permiten reservas individuales. La opción grupo aparecerá deshabilitada en el booking.'}
        </small>
        {groupMsg && <p className="success-text">{groupMsg}</p>}
        <button type="submit" className="btn-confirm" disabled={groupLoading}>
          {groupLoading ? 'Guardando...' : 'Guardar'}
        </button>
      </form>

      {/* ── Contraseña ── */}
      <h3 style={{ marginTop: '28px' }}>Cambiar mi clave</h3>
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
