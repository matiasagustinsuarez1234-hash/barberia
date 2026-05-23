function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// Algoritmo de Gauss para Pascua
function getEaster(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

// N-ésimo día de semana del mes (weekday: 0=Dom, 1=Lun, ...)
function nthWeekdayOfMonth(year, month, weekday, n) {
  const first = new Date(year, month, 1);
  const diff = (weekday - first.getDay() + 7) % 7;
  return new Date(year, month, 1 + diff + (n - 1) * 7);
}

export function getArgentinaFeriados(year) {
  const easter = getEaster(year);

  const fijos = [
    { date: `${year}-01-01`, name: 'Año Nuevo' },
    { date: `${year}-03-24`, name: 'Día Nacional de la Memoria' },
    { date: `${year}-04-02`, name: 'Malvinas' },
    { date: `${year}-05-01`, name: 'Día del Trabajador' },
    { date: `${year}-05-25`, name: 'Revolución de Mayo' },
    { date: `${year}-07-09`, name: 'Día de la Independencia' },
    { date: `${year}-10-12`, name: 'Diversidad Cultural' },
    { date: `${year}-11-20`, name: 'Soberanía Nacional' },
    { date: `${year}-12-08`, name: 'Inmaculada Concepción' },
    { date: `${year}-12-25`, name: 'Navidad' },
  ];

  const variables = [
    { date: toDateStr(addDays(easter, -48)), name: 'Carnaval (lunes)' },
    { date: toDateStr(addDays(easter, -47)), name: 'Carnaval (martes)' },
    { date: toDateStr(addDays(easter, -2)), name: 'Viernes Santo' },
    // 3er lunes de agosto
    { date: toDateStr(nthWeekdayOfMonth(year, 7, 1, 3)), name: 'Día de San Martín' },
  ];

  return [...fijos, ...variables].sort((a, b) => a.date.localeCompare(b.date));
}
