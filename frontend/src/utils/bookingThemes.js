export const BOOKING_THEMES = [
  { id: 'classic',   label: 'Clásico',   fondo: '#ffffff', componentes: '#111111', letras: '#111111' },
  { id: 'noche',     label: 'Noche',     fondo: '#0f172a', componentes: '#818cf8', letras: '#e2e8f0' },
  { id: 'bosque',    label: 'Bosque',    fondo: '#f0fdf4', componentes: '#166534', letras: '#14532d' },
  { id: 'atardecer', label: 'Atardecer', fondo: '#fff7ed', componentes: '#ea580c', letras: '#431407' },
  { id: 'mar',       label: 'Mar',       fondo: '#ecfeff', componentes: '#0891b2', letras: '#164e63' },
  { id: 'rosa',      label: 'Rosa',      fondo: '#fdf2f8', componentes: '#be185d', letras: '#500724' },
  { id: 'carbon',    label: 'Carbón',    fondo: '#1c1c1c', componentes: '#f59e0b', letras: '#fafafa' },
  { id: 'lavanda',   label: 'Lavanda',   fondo: '#f5f3ff', componentes: '#7c3aed', letras: '#2e1065' },
  { id: 'pizarra',   label: 'Pizarra',   fondo: '#f1f5f9', componentes: '#0f172a', letras: '#0f172a' },
  { id: 'coral',     label: 'Coral',     fondo: '#fff1f0', componentes: '#e11d48', letras: '#4c0519' },
];

export function getTheme(id) {
  return BOOKING_THEMES.find((t) => t.id === id) || BOOKING_THEMES[0];
}
