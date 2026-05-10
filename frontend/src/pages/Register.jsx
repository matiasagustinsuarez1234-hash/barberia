import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthProvider';
import { normalizeArgPhone } from '../utils/phoneUtils';

export default function Register() {
  const { shopSlug } = useParams();
  const navigate = useNavigate();
  const { setToken, setUserType, setRole } = useAuth();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ name: '', phone: '', email: '' });
  const [areaCode, setAreaCode] = useState('11');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!shopSlug) return;
    api.get(`/public/shops/slug/${shopSlug}`)
      .then((r) => setAreaCode(r.data.shop?.areaCode || '11'))
      .catch(() => {});
  }, [shopSlug]);

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError('');
    const { phone: normalizedPhone, error: phoneError } = normalizeArgPhone(form.phone, areaCode);
    if (phoneError) { setError(phoneError); return; }
    const normalizedForm = { ...form, phone: normalizedPhone };
    setForm(normalizedForm);
    setLoading(true);
    try {
      await api.post('/otp/register/send', normalizedForm);
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.msg || 'Error enviando codigo');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const resp = await api.post('/otp/register/verify', { phone: form.phone, code });
      setToken(resp.data.token);
      setUserType('client');
      setRole('');
      navigate(`/${shopSlug}/mis-turnos`, { replace: true });
    } catch (err) {
      setError(err.response?.data?.msg || 'Codigo incorrecto o expirado');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h2>Crear Cuenta</h2>

        {step === 1 ? (
          <form onSubmit={handleSendOtp}>
            <input
              name="name"
              placeholder="Nombre completo *"
              value={form.name}
              onChange={handleChange}
              required
            />
            <input
              name="phone"
              type="tel"
              placeholder={`Celular * (ej: ${areaCode} 2345-6789)`}
              value={form.phone}
              onChange={handleChange}
              required
            />
            <small className="field-hint">Ingresa tu numero con caracteristica {areaCode} — el codigo de pais se agrega automaticamente.</small>
            <input
              name="email"
              type="email"
              placeholder="Email (opcional)"
              value={form.email}
              onChange={handleChange}
            />
            <button type="submit" disabled={loading}>{loading ? 'Enviando...' : 'Continuar'}</button>
            {error && <p className="error-text">{error}</p>}
          </form>
        ) : (
          <form onSubmit={handleVerify}>
            <p className="otp-info">
              Te enviamos un codigo por WhatsApp al <strong>{form.phone}</strong>.
              Ingresalo para confirmar tu cuenta.
            </p>
            <input
              className="input-otp"
              type="text"
              inputMode="numeric"
              placeholder="Codigo de 6 digitos"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              required
            />
            <button type="submit" disabled={loading}>{loading ? 'Verificando...' : 'Confirmar'}</button>
            {error && <p className="error-text">{error}</p>}
            <button
              type="button"
              className="btn-link"
              onClick={() => { setStep(1); setCode(''); setError(''); }}
            >
              Cambiar datos
            </button>
          </form>
        )}

        <p className="login-link">
          Ya tenes cuenta? <Link to={`/${shopSlug}/login`}>Ingresar</Link>
        </p>
      </div>
    </div>
  );
}
