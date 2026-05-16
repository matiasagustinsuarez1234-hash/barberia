import { useState } from 'react';
import { Link, useNavigate, useLocation, useParams } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthProvider';

export default function Login() {
  const { shopSlug } = useParams();
  const isClientMode = Boolean(shopSlug);

  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { setToken, setUserType, setRole, setShopName } = useAuth();

  const successMsg = location.state?.msg || '';
  const next = location.state?.next || (shopSlug ? `/${shopSlug}/mis-turnos` : '/admin');

  const handleAdminSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const resp = await api.post('/auth/login', { username, password });
      setToken(resp.data.token);
      setUserType(resp.data.userType);
      setRole(resp.data.role || '');
      setShopName(resp.data.shopName || '');
      navigate('/admin', { replace: true });
    } catch {
      setError('Credenciales invalidas');
    } finally {
      setLoading(false);
    }
  };

  const handleClientSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setNotFound(false);
    setLoading(true);
    try {
      const resp = await api.post('/auth/client-login', { phone });
      setToken(resp.data.token);
      setUserType('client');
      setRole('');
      navigate(next, { replace: true });
    } catch (err) {
      if (err.response?.data?.notFound) {
        setNotFound(true);
      } else {
        setError(err.response?.data?.msg || 'Error al ingresar');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h2>BARBER TURNOS</h2>
        {successMsg && <p className="success-text">{successMsg}</p>}

        {isClientMode ? (
          <>
            <p className="login-subtitle">Ingresa con tu celular</p>
            <form onSubmit={handleClientSubmit}>
              <input
                type="tel"
                placeholder="Celular (ej: 5491100000000)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
              <button type="submit" disabled={loading}>{loading ? 'Ingresando...' : 'Ingresar'}</button>
              {error && <p className="error-text">{error}</p>}
              {notFound && (
                <p className="error-text">
                  Numero no registrado.{' '}
                  <Link to={`/${shopSlug}/registro`}>Registrate aqui</Link>
                </p>
              )}
            </form>
            <p className="login-link">
              No tenes cuenta? <Link to={`/${shopSlug}/registro`}>Registrate</Link>
            </p>
          </>
        ) : (
          <form onSubmit={handleAdminSubmit}>
            <input
              type="text"
              placeholder="Usuario"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Contrasena"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button type="submit" disabled={loading}>{loading ? 'Ingresando...' : 'Ingresar'}</button>
            {error && <p className="error-text">{error}</p>}
          </form>
        )}
      </div>
    </div>
  );
}
