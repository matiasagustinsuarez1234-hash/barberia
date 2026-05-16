import { useEffect, useState } from 'react';
import api from '../../utils/api';

const STATUS_LABEL = { pending: 'Pendiente', confirmed: 'Confirmado', cancelled: 'Cancelado' };
const STATUS_CLASS = { pending: 'badge-pending', confirmed: 'badge-confirmed', cancelled: 'badge-cancelled' };

export default function TabTurnos() {
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
