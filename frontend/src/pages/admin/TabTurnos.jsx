import { useEffect, useRef, useState } from 'react';
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

// ── Popup de cliente ──────────────────────────────────────────────────────────
function ClientPopup({ res, pos, onClose, onRemind, remindingId }) {
  const popupRef = useRef(null);

  // Ajustar posición para no salirse de la pantalla
  useEffect(() => {
    if (!popupRef.current) return;
    const rect   = popupRef.current.getBoundingClientRect();
    const vw     = window.innerWidth;
    const vh     = window.innerHeight;
    const el     = popupRef.current;
    if (rect.right > vw - 8)  el.style.left = `${vw - rect.width - 8}px`;
    if (rect.bottom > vh - 8) el.style.top  = `${pos.top - rect.height - 8}px`;
  }, [pos]);

  return (
    <div
      ref={popupRef}
      className="client-popup"
      style={{ top: pos.top, left: pos.left }}
      onClick={(e) => e.stopPropagation()}
    >
      <button type="button" className="cp-close" onClick={onClose}>✕</button>
      <div className="cp-name">{res.client?.name || '—'}</div>
      {res.client?.phone && (
        <a className="cp-phone" href={`tel:+${res.client.phone}`} title="Llamar">
          📞 {res.client.phone}
        </a>
      )}
      {res.status === 'pending' && (
        <button
          type="button"
          className="cp-remind-btn"
          disabled={remindingId === res._id}
          onClick={() => onRemind(res._id)}
        >
          {remindingId === res._id ? 'Enviando…' : '📲 Recordar turno'}
        </button>
      )}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function TabTurnos() {
  const [reservations, setReservations] = useState([]);
  const [schedules, setSchedules]       = useState([]);
  const [loading, setLoading]           = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [showPast, setShowPast]         = useState(false);
  const [remindingId, setRemindingId]   = useState(null);
  const [popupRes, setPopupRes]         = useState(null);
  const [popupPos, setPopupPos]         = useState({ top: 0, left: 0 });

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

  // Cerrar popup al hacer click fuera
  useEffect(() => {
    if (!popupRes) return;
    const close = () => setPopupRes(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [popupRes]);

  const changeStatus = async (id, status, reason) => {
    await api.patch(`/reservations/${id}/status`, { status, reason });
    setReservations((prev) => prev.map((r) => r._id === id ? { ...r, status } : r));
  };

  const handleRemind = async (id) => {
    setRemindingId(id);
    try { await api.post(`/reservations/${id}/remind`); } catch { /* */ }
    setRemindingId(null);
    setPopupRes(null);
  };

  const handleCancelPrompt = async (id) => {
    if (!window.confirm('¿Cancelar este turno?')) return;
    const reason = window.prompt('Motivo de cancelación (opcional — presioná OK para continuar):') ?? '';
    await changeStatus(id, 'cancelled', reason);
  };

  const handleOpenPopup = (e, r) => {
    e.stopPropagation();
    if (popupRes?._id === r._id) { setPopupRes(null); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    setPopupPos({ top: rect.bottom + 6, left: rect.left });
    setPopupRes(r);
  };

  const navigate = (delta) => {
    const next = addDays(selectedDate, delta);
    if (next < today) return;
    setSelectedDate(next);
  };

  // ── Grilla ──────────────────────────────────────────────
  const dayOfWeek      = new Date(selectedDate + 'T00:00:00').getDay();
  const todaySchedules = schedules.filter((s) => s.weekday === dayOfWeek && s.active !== false);

  let slots = [];
  if (todaySchedules.length > 0) {
    const minStart = Math.min(...todaySchedules.map((s) => timeToMin(s.startTime)));
    const maxEnd   = Math.max(...todaySchedules.map((s) => timeToMin(s.endTime)));
    for (let t = minStart; t < maxEnd; t += 30) slots.push(minToTime(t));
  }

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
                          </div>
                          <div className="sg-actions">
                            <button
                              type="button"
                              className={`btn-small btn-client${popupRes?._id === r._id ? ' active' : ''}`}
                              onClick={(e) => handleOpenPopup(e, r)}
                              title="Ver cliente"
                            >
                              👤
                            </button>
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
            <span className="sg-legend-item pending">Ocupado</span>
            <span className="sg-legend-item off">Fuera de horario</span>
          </div>
        </div>
      )}

      {/* Popup de cliente (fuera de la tabla para z-index correcto) */}
      {popupRes && (
        <ClientPopup
          res={popupRes}
          pos={popupPos}
          onClose={() => setPopupRes(null)}
          onRemind={handleRemind}
          remindingId={remindingId}
        />
      )}
    </div>
  );
}
