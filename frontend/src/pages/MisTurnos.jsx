import { useEffect, useState } from 'react';
import api from '../utils/api';

const STATUS_LABEL = { pending: 'Pendiente', confirmed: 'Confirmado', cancelled: 'Cancelado' };
const STATUS_CLASS = { pending: 'badge-pending', confirmed: 'badge-confirmed', cancelled: 'badge-cancelled' };

export default function MisTurnos() {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  const load = async () => {
    try {
      const resp = await api.get('/reservations');
      setReservations(resp.data.reservations);
    } catch {
      setMsg('Error cargando turnos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const cancelar = async (id) => {
    if (!confirm('Cancelar este turno?')) return;
    try {
      await api.patch(`/reservations/${id}/status`, { status: 'cancelled' });
      setReservations((prev) => prev.map((r) => r._id === id ? { ...r, status: 'cancelled' } : r));
    } catch {
      setMsg('Error cancelando turno');
    }
  };

  if (loading) return <div className="app-card"><p>Cargando...</p></div>;

  return (
    <div className="app-card">
      <h1>Mis Turnos</h1>
      {msg && <p className="error-text">{msg}</p>}
      {reservations.length === 0 ? (
        <p className="empty-msg">No tenes turnos registrados.</p>
      ) : (
        <div className="reservations-list">
          {reservations.map((r) => (
            <div key={r._id} className={`reservation-item ${r.status}`}>
              <div className="reservation-header">
                <span className="reservation-date">{r.date} - {r.time}</span>
                <span className={`badge ${STATUS_CLASS[r.status]}`}>{STATUS_LABEL[r.status]}</span>
              </div>
              <div className="reservation-body">
                <strong>{r.activity?.title}</strong> con <strong>{r.barber?.name}</strong>
                {r.activity?.price && <span className="price-tag">${r.activity.price.toLocaleString('es-AR')}</span>}
              </div>
              {(r.status === 'confirmed' || r.status === 'pending') && (
                <button className="btn-cancel" type="button" onClick={() => cancelar(r._id)}>
                  Cancelar turno
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
