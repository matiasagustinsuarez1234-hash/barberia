import { useEffect, useState } from 'react';
import api from '../../utils/api';

const STATUS_CLASS = { pending: 'status-pending', confirmed: 'status-confirmed', cancelled: 'status-cancelled' };

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function formatDateLabel(dateStr) {
  const today    = new Date().toISOString().split('T')[0];
  const tomorrow = addDays(today, 1);
  if (dateStr === today)    return 'Hoy';
  if (dateStr === tomorrow) return 'Mañana';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
}

function timeToMin(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minToTime(m) {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

function isPastTime(time) {
  const now = new Date();
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m < now.getHours() * 60 + now.getMinutes();
}

export default function TabTurnos() {
  const [reservations, setReservations] = useState([]);
  const [schedules, setSchedules]       = useState([]);
  const [loading, setLoading]           = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [showPast, setShowPast]         = useState(false);
  const [remindingId, setRemindingId]   = useState(null);

  const today   = new Date().toISOString().split('T')[0];
  const isToday = selectedDate === today;

  useEffect(() => {
    Promise.all([api.get('/reservations'), api.get('/schedules')])
      .then(([rRes, sRes]) => {
        setReservations(rRes.data.reservations || []);
        setSchedules(sRes.data.schedules || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const changeStatus = async (id, status, reason) => {
    await api.patch(`/reservations/${id}/status`, { status, reason });
    setReservations((prev) => prev.map((r) => r._id === id ? { ...r, status } : r));
  };

  const handleRemind = async (id) => {
    setRemindingId(id);
    try { await api.post(`/reservations/${id}/remind`); } catch { /* */ }
    setRemindingId(null);
  };

  // Cancelación con prompt nativo (mantiene la grilla compacta)
  const handleCancelPrompt = async (id) => {
    if (!window.confirm('¿Cancelar este turno?')) return;
    const reason = window.prompt('Motivo de cancelación (opcional — presioná OK para continuar):') ?? '';
    await changeStatus(id, 'cancelled', reason);
  };

  const navigate = (delta) => {
    const next = addDays(selectedDate, delta);
    if (next < today) return;
    setSelectedDate(next);
  };

  // ── Grilla ──────────────────────────────────────────────
  const dayOfWeek      = new Date(selectedDate + 'T00:00:00').getDay();
  const todaySchedules = schedules.filter((s) => s.weekday === dayOfWeek && s.active !== false);

  // Slots del día (cada 30 min, unión de todos los barberos)
  let slots = [];
  if (todaySchedules.length > 0) {
    const minStart = Math.min(...todaySchedules.map((s) => timeToMin(s.startTime)));
    const maxEnd   = Math.max(...todaySchedules.map((s) => timeToMin(s.endTime)));
    for (let t = minStart; t < maxEnd; t += 30) slots.push(minToTime(t));
  }

  // Reservas del día por barbero (excluye cancelados)
  const resByBarber = {};
  reservations
    .filter((r) => r.date === selectedDate && r.status !== 'cancelled')
    .forEach((r) => {
      const bid = r.barber?._id;
      if (!bid) return;
      if (!resByBarber[bid]) resByBarber[bid] = [];
      resByBarber[bid].push(r);
    });

  const getCell = (barberId, slotTime, sched) => {
    const slotMin    = timeToMin(slotTime);
    const schedStart = timeToMin(sched.startTime);
    const schedEnd   = timeToMin(sched.endTime);
    if (slotMin < schedStart || slotMin >= schedEnd) return { type: 'off' };
    if (isToday && !showPast && isPastTime(slotTime))  return { type: 'past' };
    for (const r of (resByBarber[barberId] || [])) {
      const rStart = timeToMin(r.time);
      const rEnd   = r.endTime ? timeToMin(r.endTime) : rStart + (sched.slotMinutes || 45);
      if (slotMin >= rStart && slotMin < rEnd) {
        return { type: slotMin === rStart ? 'start' : 'cont', r };
      }
    }
    return { type: 'free' };
  };

  if (loading) return <p>Cargando...</p>;

  return (
    <div>
      {/* Navegador de días */}
      <div className="date-navigator">
        <button type="button" className="date-nav-btn" onClick={() => navigate(-1)} disabled={isToday} title="Día anterior">‹</button>
        <div className="date-nav-label">
          <span className="date-nav-main">{formatDateLabel(selectedDate)}</span>
          {!isToday && <span className="date-nav-sub">{selectedDate}</span>}
        </div>
        <button type="button" className="date-nav-btn" onClick={() => navigate(1)} title="Día siguiente">›</button>
        {!isToday && (
          <button type="button" className="date-nav-today" onClick={() => setSelectedDate(today)}>Hoy</button>
        )}
      </div>

      {/* Toggle pasados (solo hoy) */}
      {isToday && (
        <label className="show-past-toggle">
          <input type="checkbox" checked={showPast} onChange={(e) => setShowPast(e.target.checked)} />
          <span>Mostrar horarios ya pasados</span>
        </label>
      )}

      {/* ── Grilla ── */}
      {todaySchedules.length === 0 ? (
        <p className="empty-msg">No hay horarios configurados para este día.</p>
      ) : (
        <div className="schedule-grid-wrap">
          <table className="schedule-grid">
            <thead>
              <tr>
                <th className="th-time">Horario</th>
                {todaySchedules.map((s) => (
                  <th key={s._id}>{s.barber?.name || '—'}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slots.map((slot) => (
                <tr key={slot}>
                  <td className="td-time">{slot}</td>
                  {todaySchedules.map((s) => {
                    const cell = getCell(s.barber?._id, slot, s);

                    if (cell.type === 'off')  return <td key={s._id} className="sg-off">—</td>;
                    if (cell.type === 'past') return <td key={s._id} className="sg-past"></td>;
                    if (cell.type === 'free') return <td key={s._id} className="sg-free">Disponible</td>;
                    if (cell.type === 'cont') return <td key={s._id} className={`sg-cont ${STATUS_CLASS[cell.r.status]}`}></td>;

                    // start
                    const r = cell.r;
                    return (
                      <td key={s._id} className={`sg-start ${STATUS_CLASS[r.status]}`}>
                        <div className="sg-cell-main">
                          <div className="sg-cell-info">
                            <span className="sg-client">{r.client?.name}</span>
                            <span className="sg-sep"> · </span>
                            <span className="sg-activity">{r.activity?.title}</span>
                            {r.client?.phone && (
                              <span className="sg-phone"> · {r.client.phone}</span>
                            )}
                          </div>
                          <div className="sg-actions">
                            {r.status === 'pending' && (
                              <button
                                type="button"
                                className="btn-small"
                                onClick={() => handleRemind(r._id)}
                                disabled={remindingId === r._id}
                                title="Enviar recordatorio por WhatsApp"
                              >
                                {remindingId === r._id ? '…' : '📲'}
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn-small btn-cancel-sm"
                              onClick={() => handleCancelPrompt(r._id)}
                              title="Cancelar turno"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Leyenda */}
          <div className="sg-legend">
            <span className="sg-legend-item free">Disponible</span>
            <span className="sg-legend-item booked">Ocupado</span>
            <span className="sg-legend-item off">Fuera de horario</span>
          </div>
        </div>
      )}
    </div>
  );
}
