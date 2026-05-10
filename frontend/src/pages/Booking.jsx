import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../utils/api';
import { normalizeArgPhone } from '../utils/phoneUtils';

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

function surchargeLabel(barber) {
  if (!barber || barber.surchargeType === 'none' || !barber.surchargeValue) return null;
  if (barber.surchargeType === 'percent') return `+${barber.surchargeValue}%`;
  return `+$${Number(barber.surchargeValue).toLocaleString('es-AR')}`;
}

function addMinutes(timeStr, minutes) {
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const nh = Math.floor(total / 60);
  const nm = total % 60;
  return `${nh}:${nm === 0 ? '00' : String(nm).padStart(2, '0')}`;
}

// Paso 1: elegir tipo (individual/grupo), servicio, barbero, fecha y hora
// Paso 2: ingresar nombre, celular y mail → backend verifica si ya existe
//   - Si existe: reserva directa (sin OTP)
//   - Si es nuevo: envía OTP por WhatsApp → paso 3
// Paso 3: ingresar codigo OTP → confirmar reserva

export default function Booking() {
  const { shopSlug } = useParams();
  const dateBarRef = useRef(null);

  const [shopId, setShopId] = useState(null);
  const [shopName, setShopName] = useState('');
  const [shopLogo, setShopLogo] = useState('');
  const [shopAreaCode, setShopAreaCode] = useState('11');
  const [shopError, setShopError] = useState('');

  const [activities, setActivities] = useState([]);
  const [barbers, setBarbers] = useState([]);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [selectedBarber, setSelectedBarber] = useState(null);

  const [dates] = useState(() => generateDates());
  const [date, setDate] = useState('');
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

  // OTP (paso 3)
  const [otpCode, setOtpCode] = useState('');

  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [reservations, setReservations] = useState([]);

  // Resolver slug → shopId
  useEffect(() => {
    api.get(`/public/shops/slug/${shopSlug}`)
      .then((r) => {
        setShopId(r.data.shop._id);
        setShopName(r.data.shop.name);
        setShopAreaCode(r.data.shop.areaCode || '11');
        const rawLogo = r.data.shop.logo || r.data.shop.image || '';
        setShopLogo(rawLogo ? `${API_BASE}${rawLogo}` : '');
      })
      .catch(() => setShopError('Barberia no encontrada'));
  }, [shopSlug]);

  useEffect(() => {
    if (!shopId) return;
    Promise.all([
      api.get(`/public/activities?shop=${shopId}`),
      api.get(`/public/barbers?shop=${shopId}`),
    ]).then(([actResp, barResp]) => {
      setActivities(actResp.data.activities);
      setBarbers(barResp.data.barbers);
      if (actResp.data.activities.length > 0) setSelectedActivity(actResp.data.activities[0]);
      if (barResp.data.barbers.length > 0) setSelectedBarber(barResp.data.barbers[0]);
    }).catch(() => setMsg('Error cargando datos'));
  }, [shopId]);

  useEffect(() => {
    if (!selectedBarber || !date || !selectedActivity) return;
    setMsg('');
    setSelectedTime('');
    api.get(`/public/slots?barber=${selectedBarber._id}&date=${date}&activity=${selectedActivity._id}`)
      .then((r) => {
        setSlots(r.data.slots);
        setSlotMinutes(r.data.slotMinutes || 45);
      })
      .catch(() => setMsg('Error cargando horarios'));
  }, [selectedBarber, date, selectedActivity]);

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
    if (d.getDay() === 0) return; // Domingos cerrado
    setDate(toDateKey(d));
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
    if (!selectedActivity || !selectedBarber || !date || !selectedTime) {
      return setMsg('Completa todos los campos antes de continuar');
    }
    if (isGroup && !getGroupSlots(selectedTime)) {
      return setMsg('No hay suficientes horarios consecutivos disponibles para el grupo');
    }
    setMsg('');
    setStep(2);
  };

  // --- Paso 2: enviar datos → backend decide si necesita OTP ---
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
      const resp = await api.post('/otp/send', {
        phone: normalizedPhone,
        name: clientName,
        email: clientEmail,
        shopSlug,
      });
      if (resp.data.clientExists) {
        await _doBook({ isNew: false });
      } else {
        setStep(3);
      }
    } catch (err) {
      setMsg(err.response?.data?.msg || 'Error enviando codigo');
    } finally {
      setLoading(false);
    }
  };

  // --- Paso 3: verificar OTP y reservar ---
  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    if (!otpCode) return setMsg('Ingresa el codigo');
    setLoading(true);
    setMsg('');
    try {
      await _doBook({ isNew: true, code: otpCode });
    } catch (err) {
      setMsg(err.response?.data?.msg || 'Codigo incorrecto o expirado');
    } finally {
      setLoading(false);
    }
  };

  const _doBook = async ({ isNew, code }) => {
    const groupSlots = getGroupSlots(selectedTime);
    const payload = {
      phone: clientPhone,
      shopSlug,
      barberId: selectedBarber._id,
      activityId: selectedActivity._id,
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

    const endpoint = isNew ? '/otp/verify-and-book' : '/otp/book';
    if (isNew) payload.code = code;

    const resp = await api.post(endpoint, payload);
    setReservations(resp.data.reservations || [resp.data.reservation]);
    setSuccess(true);
  };

  // --- Reset para reservar otro turno ---
  const resetForm = () => {
    setStep(1);
    setDate('');
    setSelectedTime('');
    setSlots([]);
    setNotes('');
    setClientName('');
    setClientPhone('');
    setClientEmail('');
    setOtpCode('');
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
    return (
      <div className="app-card">
        <h1>{shopName}</h1>
        <p className="subtitle success-confirm">
          {reservations.length > 1 ? `${reservations.length} turnos reservados!` : 'Turno reservado!'}
        </p>
        <p className="subtitle">Te enviamos la confirmacion por WhatsApp.</p>
        <div className="reservations-summary">
          {reservations.map((r, i) => (
            <div key={r._id || i} className="reservation-summary">
              {reservations.length > 1 && <p className="summary-label">Turno {i + 1}</p>}
              <p><strong>{r.activity?.title}</strong></p>
              <p>Barbero: {r.barber?.name}</p>
              <p>Fecha: {r.date} a las {r.time}</p>
              {r.notes && reservations.length > 1 && <p>Persona: {r.notes.split(' — ')[0]}</p>}
            </div>
          ))}
        </div>
        <button className="btn-confirm" type="button" onClick={resetForm}>
          Reservar otro turno
        </button>
      </div>
    );
  }

  // Paso 1: seleccion de turno
  if (step === 1) {
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
            className={`booking-type-btn${isGroup ? ' active' : ''}`}
            onClick={() => { setIsGroup(true); setSelectedTime(''); }}
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

        <div className="section-title">Servicio</div>
        <div className="option-grid">
          {activities.map((a) => (
            <div
              key={a._id}
              className={`card-opt ${selectedActivity?._id === a._id ? 'selected' : ''}`}
              onClick={() => setSelectedActivity(a)}
            >
              <strong>{a.title}</strong>
              {a.description && <><br /><small>{a.description}</small></>}
              <span className="price-tag">${Number(a.price).toLocaleString('es-AR')}</span>
            </div>
          ))}
        </div>

        <div className="section-title">Barbero</div>
        <div className="option-grid">
          {barbers.map((b) => (
            <div
              key={b._id}
              className={`card-opt barber-item ${selectedBarber?._id === b._id ? 'selected' : ''}`}
              onClick={() => setSelectedBarber(b)}
            >
              <strong>{b.name}</strong>
              {b.specialties?.length > 0 && <><br /><small>{b.specialties.join(', ')}</small></>}
              {surchargeLabel(b) && <span className="price-tag">{surchargeLabel(b)}</span>}
            </div>
          ))}
        </div>

        {/* Barra horizontal de fechas */}
        {selectedActivity && selectedBarber && surchargeLabel(selectedBarber) && (
          <p className="surcharge-note">
            Precio con {selectedBarber.name}: <strong>${calcFinalPrice(selectedActivity.price, selectedBarber).toLocaleString('es-AR')}</strong>
            <small> ({surchargeLabel(selectedBarber)} sobre el precio base)</small>
          </p>
        )}

        <div className="section-title">Fecha</div>
        <div className="date-bar" ref={dateBarRef}>
          {dates.map((d, i) => {
            const isSunday = d.getDay() === 0;
            const key = toDateKey(d);
            const isSelected = key === date;
            return (
              <div
                key={i}
                className={`date-item${isSelected ? ' selected' : ''}${isSunday ? ' disabled' : ''}`}
                onClick={() => handleDateSelect(d)}
                title={isSunday ? 'Cerrado' : undefined}
              >
                <span className="date-dow">{DAYS_ES[d.getDay()]}</span>
                <span className="date-num">{d.getDate()}</span>
                <span className="date-month">{MONTHS_ES[d.getMonth()]}</span>
              </div>
            );
          })}
        </div>

        {/* Horarios disponibles */}
        {date && validSlots.length > 0 && (
          <>
            <div className="section-title">
              Horario
              {isGroup && ` — solo turnos con ${groupCount} lugares consecutivos`}
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
          </>
        )}
        {date && validSlots.length === 0 && !msg && (
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

        <div className="section-title">Notas (opcional)</div>
        <textarea
          className="input-text"
          placeholder="Alguna aclaracion?"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />

        {msg && <p className="error-text">{msg}</p>}
        <button className="btn-confirm" type="button" onClick={goToClientStep}>
          Continuar
        </button>
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

          <div className="section-title">Email (opcional)</div>
          <input
            className="input-text"
            type="email"
            placeholder="tu@email.com"
            value={clientEmail}
            onChange={(e) => setClientEmail(e.target.value)}
          />

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

  // Paso 3: codigo OTP (solo clientes nuevos)
  return (
    <div className="app-card">
      <h1>{shopName}</h1>
      <p className="subtitle">Verificacion</p>
      <p className="otp-info">
        Te enviamos un codigo de 6 digitos por WhatsApp al <strong>{clientPhone}</strong>.
        Ingresalo para confirmar tu turno.
      </p>

      <form onSubmit={handleOtpSubmit}>
        <input
          className="input-text input-otp"
          type="text"
          inputMode="numeric"
          placeholder="Codigo de 6 digitos"
          maxLength={6}
          value={otpCode}
          onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
          required
        />

        {msg && <p className="error-text">{msg}</p>}
        <div className="form-actions-booking">
          <button type="button" className="btn-secondary" onClick={() => { setStep(2); setMsg(''); setOtpCode(''); }}>
            Volver
          </button>
          <button type="submit" className="btn-confirm" disabled={loading}>
            {loading ? 'Confirmando...' : 'Confirmar turno'}
          </button>
        </div>
      </form>
    </div>
  );
}
