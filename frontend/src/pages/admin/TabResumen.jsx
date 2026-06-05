import { useEffect, useState } from 'react';
import api from '../../utils/api';

function localToday() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function formatHours(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

function formatMoney(n) {
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
}

export default function TabResumen() {
  const { year: todayYear, month: todayMonth } = localToday();
  const [year, setYear]   = useState(todayYear);
  const [month, setMonth] = useState(todayMonth);
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get('/reservations/monthly-summary', { params: { year, month } })
      .then((r) => setSummary(r.data.summary || []))
      .catch(() => setSummary([]))
      .finally(() => setLoading(false));
  }, [year, month]);

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };
  const isCurrentMonth = year === todayYear && month === todayMonth;

  const totals = summary.reduce((acc, r) => ({
    count: acc.count + r.count,
    minutes: acc.minutes + r.minutes,
    revenue: acc.revenue + r.revenue,
  }), { count: 0, minutes: 0, revenue: 0 });

  return (
    <div>
      {/* Navegador de mes */}
      <div className="date-nav" style={{ marginBottom: 20 }}>
        <button type="button" className="date-nav-btn" onClick={prevMonth}>‹</button>
        <span className="date-nav-label">
          <span className="date-nav-main">{MONTH_NAMES[month - 1]} {year}</span>
        </span>
        <button type="button" className="date-nav-btn" onClick={nextMonth} disabled={isCurrentMonth}>›</button>
        {!isCurrentMonth && (
          <button type="button" className="date-nav-today" onClick={() => { setYear(todayYear); setMonth(todayMonth); }}>
            Hoy
          </button>
        )}
      </div>

      {loading ? (
        <p style={{ color: '#6b7280', textAlign: 'center', padding: 32 }}>Cargando...</p>
      ) : summary.length === 0 ? (
        <p style={{ color: '#6b7280', textAlign: 'center', padding: 32 }}>Sin turnos completados este mes.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="sg-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '8px 12px' }}>Profesional</th>
                <th style={{ textAlign: 'center', padding: '8px 12px' }}>Turnos</th>
                <th style={{ textAlign: 'center', padding: '8px 12px' }}>Horas trabajadas</th>
                <th style={{ textAlign: 'right', padding: '8px 12px' }}>Ingresos</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((row) => (
                <tr key={row.name}>
                  <td style={{ padding: '10px 12px', fontWeight: 500 }}>{row.name}</td>
                  <td style={{ textAlign: 'center', padding: '10px 12px' }}>{row.count}</td>
                  <td style={{ textAlign: 'center', padding: '10px 12px', color: '#6b7280' }}>{formatHours(row.minutes)}</td>
                  <td style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 600 }}>{formatMoney(row.revenue)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid #e5e7eb', fontWeight: 700 }}>
                <td style={{ padding: '10px 12px' }}>Total</td>
                <td style={{ textAlign: 'center', padding: '10px 12px' }}>{totals.count}</td>
                <td style={{ textAlign: 'center', padding: '10px 12px' }}>{formatHours(totals.minutes)}</td>
                <td style={{ textAlign: 'right', padding: '10px 12px' }}>{formatMoney(totals.revenue)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
