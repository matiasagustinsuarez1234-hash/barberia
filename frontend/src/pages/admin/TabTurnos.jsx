import { useEffect, useState } from 'react';
import api from '../../utils/api';

const STATUS_LABEL = { pending: 'Pendiente', confirmed: 'Confirmado', cancelled: 'Cancelado' };
const STATUS_CLASS = { pending: 'badge-pending', confirmed: 'badge-confirmed', cancelled: 'badge-cancelled' };

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function formatDateLabel(dateStr) {
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = addDays(today, 1);
  if (dateStr === today) return 'Hoy';
  if (dateStr === tomorrow) return 'Mañana';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
}

function isPastTime(time) {
  const now = new Date();
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m < now.getHours() * 60 + now.getMinutes();
}

export default function TabTurnos() {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [barberFilter, setBarberFilter] = useState('all');
  const [showPastToday, setShowPastToday] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [cancelingId, setCancelingId] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [remindingId, setRemindingId] = useState(null);

  const today = new Date().toISOString().split('T')[0];
  const isToday = selectedDate === today;

  useEffect(() => {
    api.get('/reservations')
      .then((r) => setReservations(r.data.reservations))
      .catch(() => {})
      .finally(() => setLoading(false));
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

  const navigate = (delta) => {
    const next = addDays(selectedDate, delta);
    if (next < today) return; // no retroceder antes de hoy
    setSelectedDate(next);
    setBarberFilter('all');
    setCancelingId(null);
    setCancelReason('');
  };

  // Barberos únicos en todos los turnos (para mostrar el filtro siempre que haya más de uno)
  const allBarbers = [...new Map(
    reservations
      .map((r) => [r.barber?._id, r.barber])
      .filter(([id]) => id)
  ).values()];

  // Conteo de turnos por barbero en el día seleccionado
  const countByBarber = reservations.reduce((acc, r) => {
    if (r.date === selectedDate && r.barber?._id) {
      acc[r.barber._id] = (acc[r.barber._id] || 0) + 1;
    }
    return acc;
  }, {});

  const visible = reservations.filter((r) => {
    if (r.date !== selectedDate) return false;
    if (isToday && !showPastToday && isPastTime(r.time)) return false;
    if (filter !== 'all' && r.status !== filter) return false;
    if (barberFilter !== 'all' && r.barber?._id !== barberFilter) return false;
    return true;
  });

  if (loading) return <p>Cargando...</p>;

  return (
    <div>
      {/* Navegador de días */}
      <div className="date-navigator">
        <button
          type="button"
          className="date-nav-btn"
          onClick={() => navigate(-1)}
          disabled={isToday}
          title="Día anterior"
        >
          ‹
        </button>
        <div className="date-nav-label">
          <span className="date-nav-main">{formatDateLabel(selectedDate)}</span>
          {!isToday && <span className="date-nav-sub">{selectedDate}</span>}
        </div>
        <button
          type="button"
          className="date-nav-btn"
          onClick={() => navigate(1)}
          title="Día siguiente"
        >
          ›
        </button>
        {!isToday && (
          <button
            type="button"
            className="date-nav-today"
            onClick={() => { setSelectedDate(today); setBarberFilter('all'); }}
          >
            Hoy
          </button>
        )}
      </div>

      {/* Filtros de estado */}
      <div className="filter-bar">
        {['all', 'pending', 'confirmed', 'cancelled'].map((f) => (
          <button key={f} type="button" className={`filter-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {f === 'all' ? 'Todos' : STATUS_LABEL[f]}
          </button>
        ))}
      </div>

      {/* Filtro por barbero (aparece siempre que haya más de uno en el sistema) */}
      {allBarbers.length > 1 && (
        <div className="filter-bar barber-filter-bar">
          <button
            type="button"
            className={`filter-btn ${barberFilter === 'all' ? 'active' : ''}`}
            onClick={() => setBarberFilter('all')}
          >
            Todos
          </button>
          {allBarbers.map((b) => {
            const count = countByBarber[b._id] || 0;
            return (
              <button
                key={b._id}
                type="button"
                className={`filter-btn ${barberFilter === b._id ? 'active' : ''}`}
                onClick={() => setBarberFilter(b._id)}
              >
                {b.name}
                {count > 0 && <span className="barber-count">{count}</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* Toggle pasados (solo hoy) */}
      {isToday && (
        <label className="show-past-toggle">
          <input
            type="checkbox"
            checked={showPastToday}
            onChange={(e) => setShowPastToday(e.target.checked)}
          />
          <span>Mostrar turnos ya pasados</span>
        </label>
      )}

      {visible.length === 0 ? (
        <p className="empty-msg">Sin turnos para este día.</p>
      ) : (
        <div className="reservations-list">
          {visible.map((r) => (
            <div key={r._id} className={`reservation-item ${r.status}`}>
              <div className="reservation-header">
                <span className="reservation-date">{r.time}</span>
                <span className={`badge ${STATUS_CLASS[r.status]}`}>{STATUS_LABEL[r.status]}</span>
              </div>
              <div className="reservation-body">
                <strong>{r.client?.name}</strong>
                {r.client?.phone && <span className="client-phone">📞 {r.client.phone}</span>}
                &mdash; {r.activity?.title} con {r.barber?.name}
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
