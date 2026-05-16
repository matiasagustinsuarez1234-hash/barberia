import { Outlet, Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthProvider';

export default function Layout() {
  const { logout, userType, shopName } = useAuth();
  const { shopSlug } = useParams();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate(shopSlug ? `/${shopSlug}/login` : '/admin');
  };

  return (
    <div className="app-shell">
      <nav className="topbar">
        <Link to={userType === 'admin' ? '/admin' : `/${shopSlug}/turnos`} className="logo">
          {userType === 'admin' && shopName ? shopName : 'SAAS Solutions'}
        </Link>
        <div className="nav-links">
          {userType === 'admin' ? (
            <Link to="/admin">Panel Admin</Link>
          ) : (
            <>
              <Link to={`/${shopSlug}/turnos`}>Reservar Turno</Link>
              <Link to={`/${shopSlug}/mis-turnos`}>Mis Turnos</Link>
            </>
          )}
          <button type="button" className="logout-button" onClick={handleLogout}>Salir</button>
        </div>
      </nav>
      <main className="page-content">
        <Outlet />
      </main>
    </div>
  );
}
