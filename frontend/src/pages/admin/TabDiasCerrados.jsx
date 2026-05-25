import { useEffect, useState } from 'react';
import api from '../../utils/api';

export default function TabDiasCerrados() {
  const [closedDays, setClosedDays] = useState([]);
  const [feriados, setFeriados] = useState([]);
  const [workedFeriados, setWorkedFeriados] = useState(new Set());
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState('error');
  const [loading, setLoading] = useState(false);
  const [confirmData, setConfirmData] = useState(null);
  const [toggling, setToggling] = useState(null); // date que se está toggling

  const load = () => api.get('/closed-days').then((r) => setClosedDays(r.data.closedDays)).catch(() => {});

  const loadFeriados = () => {
    const year = new Date().getFullYear();
    api.get(`/public/feriados?year=${year}`).then((r) => setFeriados(r.data.feriados || [])).catch(() => {});
  };

  const loadWorked = () =>
    api.get('/worked-feriados').then((r) => setWorkedFeriados(new Set(r.data.dates || []))).catch(() => {});

  useEffect(() => { load(); loadFeriados(); loadWorked(); }, []);

  const handleToggleFeriado = async (date) => {
    setToggling(date);
    try {
      if (workedFeriados.has(date)) {
        await api.delete(`/worked-feriados/${date}`);
        setWorkedFeriados((prev) => { const s = new Set(prev); s.delete(date); return s; });
      } else {
        await api.post('/worked-feriados', { date });
        setWorkedFeriados((prev) => new Set([...prev, date]));
      }
    } catch {
      // silencioso
    } finally {
      setToggling(null);
    }
  };

  const handleCheck = async (e) => {
    e.preventDefault();
    setMsg('');
    if (!date) return setMsg('Selecciona una fecha');
    setLoading(true);
    try {
      const resp = await api.get(`/closed-days/check?date=${date}`);
      setConfirmData({ date, reason, count: resp.data.count, reservations: resp.data.reservations });
    } catch (err) {
      setMsg(err.response?.data?.msg || 'Error verificando turnos');
      setMsgType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const resp = await api.post('/closed-days', { date: confirmData.date, reason: confirmData.reason });
      setMsgType('success');
      setMsg(
        resp.data.cancelledCount > 0
          ? `Dia cerrado. Se cancelaron ${resp.data.cancelledCount} turno${resp.data.cancelledCount !== 1 ? 's' : ''} y los clientes fueron notificados.`
          : 'Dia marcado como cerrado. No habia turnos pendientes.'
      );
      setDate('');
      setReason('');
      setConfirmData(null);
      load();
    } catch (err) {
      setMsg(err.response?.data?.msg || 'Error cerrando el dia');
      setMsgType('error');
      setConfirmData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    await api.delete(`/closed-days/${id}`);
    load();
  };

  return (
    <div>
      {!confirmData ? (
        <form className="admin-form" onSubmit={handleCheck}>
          <h3>Marcar dia no laborable</h3>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            required
          />
          <input
            type="text"
            placeholder="Motivo (opcional, se envia a los clientes)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          {msg && <p className={msgType === 'success' ? 'success-text' : 'error-text'}>{msg}</p>}
          <button type="submit" className="btn-confirm" disabled={loading}>
            {loading ? 'Verificando...' : 'Continuar'}
          </button>
        </form>
      ) : (
        <div className="admin-form">
          <h3>Confirmar cierre del dia</h3>
          <p><strong>Fecha:</strong> {confirmData.date}</p>
          {confirmData.reason && <p><strong>Motivo:</strong> {confirmData.reason}</p>}
          {confirmData.count > 0 ? (
            <>
              <p className="error-text">
                Hay <strong>{confirmData.count} turno{confirmData.count !== 1 ? 's' : ''} pactado{confirmData.count !== 1 ? 's' : ''}</strong> para este dia.
                Al confirmar, se cancelaran automaticamente y los clientes seran notificados por WhatsApp.
              </p>
              <div className="admin-list" style={{ marginBottom: '12px' }}>
                {confirmData.reservations.map((r) => (
                  <div key={r._id} className="admin-list-item">
                    <div>
                      <strong>{r.client?.name}</strong>
                      <span className="tag-list">{r.time} — {r.activity?.title} con {r.barber?.name}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="success-text">No hay turnos pactados para este dia.</p>
          )}
          <div className="form-actions">
            <button type="button" className="btn-confirm" onClick={handleConfirm} disabled={loading}>
              {loading ? 'Procesando...' : 'Si, cerrar el dia'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setConfirmData(null)}>Cancelar</button>
          </div>
        </div>
      )}

      <h3 style={{ marginTop: '24px' }}>Dias cerrados programados</h3>
      <div className="admin-list">
        {closedDays.length === 0 && <p className="empty-msg">No hay dias cerrados programados.</p>}
        {closedDays.map((d) => (
          <div key={d._id} className="admin-list-item">
            <div>
              <strong>{d.date}</strong>
              {d.reason && <span className="tag-list">{d.reason}</span>}
            </div>
            <div className="item-actions">
              <button type="button" className="btn-icon btn-danger" title="Reabrir dia" onClick={() => handleDelete(d._id)}>🗑</button>
            </div>
          </div>
        ))}
      </div>

      <h3 style={{ marginTop: '28px' }}>Feriados nacionales {new Date().getFullYear()}</h3>
      <p className="wa-subtitle">
        Por defecto los feriados se bloquean en el calendario. Activá el check en los que vayas a trabajar.
      </p>
      <div className="admin-list feriados-list">
        {feriados.map((f) => {
          const worked = workedFeriados.has(f.date);
          return (
            <div key={f.date} className={`admin-list-item feriado-item ${worked ? 'feriado-worked' : ''}`}>
              <label className="feriado-label">
                <input
                  type="checkbox"
                  checked={worked}
                  disabled={toggling === f.date}
                  onChange={() => handleToggleFeriado(f.date)}
                />
                <div className="feriado-info">
                  <strong>{f.date}</strong>
                  <span>{f.name}</span>
                </div>
              </label>
              <span className={`feriado-badge ${worked ? 'badge-worked' : 'badge-closed'}`}>
                {worked ? 'Trabajamos' : 'Cerrado'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
