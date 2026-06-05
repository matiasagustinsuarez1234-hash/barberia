import { useEffect, useRef, useState } from 'react';
import api from '../../utils/api';

const STATUS_CLASS = { pending: 'status-pending', confirmed: 'status-confirmed', cancelled: 'status-cancelled' };

function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function formatDateLabel(dateStr) {
  const today    = localToday();
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

function isPastSlot(slotTime) {
  const now = new Date();
  const [h, m] = slotTime.split(':').map(Number);
  return h * 60 + m < now.getHours() * 60 + now.getMinutes();
}

function formatMoney(n) {
  return n > 0
    ? `$${n.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`
    : '—';
}

// ── Popup de cliente ──────────────────────────────────────────────────────────
function ClientPopup({ res, pos, onClose, onRemind, onCancel, remindingId }) {
  const popupRef = useRef(null);

  useEffect(() => {
    if (!popupRef.current) return;
    const rect = popupRef.current.getBoundingClientRect();
    const vw   = window.innerWidth;
    const vh   = window.innerHeight;
    const el   = popupRef.current;
    if (rect.right  > vw - 8) el.style.left = `${vw - rect.width - 8}px`;
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
      <button
        type="button"
        className="cp-cancel-btn"
        onClick={() => { onClose(); onCancel(res._id); }}
      >
        ✕ Cancelar turno
      </button>
    </div>
  );
}

// ── Popup para reservar turno desde el admin ──────────────────────────────────
function AdminBookPopup({ slot, pos, barbers, onClose, onBook }) {
  const popupRef  = useRef(null);
  const [form, setForm]       = useState({ name: '', phone: '', email: '' });
  const [selected, setSelected] = useState([]);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [avail, setAvail]     = useState([]);

  useEffect(() => {
    api.get('/activities').then((r) => {
      const all    = r.data.activities || [];
      const barber = barbers.find((b) => String(b._id) === String(slot.barberId));
      const ids    = new Set((barber?.activities || []).map(String));
      setAvail(ids.size === 0 ? all : all.filter((a) => ids.has(String(a._id))));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!popupRef.current) return;
    const el   = popupRef.current;
    const rect = el.getBoundingClientRect();
    const vw   = window.innerWidth;
    const vh   = window.innerHeight;
    if (rect.right  > vw - 8) el.style.left = `${Math.max(8, vw - rect.width - 8)}px`;
    if (rect.bottom > vh - 8) el.style.top  = `${Math.max(8, pos.top - rect.height - 14)}px`;
    if (rect.top < 8)         el.style.top  = '8px';
  }, [pos, avail]);

  const toggleActivity = (id) =>
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selected.length === 0) { setError('Seleccioná al menos un servicio'); return; }
    setSaving(true);
    setError('');
    try {
      const [activityId, ...additionalActivityIds] = selected;
      await onBook({ ...form, activityId, additionalActivityIds, barberId: slot.barberId, date: slot.date, time: slot.time });
      onClose();
    } catch (err) {
      setError(err.response?.data?.msg || 'Error al reservar');
      setSaving(false);
    }
  };

  return (
    <div
      ref={popupRef}
      className="admin-book-popup"
      style={{ top: pos.top, left: pos.left }}
      onClick={(e) => e.stopPropagation()}
    >
      <button type="button" className="cp-close" onClick={onClose}>✕</button>
      <div className="abp-title">Reservar turno</div>
      <div className="abp-meta">{slot.barberName} · {slot.time}</div>
      <form onSubmit={handleSubmit} className="abp-form">
        <input className="abp-input" placeholder="Nombre *" value={form.name} onChange={set('name')} required />
        <input className="abp-input" placeholder="Teléfono *" value={form.phone} onChange={set('phone')} required />
        <input className="abp-input" placeholder="Email (opcional)" type="email" value={form.email} onChange={set('email')} />
        <div className="abp-activities">
          <div className="abp-activities-label">Servicios *</div>
          {avail.map((a) => (
            <label key={a._id} className="abp-activity-item">
              <input
                type="checkbox"
                checked={selected.includes(a._id)}
                onChange={() => toggleActivity(a._id)}
              />
              <span className="abp-activity-name">{a.title}</span>
              {a.price > 0 && <span className="abp-activity-price">${a.price.toLocaleString('es-AR')}</span>}
            </label>
          ))}
        </div>
        {error && <div className="abp-error">{error}</div>}
        <button type="submit" className="abp-submit" disabled={saving}>
          {saving ? 'Guardando…' : '✔ Confirmar turno'}
        </button>
      </form>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function TabTurnos() {
  const [reservations, setReservations] = useState([]);
  const [schedules, setSchedules]       = useState([]);
  const [barbers, setBarbers]           = useState([]);
  const [activities, setActivities]     = useState([]);
  const [loading, setLoading]           = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => localToday());
  const [remindingId, setRemindingId]   = useState(null);
  const [remindingDay, setRemindingDay] = useState(false);
  const [remindingBarber, setRemindingBarber] = useState(null);
  const [remindDayMsg, setRemindDayMsg] = useState('');
  const [popupRes, setPopupRes]         = useState(null);
  const [popupPos, setPopupPos]         = useState({ top: 0, left: 0 });
  const [bookingSlot, setBookingSlot]   = useState(null);
  const [bookingPos, setBookingPos]     = useState({ top: 0, left: 0 });

  const today   = localToday();
  const isToday = selectedDate === today;

  useEffect(() => {
    Promise.all([api.get('/reservations'), api.get('/schedules')])
      .then(([rRes, sRes]) => {
        setReservations(rRes.data.reservations || []);
        setSchedules(sRes.data.schedules || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    Promise.all([api.get('/barbers'), api.get('/activities')])
      .then(([bRes, aRes]) => {
        setBarbers(bRes.data.barbers || []);
        setActivities(aRes.data.activities || []);
      })
      .catch(() => {});
  }, []);

  // Cerrar popups al hacer click fuera
  useEffect(() => {
    if (!popupRes && !bookingSlot) return;
    const close = () => { setPopupRes(null); setBookingSlot(null); };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [popupRes, bookingSlot]);

  const changeStatus = async (id, status, reason) => {
    await api.patch(`/reservations/${id}/status`, { status, reason });
    setReservations((prev) => prev.map((r) => r._id === id ? { ...r, status } : r));
  };

  const handleRemind = async (id) => {
    setRemindingId(id);
    try {
      const r = await api.post(`/reservations/${id}/remind`);
      alert(r.data?.msg || 'Recordatorio enviado');
    } catch (err) {
      alert(err.response?.data?.msg || 'Error enviando notificación');
    }
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

  const handleOpenBookingPopup = (e, sched, slotTime) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setBookingPos({ top: rect.bottom + 6, left: rect.left });
    setBookingSlot({
      barberId:   sched.barber?._id,
      barberName: sched.barber?.name,
      date:       selectedDate,
      time:       slotTime,
    });
    setPopupRes(null);
  };

  const handleAdminBook = async (data) => {
    const res = await api.post('/reservations/admin-book', data);
    setReservations((prev) => [res.data.reservation, ...prev]);
  };

  const handleRemindDay = async (barberId = null) => {
    setRemindDayMsg('');
    if (barberId) setRemindingBarber(barberId);
    else setRemindingDay(true);
    try {
      const body = { date: selectedDate };
      if (barberId) body.barberId = barberId;
      const r = await api.post('/reservations/remind-day', body);
      setRemindDayMsg(r.data.msg);
    } catch (err) {
      setRemindDayMsg(err.response?.data?.msg || 'Error enviando avisos');
    } finally {
      if (barberId) setRemindingBarber(null);
      else setRemindingDay(false);
    }
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

  const pendingToday = reservations.filter((r) => r.date === selectedDate && r.status === 'pending');

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
    for (const r of (resByBarber[barberId] || [])) {
      const rStart = timeToMin(r.time);
      const rEnd   = r.endTime ? timeToMin(r.endTime) : rStart + (sched.slotMinutes || 45);
      if (slotMin >= rStart && slotMin < rEnd) {
        return { type: slotMin === rStart ? 'start' : 'cont', r };
      }
    }
    return { type: 'free' };
  };

  // ── Revenue por barbero del día ───────────────────────────────────────────
  const dayRevenue = Object.fromEntries(
    todaySchedules.map((s) => {
      const bid      = s.barber?._id;
      const barberRes = reservations.filter(
        (r) => r.date === selectedDate && r.status !== 'cancelled' && r.barber?._id === bid
      );
      const base = barberRes.reduce((sum, r) => sum + (r.activity?.price || 0), 0);
      let total  = base;
      if (s.barber?.surchargeType === 'percent' && s.barber.surchargeValue > 0) {
        total = Math.round(base * (1 + s.barber.surchargeValue / 100));
      } else if (s.barber?.surchargeType === 'fixed' && s.barber.surchargeValue > 0) {
        total = base + barberRes.length * s.barber.surchargeValue;
      }
      return [bid, total];
    })
  );

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

      {/* Botón avisar + mensaje resultado */}
      {pendingToday.length > 0 && (
        <div className="remind-day-bar">
          <button
            type="button"
            className="btn-remind-all"
            onClick={() => handleRemindDay()}
            disabled={remindingDay || remindingBarber !== null}
          >
            {remindingDay ? 'Enviando…' : `🔔 Avisar a todos (${pendingToday.length})`}
          </button>
          {remindDayMsg && <span className="remind-day-msg">{remindDayMsg}</span>}
        </div>
      )}
      {!pendingToday.length && remindDayMsg && (
        <p className="remind-day-msg">{remindDayMsg}</p>
      )}

      {/* ── Grilla ── */}
      {todaySchedules.length === 0 ? (
        <p className="empty-msg">No hay horarios configurados para este día.</p>
      ) : (
        <>
        {/* ── Vista mobile: un barbero por sección ── */}
        <div className="schedule-mobile">
          {todaySchedules.map((s) => {
            const bid        = s.barber?._id;
            const barberSlots = slots.filter((slot) => {
              const t = timeToMin(slot);
              return t >= timeToMin(s.startTime) && t < timeToMin(s.endTime);
            });
            return (
              <div key={s._id} className="mb-barber-section">
                <div className="mb-barber-header">
                  <span>{s.barber?.name || '—'}</span>
                  {(resByBarber[bid] || []).some((r) => r.status === 'pending') && (
                    <button
                      type="button"
                      className="btn-remind-barber"
                      title="Avisar clientes de este profesional"
                      onClick={() => handleRemindDay(s.barber?._id)}
                      disabled={remindingBarber === s.barber?._id || remindingDay}
                    >{remindingBarber === s.barber?._id ? '…' : '🔔'}</button>
                  )}
                </div>
                {barberSlots.map((slot) => {
                  const cell = getCell(bid, slot, s);
                  const past = isToday && isPastSlot(slot);
                  if (cell.type === 'cont') return null;
                  return (
                    <div key={slot} className={`mb-slot${past ? ' sg-is-past' : ''}`}>
                      <span className="mb-slot-time">{slot}</span>
                      {cell.type === 'free' && (
                        past ? (
                          <span className="mb-slot-free">Disponible</span>
                        ) : (
                          <button
                            type="button"
                            className="btn-small btn-add-booking"
                            onClick={(e) => handleOpenBookingPopup(e, s, slot)}
                            title="Reservar turno"
                          >✏️ Disponible</button>
                        )
                      )}
                      {cell.type === 'start' && (
                        <div className="mb-slot-info">
                          <span className="mb-slot-client">{cell.r.client?.name}</span>
                          <span className="mb-slot-activity">{cell.r.activity?.title}</span>
                        </div>
                      )}
                      {cell.type === 'start' && (
                        <button
                          type="button"
                          className={`btn-small btn-client${popupRes?._id === cell.r._id ? ' active' : ''}`}
                          onClick={(e) => handleOpenPopup(e, cell.r)}
                        >👤</button>
                      )}
                    </div>
                  );
                })}
                <div className="mb-barber-total">
                  Total: <strong>{formatMoney(dayRevenue[bid] || 0)}</strong>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Vista desktop: tabla ── */}
        <div className="schedule-grid-wrap">
          <table className="schedule-grid">
            <thead>
              <tr>
                <th className="th-time">Horario</th>
                {todaySchedules.map((s) => (
                  <th key={s._id}>
                    <span>{s.barber?.name || '—'}</span>
                    {(resByBarber[s.barber?._id] || []).some((r) => r.status === 'pending') && (
                      <button
                        type="button"
                        className="btn-remind-barber"
                        title="Avisar clientes de este profesional"
                        onClick={() => handleRemindDay(s.barber?._id)}
                        disabled={remindingBarber === s.barber?._id || remindingDay}
                      >{remindingBarber === s.barber?._id ? '…' : '🔔'}</button>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slots.map((slot) => {
                const past = isToday && isPastSlot(slot);
                return (
                  <tr key={slot}>
                    <td className={`td-time${past ? ' td-time-past' : ''}`}>{slot}</td>
                    {todaySchedules.map((s) => {
                      const cell = getCell(s.barber?._id, slot, s);

                      if (cell.type === 'off')
                        return <td key={s._id} className="sg-off">—</td>;
                      if (cell.type === 'free')
                        return (
                          <td key={s._id} className={`sg-free${past ? ' sg-is-past' : ''}`}>
                            {!past ? (
                              <button
                                type="button"
                                className="btn-add-booking"
                                onClick={(e) => handleOpenBookingPopup(e, s, slot)}
                                title="Reservar turno"
                              >✏️ Disponible</button>
                            ) : 'Disponible'}
                          </td>
                        );
                      if (cell.type === 'cont')
                        return <td key={s._id} className={`sg-cont ${STATUS_CLASS[cell.r.status]}${past ? ' sg-is-past' : ''}`}></td>;

                      // start
                      const r = cell.r;
                      return (
                        <td key={s._id} className={`sg-start ${STATUS_CLASS[r.status]}${past ? ' sg-is-past' : ''}`}>
                          <div className="sg-cell-main">
                            <div className="sg-cell-info">
                              <div className="sg-client">{r.client?.name}</div>
                              <div className="sg-activity">{r.activity?.title}</div>
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
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>

            {/* ── Fila de totales ── */}
            <tfoot>
              <tr>
                <td className="tf-label">Total día</td>
                {todaySchedules.map((s) => {
                  const total = dayRevenue[s.barber?._id] || 0;
                  return (
                    <td key={s._id} className={`tf-amount${total === 0 ? ' tf-zero' : ''}`}>
                      {formatMoney(total)}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>

          {/* Leyenda */}
          <div className="sg-legend">
            <span className="sg-legend-item free">Disponible</span>
            <span className="sg-legend-item pending">Ocupado</span>
            <span className="sg-legend-item off">Fuera de horario</span>
            <span className="sg-legend-item past">Ya pasado</span>
          </div>
        </div>
        </>
      )}

      {/* Popup de cliente */}
      {popupRes && (
        <ClientPopup
          res={popupRes}
          pos={popupPos}
          onClose={() => setPopupRes(null)}
          onRemind={handleRemind}
          onCancel={handleCancelPrompt}
          remindingId={remindingId}
        />
      )}

      {/* Popup para reservar turno desde el admin */}
      {bookingSlot && (
        <AdminBookPopup
          slot={bookingSlot}
          pos={bookingPos}
          barbers={barbers}
          onClose={() => setBookingSlot(null)}
          onBook={handleAdminBook}
        />
      )}
    </div>
  );
}
