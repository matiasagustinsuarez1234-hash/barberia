import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthProvider';
import api from '../utils/api';
import TabEmpresas from './admin/TabEmpresas';
import TabAdmins from './admin/TabAdmins';
import TabPlanes from './admin/TabPlanes';
import TabSuscripciones from './admin/TabSuscripciones';
import TabTurnos from './admin/TabTurnos';
import TabBarberos from './admin/TabBarberos';
import TabActividades from './admin/TabActividades';
import TabHorarios from './admin/TabHorarios';
import TabDiasCerrados from './admin/TabDiasCerrados';
import TabClientes from './admin/TabClientes';
import TabConfig from './admin/TabConfig';
import TabQR from './admin/TabQR';
import TabWhatsAppCentral from './admin/TabWhatsAppCentral';
import TabWhatsApp from './admin/TabWhatsApp';

const SUPER_TABS = ['Empresas', 'Admins', 'Planes', 'Suscripciones', 'WhatsApp'];
const BASE_SHOP_TABS = ['Turnos', 'Barberos', 'Actividades', 'Horarios', 'Dias Cerrados', 'Clientes', 'Configuracion', 'QR'];

export default function AdminPanel() {
  const { role, shopName } = useAuth();
  const isSuperAdmin = role === 'superadmin';
  const [tab, setTab] = useState(isSuperAdmin ? SUPER_TABS[0] : BASE_SHOP_TABS[0]);
  const [shop, setShop] = useState(null);
  const [shopLoading, setShopLoading] = useState(true);
  const [copyMsg, setCopyMsg] = useState('');

  const tabs = isSuperAdmin
    ? SUPER_TABS
    : shop?.showWhatsappBusinessTab
      ? [...BASE_SHOP_TABS.slice(0, -1), 'WhatsApp Business', BASE_SHOP_TABS[BASE_SHOP_TABS.length - 1]]
      : BASE_SHOP_TABS;

  useEffect(() => {
    if (isSuperAdmin) return;
    api.get('/shops')
      .then((r) => setShop(r.data.shops?.[0] || null))
      .catch(() => {})
      .finally(() => setShopLoading(false));
  }, [isSuperAdmin]);

  const shopUrl = shop?.slug ? `${window.location.origin}/${shop.slug}/turnos` : null;
  const handleCopyUrl = async () => {
    if (!shopUrl) return;
    await navigator.clipboard.writeText(shopUrl);
    setCopyMsg('Copiado al portapapeles');
    setTimeout(() => setCopyMsg(''), 2500);
  };

  return (
    <div className="admin-card">
      <h1>Panel {isSuperAdmin ? 'Super Admin' : 'Admin'}</h1>
      {!isSuperAdmin && shopName && <p className="admin-shop-name">{shopName}</p>}
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
            {tab === 'Empresas' && <TabEmpresas />}
            {tab === 'Admins' && <TabAdmins />}
            {tab === 'Planes' && <TabPlanes />}
            {tab === 'Suscripciones' && <TabSuscripciones />}
            {tab === 'WhatsApp' && <TabWhatsAppCentral />}
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
            {tab === 'WhatsApp Business' && <TabWhatsApp />}
            {tab === 'QR' && <TabQR shop={shop} shopLoading={shopLoading} shopUrl={shopUrl} copyMsg={copyMsg} handleCopyUrl={handleCopyUrl} />}
          </>
        )}
      </div>
    </div>
  );
}
