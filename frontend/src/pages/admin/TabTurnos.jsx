import { useEffect, useState } from 'react';
import api from '../../utils/api';

const STATUS_LABEL = { pending: 'Pendiente', confirmed: 'Confirmado', cancelled: 'Cancelado' };
const STATUS_CLASS = { pending: 'badge-pending', confirmed: 'badge-confirmed', cancelled: 'badge-cancelled' };

function isPast(date, time) {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  if (date < today) return true;
  if (date === today) {
    const [h, m] = time.split(':').map(Number);
    const slotMinutes = h * 60 + m;
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    return slotMinutes < nowMinutes;
  }
  return false;
}

export default function TabTurnos() {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [barberFilter, setBarberFilter] = useState('all');
  const [showPastToday, setShowPastToday] = useState(false);
  const [cancelingId, setCancelingId] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [remindingId, setRemindingId] = useState(null);

  useEffect(() => {
    api.get('/reservations').then((r) => setReservations(r.data.reservations)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const changeStatus = async (id, status, reason) => {
    await api.patch(`/reservations/${id}/status`, { status, reason });
    setReservations((prev) => prev.map((r) => r._id === id ? { ...r, status } : r));
  };

  const handleRemind = async (id) => {
    setRemindingId(id);
    try { await api.post(`/reservations/${id}/remind`); } catch { /* ignore */ }
    setRemindingId(null);
  };

  const handleCancel = async (id) => {
    await changeStatus(id, 'cancelled', cancelReason);
    setCancelingId(null);
    setCancelReason('');
  };

  // Barberos únicos de todos los turnos
  const barbers = [...new Map(reservations.map((r) => [r.barber?._id, r.barber]).filter(([id]) => id)).values()];

  const today = new Date().toISOString().split('T')[0];

  const visible = reservations.filter((r) => {
    // Ocultar días anteriores siempre
    if (r.date < today) return false;
    // Ocultar turnos pasados del día de hoy a menos que showPastToday
    if (!showPastToday && isPast(r.date, r.time)) return false;
    // Filtro de estado
    if (filter !== 'all' && r.status !== filter) return false;
    // Filtro de barbero
    if (barberFilter !== 'all' && r.barber?._id !== barberFilter) return false;
    return true;
  });

  if (loading) return <p>Cargando...</p>;

  return (
    <div>
      {/* Filtros de estado */}
      <div className="filter-bar">
        {['all', 'pending', 'confirmed', 'cancelled'].map((f) => (
          <button key={f} type="button" className={`filter-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {f === 'all' ? 'Todos' : STATUS_LABEL[f]}
          </button>
        ))}
      </div>

      {/* Filtro por barbero */}
      {barbers.length > 1 && (
        <div className="filter-bar barber-filter-bar">
          <button
            type="button"
            className={`filter-btn ${barberFilter === 'all' ? 'active' : ''}`}
            onClick={() => setBarberFilter('all')}
          >
            Todos los barberos
          </button>
          {barbers.map((b) => (
            <button
              key={b._id}
              type="button"
              className={`filter-btn ${barberFilter === b._id ? 'active' : ''}`}
              onClick={() => setBarberFilter(b._id)}
            >
              {b.name}
            </button>
          ))}
        </div>
      )}

      {/* Toggle para ver pasados de hoy */}
      <label className="show-past-toggle">
        <input
          type="checkbox"
          checked={showPastToday}
          onChange={(e) => setShowPastToday(e.target.checked)}
        />
        <span>Mostrar turnos de hoy ya pasados</span>
      </label>

      {visible.length === 0 ? (
        <p className="empty-msg">Sin turnos para mostrar.</p>
      ) : (
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
                  {r.status === 'pending' && (
                    <button type="button" className="btn-small" onClick={() => handleRemind(r._id)} disabled={remindingId === r._id}>
                      {remindingId === r._id ? 'Enviando...' : 'Recordar'}
                    </button>
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
