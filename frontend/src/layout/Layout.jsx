import { useEffect, useState } from 'react';
import { Outlet, Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthProvider';
import api from '../utils/api';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace('/api', '');

export default function Layout() {
  const { logout, userType, role, shopName, username } = useAuth();
  const { shopSlug } = useParams();
  const navigate = useNavigate();
  const [shopLogo, setShopLogo] = useState(null);

  const isAdmin      = userType === 'admin';
  const isSuperAdmin = role === 'superadmin';

  // Carga el logo del shop (solo para shopadmin)
  useEffect(() => {
    if (!isAdmin || isSuperAdmin) return;
    api.get('/shops')
      .then((r) => {
        const s = r.data.shops?.[0];
        if (s?.logo || s?.image) setShopLogo(s.logo || s.image);
      })
      .catch(() => {});
  }, [isAdmin, isSuperAdmin]);

  const handleLogout = () => {
    logout();
    navigate(shopSlug ? `/${shopSlug}/login` : '/admin');
  };

  // ── Topbar admin ──────────────────────────────────────────
  if (isAdmin) {
    return (
      <div className="app-shell">
        <nav className="topbar topbar-admin">
          {/* Izquierda: etiqueta panel */}
          <span className="topbar-panel-label">
            {isSuperAdmin ? 'Super Admin' : 'Panel Admin'}
          </span>

          {/* Centro: logo + nombre del negocio */}
          <div className="topbar-shop-identity">
            {shopLogo && (
              <img
                src={`${API_BASE}${shopLogo}`}
                alt="Logo"
                className="topbar-shop-logo"
              />
            )}
            <span className="topbar-shop-name">
              {isSuperAdmin ? 'Gestión de Negocios' : (shopName || '')}
            </span>
          </div>

          {/* Derecha: usuario + salir */}
          <div className="topbar-right">
            <span className="topbar-username">user: {username}</span>
            <button type="button" className="logout-button" onClick={handleLogout}>Salir</button>
          </div>
        </nav>
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    );
  }

  // ── Topbar cliente (booking) ──────────────────────────────
  return (
    <div className="app-shell">
      <nav className="topbar">
        <Link to={`/${shopSlug}/turnos`} className="logo">
          {shopName || 'SAAS Solutions'}
        </Link>
        <div className="nav-links">
          <Link to={`/${shopSlug}/turnos`}>Reservar Turno</Link>
          <Link to={`/${shopSlug}/mis-turnos`}>Mis Turnos</Link>
          <button type="button" className="logout-button" onClick={handleLogout}>Salir</button>
        </div>
      </nav>
      <main className="page-content">
        <Outlet />
      </main>
    </div>
  );
}
