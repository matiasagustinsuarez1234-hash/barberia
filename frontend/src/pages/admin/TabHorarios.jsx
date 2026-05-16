import { useEffect, useState } from 'react';
import api from '../../utils/api';

const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];

export default function TabHorarios() {
  const [schedules, setSchedules] = useState([]);
  const [barbers, setBarbers] = useState([]);
  const [form, setForm] = useState({ barber: '', weekdays: [], startTime: '10:00', endTime: '20:00', slotMinutes: 30 });
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState('error');

  const load = () => {
    api.get('/schedules').then((r) => setSchedules(r.data.schedules)).catch(() => {});
    api.get('/barbers').then((r) => setBarbers(r.data.barbers)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const toggleWeekday = (day) => {
    setForm((p) => ({
      ...p,
      weekdays: p.weekdays.includes(day)
        ? p.weekdays.filter((d) => d !== day)
        : [...p.weekdays, day],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg('');
    if (form.weekdays.length === 0) {
      setMsgType('error');
      setMsg('Selecciona al menos un dia');
      return;
    }
    const errors = [];
    for (const weekday of [...form.weekdays].sort()) {
      try {
        await api.post('/schedules', { ...form, weekday });
      } catch (err) {
        errors.push(`${WEEKDAYS[weekday]}: ${err.response?.data?.msg || 'Error'}`);
      }
    }
    if (errors.length > 0) {
      setMsgType('error');
      setMsg(errors.join(' | '));
    } else {
      setMsgType('success');
      setMsg('Horarios guardados correctamente');
    }
    setForm((p) => ({ ...p, weekdays: [], startTime: '10:00', endTime: '20:00', slotMinutes: 30 }));
    load();
  };

  const deleteSchedule = async (id) => { if (!confirm('Eliminar horario?')) return; await api.delete(`/schedules/${id}`); load(); };

  return (
    <div>
      <form className="admin-form" onSubmit={handleSubmit}>
        <h3>Asignar Horario</h3>
        <select name="barber" value={form.barber} onChange={handleChange} required>
          <option value="">Seleccionar barbero *</option>
          {barbers.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
        </select>
        <div className="weekday-chips">
          {WEEKDAYS.map((d, i) => (
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
      <div className="admin-list">
        {schedules.map((s) => (
          <div key={s._id} className="admin-list-item">
            <div>
              <strong>{s.barber?.name}</strong> &mdash;
              <span className="tag-list">{WEEKDAYS[s.weekday]}: {s.startTime} - {s.endTime} ({s.slotMinutes} min)</span>
            </div>
            <div className="item-actions">
              <button type="button" className="btn-icon btn-danger" onClick={() => deleteSchedule(s._id)}>🗑</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
