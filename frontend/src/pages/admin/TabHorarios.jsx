import { useEffect, useRef, useState } from 'react';
import api from '../../utils/api';

const DAYS_ORDER  = [1, 2, 3, 4, 5, 6, 0];           // Lun → Dom
const DAY_SHORT   = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DAY_FULL    = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export default function TabHorarios() {
  const [schedules, setSchedules] = useState([]);
  const [barbers,   setBarbers]   = useState([]);
  const [form, setForm] = useState({ barber: '', weekdays: [], startTime: '10:00', endTime: '20:00', slotMinutes: 30 });
  const [msg,     setMsg]     = useState('');
  const [msgType, setMsgType] = useState('error');
  const formRef = useRef(null);

  const load = () => {
    api.get('/schedules').then((r) => setSchedules(r.data.schedules || [])).catch(() => {});
    api.get('/barbers').then((r) => setBarbers(r.data.barbers || [])).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const toggleWeekday = (day) => setForm((p) => ({
    ...p,
    weekdays: p.weekdays.includes(day) ? p.weekdays.filter((d) => d !== day) : [...p.weekdays, day],
  }));

  // Click en "＋" de la grilla: pre-rellena barbero + día y sube al form
  const handleAddCell = (barberId, day) => {
    setForm((p) => ({
      ...p,
      barber: barberId,
      weekdays: p.weekdays.includes(day) ? p.weekdays : [...p.weekdays, day],
    }));
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg('');
    if (form.weekdays.length === 0) { setMsgType('error'); setMsg('Seleccioná al menos un día'); return; }
    const errors = [];
    for (const weekday of [...form.weekdays].sort()) {
      try {
        await api.post('/schedules', { ...form, weekday });
      } catch (err) {
        errors.push(`${DAY_FULL[weekday]}: ${err.response?.data?.msg || 'Error'}`);
      }
    }
    setMsgType(errors.length ? 'error' : 'success');
    setMsg(errors.length ? errors.join(' · ') : 'Horarios guardados');
    setForm((p) => ({ ...p, weekdays: [] }));
    load();
  };

  const deleteSchedule = async (id) => {
    if (!confirm('¿Eliminar este horario?')) return;
    try {
      await api.delete(`/schedules/${id}`);
      load();
    } catch (err) {
      setMsgType('error');
      setMsg(err.response?.data?.msg || 'Error al eliminar el horario');
    }
  };

  // Índice rápido: scheduleByBarberDay[barberId][weekday] = schedule
  const scheduleMap = {};
  for (const s of schedules) {
    const bid = s.barber?._id;
    if (!bid) continue;
    if (!scheduleMap[bid]) scheduleMap[bid] = {};
    scheduleMap[bid][s.weekday] = s;
  }

  return (
    <div>
      {/* ── Formulario ── */}
      <div ref={formRef}>
        <form className="admin-form" onSubmit={handleSubmit}>
          <h3>Asignar Horario</h3>
          <select name="barber" value={form.barber} onChange={handleChange} required>
            <option value="">Seleccionar profesional *</option>
            {barbers.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
          </select>
          <div className="weekday-chips">
            {DAY_FULL.map((d, i) => (
              <label key={i} className={`weekday-chip ${form.weekdays.includes(i) ? 'selected' : ''}`}>
                <input type="checkbox" checked={form.weekdays.includes(i)} onChange={() => toggleWeekday(i)} />
                {d}
              </label>
            ))}
          </div>
          <div className="form-row">
            <label>Inicio<input name="startTime" type="time" value={form.startTime} onChange={handleChange} /></label>
            <label>Fin<input name="endTime" type="time" value={form.endTime} onChange={handleChange} /></label>
            <label>Slot (min)<input name="slotMinutes" type="number" value={form.slotMinutes} onChange={handleChange} /></label>
          </div>
          <button type="submit" className="btn-confirm">Guardar Horario</button>
          {msg && <p className={msgType === 'success' ? 'success-text' : 'error-text'}>{msg}</p>}
        </form>
      </div>

      {/* ── Grilla ── */}
      {barbers.length > 0 && (
        <div className="horarios-grid-wrap">
          <table className="horarios-grid">
            <thead>
              <tr>
                <th className="hg-th-name">Profesional</th>
                {DAYS_ORDER.map((d) => (
                  <th key={d} className="hg-th-day">{DAY_SHORT[d]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {barbers.map((b) => (
                <tr key={b._id}>
                  <td className="hg-td-name">{b.name}</td>
                  {DAYS_ORDER.map((day) => {
                    const sched = scheduleMap[b._id]?.[day];
                    return (
                      <td key={day} className={`hg-td-cell${sched ? ' hg-has-sched' : ' hg-empty'}`}>
                        {sched ? (
                          <div className="hg-sched">
                            <span className="hg-times">{sched.startTime}<br />{sched.endTime}</span>
                            <span className="hg-slot">{sched.slotMinutes}′</span>
                            <button
                              type="button"
                              className="hg-del"
                              onClick={() => deleteSchedule(sched._id)}
                              title="Eliminar horario"
                            >✕</button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="hg-add"
                            onClick={() => handleAddCell(b._id, day)}
                            title={`Agregar horario ${DAY_FULL[day]}`}
                          >＋</button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
