import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import api from '../utils/api';
import { normalizeArgPhone, normalizeArgPhoneAny } from '../utils/phoneUtils';

// Convierte la clave pública VAPID (base64url) al formato Uint8Array que necesita el browser
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return new Uint8Array([...rawData].map((c) => c.charCodeAt(0)));
}

async function subscribeToPush(phone) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  try {
    // Registrar y esperar a que el SW esté activo
    await navigator.serviceWorker.register('/sw.js');
    const reg = await navigator.serviceWorker.ready;

    // Verificar si ya hay suscripción activa
    const existing = await reg.pushManager.getSubscription();
    if (existing) {
      await api.post('/push/subscribe', { phone, subscription: existing });
      console.log('[Push] Suscripción existente re-guardada');
      return;
    }

    const { data } = await api.get('/push/vapid-key');
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(data.publicKey),
    });
    await api.post('/push/subscribe', { phone, subscription });
    console.log('[Push] Suscripción nueva guardada');
  } catch (e) {
    console.warn('[Push] No se pudo suscribir:', e.message);
  }
}

const MONTHS_ES = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
const DAYS_ES   = ['DOM','LUN','MAR','MIE','JUE','VIE','SAB'];
const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace('/api', '');

function generateDates() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const limit = new Date(today);
  limit.setMonth(limit.getMonth() + 1);
  const dates = [];
  const d = new Date(today);
  while (d <= limit) {
    dates.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

function toDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function calcFinalPrice(basePrice, barber) {
  if (!barber || barber.surchargeType === 'none' || !barber.surchargeValue) return basePrice;
  if (barber.surchargeType === 'percent') return Math.round(basePrice * (1 + barber.surchargeValue / 100));
  return basePrice + barber.surchargeValue;
}

function addMinutes(timeStr, minutes) {
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const nh = Math.floor(total / 60);
  const nm = total % 60;
  return `${nh}:${nm === 0 ? '00' : String(nm).padStart(2, '0')}`;
}

export default function Booking() {
  const { shopSlug } = useParams();
  const [searchParams] = useSearchParams();
  const dateBarRef = useRef(null);

  const [shopId, setShopId] = useState(null);
  const [shopName, setShopName] = useState('');
  const [shopLogo, setShopLogo] = useState('');
  const [shopAreaCode, setShopAreaCode] = useState('11');
  const [shopAllowsGroup, setShopAllowsGroup] = useState(false);
  const [shopError, setShopError] = useState('');

  const [activities, setActivities] = useState([]);
  const [barbers, setBarbers] = useState([]);

  // Barbero seleccionado
  const [selectedBarber, setSelectedBarber] = useState(null);

  // Múltiples servicios seleccionados (array)
  const [selectedActivities, setSelectedActivities] = useState([]);

  const [dates] = useState(() => generateDates());
  const [date, setDate] = useState('');
  const [closedDates, setClosedDates] = useState(new Set());
  const [slots, setSlots] = useState([]);
  const [slotMinutes, setSlotMinutes] = useState(45);
  const [selectedTime, setSelectedTime] = useState('');
  const [notes, setNotes] = useState('');

  // Tipo de reserva
  const [isGroup, setIsGroup] = useState(false);
  const [groupCount, setGroupCount] = useState(2);
  const [groupMembers, setGroupMembers] = useState([{ name: '' }, { name: '' }]);

  const [step, setStep] = useState(1);

  // Datos del cliente (paso 2)
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');

  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [reservations, setReservations] = useState([]);
  const [pushState, setPushState] = useState('idle'); // idle | loading | done | unsupported

  // Flujo de cancelación
  const [cancelView, setCancelView] = useState(null); // null | 'phone' | 'list'
  const [cancelPhone, setCancelPhone] = useState('');
  const [cancelEmail, setCancelEmail] = useState('');
  const [cancelReservations, setCancelReservations] = useState([]);
  const [cancelMsg, setCancelMsg] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);

  // Resolver slug → shopId
  useEffect(() => {
    api.get(`/public/shops/slug/${shopSlug}`)
      .then((r) => {
        setShopId(r.data.shop._id);
        setShopName(r.data.shop.name);
        setShopAreaCode(r.data.shop.areaCode || '11');
        setShopAllowsGroup(r.data.shop.allowGroupBooking === true);
        const rawLogo = r.data.shop.logo || r.data.shop.image || '';
        setShopLogo(rawLogo ? `${API_BASE}${rawLogo}` : '');
      })
      .catch(() => setShopError('Barberia no encontrada'));
  }, [shopSlug]);

  // Si llega desde notificación push → ir directo a "mis turnos"
  useEffect(() => {
    if (searchParams.get('ver') === 'mis-turnos') {
      setCancelView('phone');
    }
  }, [searchParams]);

  useEffect(() => {
    if (!shopId) return;
    Promise.all([
      api.get(`/public/activities?shop=${shopId}`),
      api.get(`/public/barbers?shop=${shopId}`),
      api.get(`/public/closed-days?shop=${shopId}`),
    ]).then(([actResp, barResp, closedResp]) => {
      setActivities(actResp.data.activities);
      setBarbers(barResp.data.barbers);
      setClosedDates(new Set(closedResp.data.closedDates || []));
      // Sin auto-selección: el cliente elige primero el barbero
    }).catch(() => setMsg('Error cargando datos'));
  }, [shopId]);

  // Duración total de las actividades seleccionadas
  const totalDuration = selectedActivities.reduce((sum, a) => sum + (a.durationMinutes || 0), 0);

  // Precio total (con recargo del barbero ya incluido en el total)
  const totalPrice = (() => {
    if (!selectedActivities.length) return 0;
    const baseTotal = selectedActivities.reduce((sum, a) => sum + (a.price || 0), 0);
    return calcFinalPrice(baseTotal, selectedBarber);
  })();

  // Cargar slots cuando cambian barbero, fecha o actividades
  useEffect(() => {
    if (!selectedBarber || !date || selectedActivities.length === 0) return;
    setMsg('');
    setSelectedTime('');
    // Duración total acumulada de todos los servicios seleccionados
    const dur = selectedActivities.reduce((sum, a) => sum + (a.durationMinutes || 0), 0);
    const primaryActivity = selectedActivities[0];
    api.get(`/public/slots?barber=${selectedBarber._id}&date=${date}&activity=${primaryActivity._id}&duration=${dur}`)
      .then((r) => {
        setSlots(r.data.slots);
        setSlotMinutes(r.data.slotMinutes || 45);
      })
      .catch(() => setMsg('Error cargando horarios'));
  }, [selectedBarber, date, selectedActivities]);

  // Cuando el usuario cambia de barbero, recargar actividades filtradas y limpiar selección
  const handleSelectBarber = (b) => {
    setSelectedBarber(b);
    setSelectedActivities([]);
    setDate('');
    setSelectedTime('');
    setSlots([]);
    setMsg('');
    // Actividades del barbero (si no tiene asignadas, el back devuelve todas)
    if (shopId) {
      api.get(`/public/activities?shop=${shopId}&barber=${b._id}`)
        .then((r) => setActivities(r.data.activities || []))
        .catch(() => {});
    }
  };

  // Toggle de actividad: añadir o quitar del array
  const toggleActivity = (a) => {
    setSelectedActivities((prev) => {
      const idx = prev.findIndex((x) => x._id === a._id);
      if (idx >= 0) {
        // Quitar
        const next = prev.filter((x) => x._id !== a._id);
        return next;
      }
      // Agregar
      return [...prev, a];
    });
    // Si se cambia la selección de servicios, resetear fecha/hora
    setDate('');
    setSelectedTime('');
    setSlots([]);
  };

  // Sincronizar array de integrantes con groupCount
  useEffect(() => {
    setGroupMembers((prev) => {
      const next = [...prev];
      while (next.length < groupCount) next.push({ name: '' });
      return next.slice(0, groupCount);
    });
  }, [groupCount]);

  // Auto-scroll a la fecha seleccionada en la barra
  useEffect(() => {
    if (!date || !dateBarRef.current) return;
    const el = dateBarRef.current.querySelector('.date-item.selected');
    if (el) el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [date]);

  const handleDateSelect = (d) => {
    const key = toDateKey(d);
    if (closedDates.has(key)) return;
    setDate(key);
    setSelectedTime('');
    setSlots([]);
  };

  // Calcula los slots consecutivos que se usarán para el grupo
  const getGroupSlots = (startTime) => {
    if (!isGroup) return [startTime];
    const slotSet = new Set(slots);
    const result = [startTime];
    for (let i = 1; i < groupCount; i++) {
      const next = addMinutes(result[result.length - 1], slotMinutes);
      if (!slotSet.has(next)) return null; // no hay suficientes consecutivos
      result.push(next);
    }
    return result;
  };

  // En modo grupo, solo mostrar horarios donde caben N turnos consecutivos
  const validSlots = isGroup
    ? slots.filter((s) => getGroupSlots(s) !== null)
    : slots;

  const selectedGroupSlots = selectedTime ? (getGroupSlots(selectedTime) || []) : [];

  // --- Paso 1 → Paso 2 ---
  const goToClientStep = () => {
    if (!selectedBarber) return setMsg('Selecciona un profesional');
    if (selectedActivities.length === 0) return setMsg('Selecciona al menos un servicio');
    if (!date || !selectedTime) return setMsg('Selecciona fecha y horario');
    if (isGroup && !getGroupSlots(selectedTime)) {
      return setMsg('No hay suficientes horarios consecutivos disponibles para el grupo');
    }
    setMsg('');
    setStep(2);
  };

  // --- Paso 2: datos del cliente → reservar directo ---
  const handleClientSubmit = async (e) => {
    e.preventDefault();
    if (!clientName || !clientPhone) return setMsg('Nombre y celular son obligatorios');
    const { phone: normalizedPhone, error: phoneError } = normalizeArgPhone(clientPhone, shopAreaCode);
    if (phoneError) return setMsg(phoneError);
    setClientPhone(normalizedPhone);
    if (isGroup) {
      const empty = groupMembers.slice(1).find((m) => !m.name.trim());
      if (empty) return setMsg('Ingresa el nombre de cada integrante del grupo');
    }
    setLoading(true);
    setMsg('');
    try {
      // Registra/actualiza cliente y reserva en un solo paso
      await api.post('/otp/send', { phone: normalizedPhone, name: clientName, email: clientEmail, shopSlug });
      await _doBook({ phone: normalizedPhone });
    } catch (err) {
      setMsg(err.response?.data?.msg || 'Error al confirmar el turno');
    } finally {
      setLoading(false);
    }
  };

  const _doBook = async ({ phone: explicitPhone }) => {
    const groupSlots = getGroupSlots(selectedTime);
    const [primaryActivity, ...restActivities] = selectedActivities;
    const payload = {
      phone: explicitPhone ?? clientPhone,
      shopSlug,
      barberId: selectedBarber._id,
      activityId: primaryActivity._id,
      additionalActivityIds: restActivities.map((a) => a._id),
      date,
      time: selectedTime,
      notes,
      ...(isGroup && groupSlots && {
        additionalMembers: groupMembers.slice(1).map((m, i) => ({
          name: m.name,
          time: groupSlots[i + 1],
        })),
      }),
    };

    const resp = await api.post('/otp/book', payload);
    setReservations(resp.data.reservations || [resp.data.reservation]);
    setSuccess(true);

  };

  // --- Flujo cancelación (sin OTP) ---
  const handleCancelPhoneSubmit = async (e) => {
    e.preventDefault();
    setCancelMsg('');
    const { phone, error } = normalizeArgPhoneAny(cancelPhone);
    if (error) return setCancelMsg(error);
    setCancelLoading(true);
    try {
      const res = await api.post('/otp/verify-cancel', { phone, email: cancelEmail.trim(), shopSlug });
      setCancelPhone(phone);
      setCancelReservations(res.data.reservations);
      setCancelView('list');
    } catch (err) {
      setCancelMsg(err.response?.data?.msg || 'No encontramos turnos para ese número');
    } finally {
      setCancelLoading(false);
    }
  };

  const handleCancelReservation = async (reservationId) => {
    if (!window.confirm('¿Confirmas que querés cancelar este turno?')) return;
    try {
      await api.post('/public/cancel-reservation', { phone: cancelPhone, reservationId });
      setCancelReservations((prev) => prev.filter((r) => r._id !== reservationId));
    } catch (err) {
      setCancelMsg(err.response?.data?.msg || 'Error cancelando turno');
    }
  };

  // --- Reset para reservar otro turno ---
  const resetForm = () => {
    setStep(1);
    setSelectedBarber(null);
    setSelectedActivities([]);
    setDate('');
    setSelectedTime('');
    setSlots([]);
    setNotes('');
    setClientName('');
    setClientPhone('');
    setClientEmail('');
    setMsg('');
    setSuccess(false);
    setReservations([]);
    setIsGroup(false);
    setGroupCount(2);
    setGroupMembers([{ name: '' }, { name: '' }]);
  };

  // --- Pantallas ---

  if (shopError) {
    return <div className="app-card"><p className="error-text">{shopError}</p></div>;
  }

  if (success) {
    const handleActivarPush = async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        return setPushState('unsupported');
      }
      setPushState('loading');
      const phone = clientPhone;
      await subscribeToPush(phone);
      setPushState('done');
    };

    return (
      <div className="app-card">
        <h1>{shopName}</h1>
        <p className="subtitle success-confirm">
          {reservations.length > 1 ? `${reservations.length} turnos reservados!` : '¡Turno reservado!'}
        </p>
        <div className="reservations-summary">
          {reservations.map((r, i) => (
            <div key={r._id || i} className="reservation-summary">
              {reservations.length > 1 && <p className="summary-label">Turno {i + 1}</p>}
              <p><strong>{r.activity?.title}</strong></p>
              <p>Profesional: {r.barber?.name}</p>
              <p>Fecha: {r.date} a las {r.time}</p>
              {r.notes && reservations.length > 1 && <p>Persona: {r.notes.split(' — ')[0]}</p>}
            </div>
          ))}
        </div>

        {/* Activar notificaciones */}
        {pushState === 'idle' && (
          <div className="push-prompt">
            <p>🔔 ¿Querés recibir un recordatorio el día de tu turno a las 8 AM?</p>
            <button type="button" className="btn-push" onClick={handleActivarPush}>
              Activar recordatorio
            </button>
          </div>
        )}
        {pushState === 'loading' && <p className="push-msg">Activando...</p>}
        {pushState === 'done' && <p className="push-msg push-ok">✓ Recordatorio activado</p>}
        {pushState === 'unsupported' && <p className="push-msg">Tu navegador no soporta notificaciones.</p>}

        <button className="btn-confirm" type="button" onClick={resetForm} style={{ marginTop: '16px' }}>
          Reservar otro turno
        </button>
      </div>
    );
  }

  // --- Vistas de turnos del cliente ---
  if (cancelView === 'phone') {
    const fromPush = searchParams.get('ver') === 'mis-turnos';
    return (
      <div className="app-card">
        {shopLogo && <img src={shopLogo} alt={shopName} className="shop-logo" />}
        <h1>{shopName}</h1>
        <p className="subtitle">{fromPush ? '📅 Tus próximos turnos' : 'Cancelar turno'}</p>
        <p className="otp-info">Ingresá el celular y el email con el que registraste tu turno.</p>
        <form onSubmit={handleCancelPhoneSubmit}>
          <input
            className="input-text"
            type="tel"
            placeholder="Celular — Ej: 1161234567"
            value={cancelPhone}
            onChange={(e) => setCancelPhone(e.target.value)}
            required
          />
          <input
            className="input-text"
            type="email"
            placeholder="Email (si lo registraste)"
            value={cancelEmail}
            onChange={(e) => setCancelEmail(e.target.value)}
            style={{ marginTop: '10px' }}
          />
          {cancelMsg && <p className="error-text">{cancelMsg}</p>}
          <div className="form-actions-booking">
            {!fromPush && <button type="button" className="btn-secondary" onClick={() => { setCancelView(null); setCancelMsg(''); setCancelPhone(''); setCancelEmail(''); }}>Volver</button>}
            <button type="submit" className="btn-confirm" disabled={cancelLoading}>{cancelLoading ? 'Buscando...' : 'Ver mis turnos'}</button>
          </div>
        </form>
      </div>
    );
  }

  if (cancelView === 'list') {
    return (
      <div className="app-card">
        {shopLogo && <img src={shopLogo} alt={shopName} className="shop-logo" />}
        <h1>{shopName}</h1>
        <p className="subtitle success-confirm">📅 Tus próximos turnos</p>
        {cancelReservations.length === 0 ? (
          <p className="empty-msg">No tenés turnos activos en este negocio.</p>
        ) : (
          <div className="reservations-summary">
            {cancelReservations.map((r) => (
              <div key={r._id} className="reservation-summary">
                <p><strong>{r.activity?.title}</strong></p>
                <p>Profesional: {r.barber?.name}</p>
                <p>Fecha: {r.date} a las {r.time}</p>
                <button type="button" className="btn-small btn-cancel-sm" style={{ marginTop: '8px' }} onClick={() => handleCancelReservation(r._id)}>Cancelar turno</button>
              </div>
            ))}
          </div>
        )}
        {cancelMsg && <p className="error-text">{cancelMsg}</p>}
        <button type="button" className="btn-confirm" style={{ marginTop: '16px' }} onClick={() => { setCancelView(null); setCancelMsg(''); }}>Reservar un turno</button>
      </div>
    );
  }

  // Paso 1: seleccion de turno
  if (step === 1) {
    const hasBarber = !!selectedBarber;
    const hasServices = selectedActivities.length > 0;
    const hasDate = !!date;

    return (
      <div className="app-card">
        {shopLogo && <img src={shopLogo} alt={shopName} className="shop-logo" />}
        <h1>{shopName || '...'}</h1>
        <p className="subtitle">Turnos Online</p>

        {/* Tipo de reserva */}
        <div className="section-title">Tipo de reserva</div>
        <div className="booking-type-toggle">
          <button
            type="button"
            className={`booking-type-btn${!isGroup ? ' active' : ''}`}
            onClick={() => { setIsGroup(false); setSelectedTime(''); }}
          >
            Individual
          </button>
          <button
            type="button"
            className={`booking-type-btn${isGroup ? ' active' : ''}${!shopAllowsGroup ? ' disabled' : ''}`}
            onClick={() => { if (shopAllowsGroup) { setIsGroup(true); setSelectedTime(''); } }}
            disabled={!shopAllowsGroup}
            title={!shopAllowsGroup ? 'Este negocio no acepta reservas en grupo' : undefined}
          >
            Grupo
          </button>
        </div>

        {isGroup && (
          <div className="group-count-wrap">
            <span className="group-count-label">Cantidad de personas:</span>
            <div className="group-count-controls">
              <button
                type="button"
                className="group-count-btn"
                onClick={() => setGroupCount((c) => Math.max(2, c - 1))}
                disabled={groupCount <= 2}
              >−</button>
              <span className="group-count-num">{groupCount}</span>
              <button
                type="button"
                className="group-count-btn"
                onClick={() => setGroupCount((c) => Math.min(6, c + 1))}
                disabled={groupCount >= 6}
              >+</button>
            </div>
          </div>
        )}

        {/* ── 1. Barbero ── */}
        <div className="section-title">Profesional</div>
        <div className="option-grid">
          {barbers.map((b) => (
            <div
              key={b._id}
              className={`card-opt barber-item ${selectedBarber?._id === b._id ? 'selected' : ''}`}
              onClick={() => handleSelectBarber(b)}
            >
              <strong>{b.name}</strong>
              {b.specialties?.length > 0 && <><br /><small>{b.specialties.join(', ')}</small></>}
            </div>
          ))}
        </div>

        {/* ── 2. Servicios (solo después de elegir barbero) ── */}
        {hasBarber && (
          <>
            <div className="section-title">
              Servicio
              <span className="section-hint"> — podés elegir más de uno</span>
            </div>
            <div className="option-grid">
              {activities.map((a) => {
                const isSelected = selectedActivities.some((x) => x._id === a._id);
                const price = calcFinalPrice(a.price, selectedBarber);
                return (
                  <div
                    key={a._id}
                    className={`card-opt ${isSelected ? 'selected' : ''}`}
                    onClick={() => toggleActivity(a)}
                  >
                    <strong>{a.title}</strong>
                    {a.description && <><br /><small>{a.description}</small></>}
                    <div className="price-duration-col">
                      <span className="price-tag">${Number(price).toLocaleString('es-AR')}</span>
                      {a.durationMinutes && <span className="duration-tag">{a.durationMinutes} min</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Resumen de selección */}
            {hasServices && (
              <div className="booking-summary-bar">
                <span className="summary-services">
                  {selectedActivities.map((a) => a.title).join(' + ')}
                </span>
                <span className="summary-total">
                  Total: <strong>${totalPrice.toLocaleString('es-AR')}</strong>
                  {totalDuration > 0 && <> · {totalDuration} min</>}
                </span>
              </div>
            )}
          </>
        )}

        {/* ── 3. Fecha (solo después de barbero + servicios) ── */}
        {hasBarber && hasServices && (
          <>
            <div className="section-title">Fecha</div>
            <div className="date-bar" ref={dateBarRef}>
              {dates.map((d, i) => {
                const key = toDateKey(d);
                const isSelected = key === date;
                const isClosed = closedDates.has(key);
                return (
                  <div
                    key={i}
                    className={`date-item${isSelected ? ' selected' : ''}${isClosed ? ' disabled' : ''}`}
                    onClick={() => handleDateSelect(d)}
                    title={isClosed ? 'Cerrado' : undefined}
                  >
                    <span className="date-dow">{DAYS_ES[d.getDay()]}</span>
                    <span className="date-num">{d.getDate()}</span>
                    <span className="date-month">{MONTHS_ES[d.getMonth()]}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── 4. Horarios (solo después de fecha) ── */}
        {hasBarber && hasServices && hasDate && validSlots.length > 0 && (
          <>
            <div className="section-title">
              Horario
              {isGroup && ` — solo turnos con ${groupCount} lugares consecutivos`}
              {!isGroup && totalDuration > 0 && (
                <span className="section-hint"> — duración total: {totalDuration} min</span>
              )}
            </div>
            <div className="time-grid">
              {validSlots.map((t) => (
                <div
                  key={t}
                  className={`time-slot ${selectedTime === t ? 'selected' : ''}`}
                  onClick={() => setSelectedTime(t)}
                >
                  {t}
                </div>
              ))}
            </div>

            {/* Preview del rango horario al seleccionar un slot */}
            {selectedTime && !isGroup && totalDuration > 0 && (
              <div className="booking-time-range">
                <span className="time-range-icon">🕐</span>
                <span>
                  Tu turno: <strong>{selectedTime}</strong> hasta <strong>{addMinutes(selectedTime, totalDuration)}</strong>
                </span>
                {selectedActivities.length > 1 && (
                  <span className="time-range-detail">
                    {selectedActivities.map((a, i) => (
                      <span key={a._id}>
                        {i > 0 && ' + '}{a.title} ({a.durationMinutes} min)
                      </span>
                    ))}
                  </span>
                )}
              </div>
            )}
          </>
        )}
        {hasBarber && hasServices && hasDate && validSlots.length === 0 && !msg && (
          <p className="empty-msg">
            {isGroup
              ? `Sin ${groupCount} horarios consecutivos disponibles para este dia.`
              : 'Sin horarios disponibles para este dia.'}
          </p>
        )}

        {/* Vista previa de slots del grupo */}
        {isGroup && selectedTime && selectedGroupSlots.length > 0 && (
          <div className="group-slots-preview">
            <p className="group-slots-title">Horarios asignados al grupo</p>
            {selectedGroupSlots.map((t, i) => (
              <div key={t} className="group-slot-item">
                <span className="group-slot-num">Persona {i + 1}</span>
                <span className="group-slot-time">{t}</span>
              </div>
            ))}
          </div>
        )}

        {/* Notas solo cuando tiene todo elegido */}
        {hasBarber && hasServices && hasDate && (
          <>
            <div className="section-title">Notas (opcional)</div>
            <textarea
              className="input-text"
              placeholder="Alguna aclaracion?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </>
        )}

        {msg && <p className="error-text">{msg}</p>}
        <button className="btn-confirm" type="button" onClick={goToClientStep}>
          Continuar
        </button>
        <div className="form-actions-booking" style={{ marginTop: '12px' }}>
          <button className="btn-secondary" type="button" onClick={() => { setCancelView('phone'); setCancelMsg(''); setCancelEmail(''); }}>
            Ver mis turnos
          </button>
          <button className="btn-secondary" type="button" onClick={() => { setCancelView('phone'); setCancelMsg(''); setCancelEmail(''); }}>
            Cancelar un turno existente
          </button>
        </div>
      </div>
    );
  }

  // Paso 2: datos del cliente
  if (step === 2) {
    return (
      <div className="app-card">
        <h1>{shopName}</h1>
        <p className="subtitle">Tus datos</p>

        <form onSubmit={handleClientSubmit}>
          <div className="section-title">Nombre completo *</div>
          <input
            className="input-text"
            type="text"
            placeholder="Nombre y apellido"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            required
          />

          <div className="section-title">Celular *</div>
          <input
            className="input-text"
            type="tel"
            placeholder={`Ej: ${shopAreaCode} 2345-6789`}
            value={clientPhone}
            onChange={(e) => setClientPhone(e.target.value)}
            required
          />
          <small className="field-hint">Ingresa tu numero con caracteristica {shopAreaCode} — el codigo de pais se agrega automaticamente.</small>

          <div className="section-title">Email <span style={{ fontWeight: 400, fontSize: '0.85em', color: '#6b7280' }}>(opcional)</span></div>
          <input
            className="input-text"
            type="email"
            placeholder="tu@email.com"
            value={clientEmail}
            onChange={(e) => setClientEmail(e.target.value)}
          />
          <small className="field-hint">Si dejás tu email te enviamos un recordatorio el día del turno.</small>

          {/* Integrantes del grupo */}
          {isGroup && (
            <div className="group-members-section">
              <div className="section-title">Integrantes del grupo</div>
              <div className="group-slots-preview" style={{ marginBottom: 12 }}>
                {selectedGroupSlots.map((t, i) => (
                  <div key={t} className="group-slot-item">
                    <span className="group-slot-num">
                      {i === 0 ? clientName || 'Persona 1' : `Persona ${i + 1}`}
                    </span>
                    <span className="group-slot-time">{t}</span>
                  </div>
                ))}
              </div>
              {groupMembers.slice(1).map((member, i) => (
                <div key={i} className="group-member-row">
                  <label className="group-member-label">Nombre persona {i + 2} *</label>
                  <input
                    className="input-text"
                    type="text"
                    placeholder={`Nombre integrante ${i + 2}`}
                    value={member.name}
                    onChange={(e) => {
                      const updated = [...groupMembers];
                      updated[i + 1] = { name: e.target.value };
                      setGroupMembers(updated);
                    }}
                    required
                  />
                </div>
              ))}
            </div>
          )}

          {msg && <p className="error-text">{msg}</p>}
          <div className="form-actions-booking">
            <button type="button" className="btn-secondary" onClick={() => { setStep(1); setMsg(''); }}>
              Volver
            </button>
            <button type="submit" className="btn-confirm" disabled={loading}>
              {loading ? 'Verificando...' : 'Continuar'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  // Paso 2 es el último paso — el turno se confirma al enviar el formulario
  return null;
}
