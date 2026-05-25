import { useEffect, useState } from 'react';
import api from '../../utils/api';

function formatRunAt(iso) {
  const d = new Date(iso);
  return d.toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function StatusIcon({ log }) {
  if (log.errorCount > 0)                          return <span className="rl-icon error">✗</span>;
  if (log.sent === 0 && log.skipped === 0)     return <span className="rl-icon neutral">—</span>;
  return <span className="rl-icon ok">✓</span>;
}

export default function TabRecordatorios() {
  const [logs, setLogs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null); // id del log con errores expandido

  useEffect(() => {
    api.get('/reminder-logs')
      .then((r) => setLogs(r.data.logs || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Cargando...</p>;

  return (
    <div className="rl-wrap">
      <div className="rl-header">
        <h3>Historial de recordatorios</h3>
        <p className="rl-subtitle">
          El job corre todos los días a las 8 AM y envía recordatorios a los clientes con turno ese día.
          Se muestran las últimas 60 ejecuciones.
        </p>
      </div>

      {logs.length === 0 ? (
        <p className="empty-msg">Todavía no hay ejecuciones registradas.</p>
      ) : (
        <table className="rl-table">
          <thead>
            <tr>
              <th>Estado</th>
              <th>Fecha de turnos</th>
              <th>Ejecutado</th>
              <th>Enviados</th>
              <th>Errores</th>
              <th>Sin plan</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <>
                <tr key={log._id} className={log.errorCount > 0 ? 'rl-row-error' : ''}>
                  <td className="rl-td-icon"><StatusIcon log={log} /></td>
                  <td className="rl-td-date">{log.date}</td>
                  <td className="rl-td-run">{formatRunAt(log.runAt)}</td>
                  <td className="rl-td-num ok">{log.sent}</td>
                  <td className="rl-td-num error">{log.errorCount > 0 ? log.errorCount : '—'}</td>
                  <td className="rl-td-num neutral">{log.skipped > 0 ? log.skipped : '—'}</td>
                  <td>
                    {log.errorCount > 0 && (
                      <button
                        type="button"
                        className="btn-icon"
                        onClick={() => setExpanded(expanded === log._id ? null : log._id)}
                        title="Ver detalle de errores"
                      >
                        {expanded === log._id ? '▲' : '▼'}
                      </button>
                    )}
                  </td>
                </tr>

                {/* Detalle de errores expandible */}
                {expanded === log._id && log.failedList?.length > 0 && (
                  <tr key={`${log._id}-detail`} className="rl-detail-row">
                    <td colSpan={7}>
                      <div className="rl-detail">
                        <p className="rl-detail-title">Mensajes que fallaron:</p>
                        <ul className="rl-detail-list">
                          {log.failedList.map((f, i) => (
                            <li key={i}>
                              <strong>{f.name}</strong> · {f.phone}
                              <span className="rl-detail-error"> — {f.error}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
