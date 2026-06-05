import { useEffect, useState } from 'react';
import api from '../../utils/api';

const MONTH_SHORT = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const COLORS = ['#6366f1','#f59e0b','#10b981','#ef4444','#3b82f6','#8b5cf6','#ec4899','#14b8a6'];

function fmtMonth(key) {
  const [y, m] = key.split('-');
  return `${MONTH_SHORT[parseInt(m, 10) - 1]}-${y.slice(2)}`;
}

function fmtMoney(n) {
  if (n === 0) return '—';
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${Math.round(n / 1000)}k`;
  return `$${n}`;
}

function fmtMoneyFull(n) {
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
}

function fmtHours(minutes) {
  if (minutes === 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

function BarChart({ months, barbers }) {
  const PAD = { top: 20, right: 16, bottom: 28, left: 52 };
  const H = 180;

  const maxRevenue = Math.max(
    1,
    ...months.flatMap((mk) => barbers.map((b) => b.months[mk]?.revenue || 0)),
  );

  const yTicks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div style={{ overflowX: 'auto', marginTop: 24 }}>
      <svg
        viewBox={`0 0 ${Math.max(400, months.length * 80)} ${H + PAD.top + PAD.bottom}`}
        style={{ width: '100%', display: 'block' }}
        preserveAspectRatio="xMinYMin meet"
      >
        {(() => {
          const W = Math.max(400, months.length * 80);
          const innerW = W - PAD.left - PAD.right;
          const innerH = H;
          const groupW = innerW / months.length;
          const barW = Math.max(6, Math.min(28, (groupW - 12) / barbers.length));

          return (
            <>
              {yTicks.map((p) => {
                const y = PAD.top + (1 - p) * innerH;
                const val = maxRevenue * p;
                return (
                  <g key={p}>
                    <line x1={PAD.left} x2={PAD.left + innerW} y1={y} y2={y} stroke={p === 0 ? '#d1d5db' : '#f3f4f6'} strokeWidth={1} />
                    <text x={PAD.left - 6} y={y + 3} textAnchor="end" fontSize={9} fill="#9ca3af">{fmtMoney(val)}</text>
                  </g>
                );
              })}

              {months.map((mk, mi) => {
                const cx = PAD.left + mi * groupW + groupW / 2;
                return (
                  <g key={mk}>
                    {barbers.map((b, bi) => {
                      const v = b.months[mk]?.revenue || 0;
                      const barH = (v / maxRevenue) * innerH;
                      const x = cx - (barbers.length * barW) / 2 + bi * barW;
                      return (
                        <rect
                          key={b.name}
                          x={x} y={PAD.top + innerH - barH}
                          width={barW - 1} height={barH}
                          fill={COLORS[bi % COLORS.length]}
                          opacity={0.85}
                          rx={2}
                        >
                          <title>{b.name}: {fmtMoneyFull(v)}</title>
                        </rect>
                      );
                    })}
                    <text x={cx} y={PAD.top + innerH + 14} textAnchor="middle" fontSize={10} fill="#6b7280">{fmtMonth(mk)}</text>
                  </g>
                );
              })}
            </>
          );
        })()}
      </svg>

      {/* Leyenda */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 }}>
        {barbers.map((b, i) => (
          <div key={b.name} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#6b7280' }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: COLORS[i % COLORS.length], display: 'inline-block' }} />
            {b.name}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TabResumen() {
  const [nMonths, setNMonths] = useState(6);
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    setLoading(true);
    api.get('/reservations/multi-month-summary', { params: { months: nMonths } })
      .then((r) => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [nMonths]);

  const toggle = (name) => setExpanded((prev) => ({ ...prev, [name]: !prev[name] }));

  const months  = data?.months || [];
  const barbers = data?.barbers || [];

  const totals = months.map((mk) => ({
    key: mk,
    revenue: barbers.reduce((s, b) => s + (b.months[mk]?.revenue || 0), 0),
    count:   barbers.reduce((s, b) => s + (b.months[mk]?.count || 0), 0),
    minutes: barbers.reduce((s, b) => s + (b.months[mk]?.minutes || 0), 0),
  }));

  const thStyle = { padding: '8px 14px', fontWeight: 600, fontSize: 13, color: '#374151', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap' };
  const tdStyle = { padding: '9px 14px', fontSize: 13, borderBottom: '1px solid #f3f4f6', whiteSpace: 'nowrap' };
  const tdNum   = { ...tdStyle, textAlign: 'right' };
  const tdSub   = { ...tdStyle, textAlign: 'right', color: '#6b7280', fontSize: 12, background: '#f9fafb', paddingTop: 5, paddingBottom: 5 };

  return (
    <div>
      {/* Selector de rango */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <span style={{ fontSize: 13, color: '#6b7280' }}>Últimos</span>
        {[3, 6, 12].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setNMonths(n)}
            style={{
              padding: '4px 14px', borderRadius: 20, border: '1px solid',
              borderColor: nMonths === n ? '#111' : '#d1d5db',
              background: nMonths === n ? '#111' : '#fff',
              color: nMonths === n ? '#fff' : '#374151',
              fontSize: 13, cursor: 'pointer', fontWeight: nMonths === n ? 600 : 400,
            }}
          >
            {n} meses
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: '#6b7280', textAlign: 'center', padding: 40 }}>Cargando...</p>
      ) : !data || barbers.length === 0 ? (
        <p style={{ color: '#6b7280', textAlign: 'center', padding: 40 }}>Sin datos para el período.</p>
      ) : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, textAlign: 'left' }}>Profesional</th>
                  {months.map((mk) => (
                    <th key={mk} style={{ ...thStyle, textAlign: 'right' }}>{fmtMonth(mk)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {barbers.map((b, bi) => (
                  <>
                    <tr
                      key={b.name}
                      onClick={() => toggle(b.name)}
                      style={{ cursor: 'pointer', background: expanded[b.name] ? '#f9fafb' : '#fff' }}
                    >
                      <td style={{ ...tdStyle, fontWeight: 500 }}>
                        <span style={{ marginRight: 6, fontSize: 11, color: '#9ca3af' }}>
                          {expanded[b.name] ? '▼' : '▶'}
                        </span>
                        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: COLORS[bi % COLORS.length], marginRight: 8, verticalAlign: 'middle' }} />
                        {b.name}
                      </td>
                      {months.map((mk) => (
                        <td key={mk} style={{ ...tdNum, fontWeight: 600 }}>
                          {fmtMoney(b.months[mk]?.revenue || 0)}
                        </td>
                      ))}
                    </tr>

                    {expanded[b.name] && (
                      <>
                        <tr key={`${b.name}-turnos`}>
                          <td style={{ ...tdSub, paddingLeft: 32 }}>Turnos</td>
                          {months.map((mk) => (
                            <td key={mk} style={tdSub}>{b.months[mk]?.count || '—'}</td>
                          ))}
                        </tr>
                        <tr key={`${b.name}-horas`}>
                          <td style={{ ...tdSub, paddingLeft: 32 }}>Horas</td>
                          {months.map((mk) => (
                            <td key={mk} style={tdSub}>{fmtHours(b.months[mk]?.minutes || 0)}</td>
                          ))}
                        </tr>
                      </>
                    )}
                  </>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid #e5e7eb' }}>
                  <td style={{ ...tdStyle, fontWeight: 700 }}>Total</td>
                  {totals.map((t) => (
                    <td key={t.key} style={{ ...tdNum, fontWeight: 700 }}>{fmtMoney(t.revenue)}</td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>

          <BarChart months={months} barbers={barbers} />
        </>
      )}
    </div>
  );
}
