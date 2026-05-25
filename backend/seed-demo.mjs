/**
 * seed-demo.mjs — Genera barberos, horarios, actividades y turnos de prueba
 *
 * Uso (desde la carpeta backend/):
 *   node seed-demo.mjs              → crea/asegura datos demo (barberos, horarios, actividades, turnos)
 *   node seed-demo.mjs --regenerar  → idem (alias explícito)
 *   node seed-demo.mjs --limpiar    → borra TODO lo demo (turnos, barberos, horarios, actividades)
 */

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync } from 'fs';
import mongoose from 'mongoose';

// ── Configuración ─────────────────────────────────────────────────────────────

const SHOP_SLUG        = 'barberiatest';
const TEST_PHONE       = '5491130755116';
const TEST_CLIENT_NAME = 'Demo Cliente';
const DAYS_AHEAD       = 14;          // días hacia adelante a poblar
const OCCUPANCY_MIN    = 0.40;
const OCCUPANCY_MAX    = 0.65;

// Prefijo que identifica recursos creados por este script
const DEMO_PREFIX = '[DEMO]';

// ── 8 actividades demo ────────────────────────────────────────────────────────

const DEMO_ACTIVITIES = [
  { title: 'Corte de pelo clásico',   price: 15000, durationMinutes: 30 },
  { title: 'Corte de barba',          price: 10000, durationMinutes: 20 },
  { title: 'Corte + barba combo',     price: 22000, durationMinutes: 45 },
  { title: 'Afeitado navaja',         price: 13000, durationMinutes: 30 },
  { title: 'Degradé / Fade',          price: 18000, durationMinutes: 45 },
  { title: 'Coloración / Mechas',     price: 40000, durationMinutes: 90 },
  { title: 'Tratamiento capilar',     price: 15000, durationMinutes: 30 },
  { title: 'Diseño de cejas',         price: 8000,  durationMinutes: 15 },
];

// ── 4 barberos demo ───────────────────────────────────────────────────────────

const DEMO_BARBERS = [
  { name: `${DEMO_PREFIX} Lucas`,   specialties: ['Corte clásico', 'Barba'],      startTime: '09:00', endTime: '18:00', slotMinutes: 30, surchargeType: 'none',    surchargeValue: 0  },
  { name: `${DEMO_PREFIX} Matías`,  specialties: ['Fade', 'Degradé'],             startTime: '10:00', endTime: '19:00', slotMinutes: 30, surchargeType: 'none',    surchargeValue: 0  },
  { name: `${DEMO_PREFIX} Ramiro`,  specialties: ['Coloración', 'Corte moderno'], startTime: '09:00', endTime: '17:00', slotMinutes: 45, surchargeType: 'none',    surchargeValue: 0  },
  { name: `${DEMO_PREFIX} Nicolás`, specialties: ['Diseño de barba', 'Afeitado'], startTime: '11:00', endTime: '20:00', slotMinutes: 30, surchargeType: 'none',    surchargeValue: 0  },
  { name: `${DEMO_PREFIX} ⭐ Dante`, specialties: ['Fade premium', 'Diseño'],      startTime: '10:00', endTime: '20:00', slotMinutes: 30, surchargeType: 'percent', surchargeValue: 10 },
];

// Lunes (1) a Sábado (6)
const WEEKDAYS_LUN_SAB = [1, 2, 3, 4, 5, 6];

// ── Leer .env ─────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const envLines  = readFileSync(resolve(__dirname, '.env'), 'utf8').split('\n');
const env       = {};
for (const line of envLines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const idx = trimmed.indexOf('=');
  if (idx === -1) continue;
  env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
}
const MONGO_URI = env.MONGO_URI;
if (!MONGO_URI) { console.error('❌  MONGO_URI no encontrado en .env'); process.exit(1); }

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeToMin(t) { const [h, m] = t.split(':').map(Number); return h * 60 + m; }
function minToTime(m) { return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; }
function generateSlots(start, end, step) {
  const slots = [];
  for (let t = timeToMin(start); t < timeToMin(end); t += step) slots.push(minToTime(t));
  return slots;
}
function dateStr(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function getWeekday(offsetDays) { const d = new Date(); d.setDate(d.getDate() + offsetDays); return d.getDay(); }
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// ── Esquemas mínimos ──────────────────────────────────────────────────────────

const S     = mongoose.Schema;
const ObjId = S.Types.ObjectId;

const Client      = mongoose.models.Client      || mongoose.model('Client',      new S({ name: String, phone: String, username: String, email: String }));
const Barbershop  = mongoose.models.Barbershop  || mongoose.model('Barbershop',  new S({ name: String, slug: String, active: Boolean }));
const Barber      = mongoose.models.Barber      || mongoose.model('Barber',      new S({ name: String, shop: ObjId, active: Boolean, specialties: [String], surchargeType: String, surchargeValue: Number }));
const Activity    = mongoose.models.Activity    || mongoose.model('Activity',    new S({ title: String, price: Number, durationMinutes: Number, shop: ObjId, notes: String }));
const Schedule    = mongoose.models.Schedule    || mongoose.model('Schedule',    new S({ barber: ObjId, shop: ObjId, weekday: Number, startTime: String, endTime: String, slotMinutes: Number, active: Boolean }));
const Reservation = mongoose.models.Reservation || mongoose.model('Reservation', new S({ shop: ObjId, barber: ObjId, activity: ObjId, client: ObjId, date: String, time: String, endTime: String, status: String, notes: String }));

// ── Main ──────────────────────────────────────────────────────────────────────

const LIMPIAR   = process.argv.includes('--limpiar');
const REGENERAR = process.argv.includes('--regenerar') || (!LIMPIAR);

async function run() {
  console.log(`\n🔌  Conectando a MongoDB...`);
  await mongoose.connect(MONGO_URI);
  console.log(`✅  Conectado\n`);

  // Buscar negocio
  const shop = await Barbershop.findOne({ slug: SHOP_SLUG });
  if (!shop) {
    console.error(`❌  No se encontró el negocio con slug "${SHOP_SLUG}"`);
    const all = await Barbershop.find({}, 'name slug');
    all.forEach(s => console.error(`      • ${s.name}  →  slug: "${s.slug}"`));
    await mongoose.disconnect(); process.exit(1);
  }
  console.log(`🏪  Negocio: ${shop.name} (slug: ${shop.slug})\n`);

  // ── --limpiar: borra TODO lo demo, sin re-sembrar ─────────────────────────
  if (LIMPIAR) {
    console.log(`🗑   Limpiando datos demo del shop "${shop.name}"...\n`);

    // Turnos [TEST]
    const res = await Reservation.deleteMany({ shop: shop._id, notes: '[TEST]' });
    console.log(`    Turnos [TEST] borrados:   ${res.deletedCount}`);

    // Barberos [DEMO] y sus horarios
    const demoBarberNames = DEMO_BARBERS.map(b => b.name);
    const demoBarbers     = await Barber.find({ shop: shop._id, name: { $in: demoBarberNames } }, '_id');
    const demoBarberIds   = demoBarbers.map(b => b._id);

    const sch = await Schedule.deleteMany({ barber: { $in: demoBarberIds } });
    const bar = await Barber.deleteMany({ _id: { $in: demoBarberIds } });
    console.log(`    Barberos [DEMO] borrados: ${bar.deletedCount}`);
    console.log(`    Horarios borrados:        ${sch.deletedCount}`);

    // Actividades [DEMO]
    const demoTitles = DEMO_ACTIVITIES.map(a => a.title);
    const act = await Activity.deleteMany({ shop: shop._id, title: { $in: demoTitles } });
    console.log(`    Actividades demo borradas:${act.deletedCount}`);

    console.log(`\n✅  Limpieza completa.`);
    console.log(`💡  Para volver a generar datos: node seed-demo.mjs\n`);
    await mongoose.disconnect(); return;
  }

  // ── Seed / --regenerar ────────────────────────────────────────────────────

  // ── Buscar/crear cliente de prueba ────────────────────────────────────────
  let client = await Client.findOne({ phone: TEST_PHONE });
  if (!client) {
    client = await Client.create({ name: TEST_CLIENT_NAME, phone: TEST_PHONE, username: `demo_${Date.now()}`, email: '' });
    console.log(`👤  Cliente creado: ${client.name}`);
  } else {
    console.log(`👤  Cliente: ${client.name} (${TEST_PHONE})`);
  }

  // ── Crear/actualizar actividades demo ─────────────────────────────────────
  console.log(`\n✂️   Sincronizando ${DEMO_ACTIVITIES.length} actividades demo...`);
  const activities = [];
  for (const def of DEMO_ACTIVITIES) {
    let act = await Activity.findOne({ shop: shop._id, title: def.title });
    if (!act) {
      act = await Activity.create({ shop: shop._id, title: def.title, price: def.price, durationMinutes: def.durationMinutes });
      console.log(`   ✚ Creada: ${def.title} (${def.durationMinutes} min, $${def.price.toLocaleString('es-AR')})`);
    } else {
      console.log(`   ✓ Ya existe: ${def.title}`);
    }
    activities.push(act);
  }

  // ── Crear/actualizar barberos demo ────────────────────────────────────────
  console.log(`\n💈  Sincronizando ${DEMO_BARBERS.length} barberos demo...`);
  const barbers = [];
  for (const def of DEMO_BARBERS) {
    let barber = await Barber.findOne({ shop: shop._id, name: def.name });
    if (!barber) {
      barber = await Barber.create({ shop: shop._id, name: def.name, specialties: def.specialties, active: true, surchargeType: def.surchargeType, surchargeValue: def.surchargeValue });
      const surchargeLabel = def.surchargeType === 'percent' ? ` (+${def.surchargeValue}%)` : def.surchargeType === 'fixed' ? ` (+$${def.surchargeValue})` : '';
      console.log(`   ✚ Creado: ${def.name}${surchargeLabel}`);
    } else {
      console.log(`   ✓ Ya existe: ${def.name}`);
    }
    barbers.push({ barber, def });
  }

  // ── Crear horarios Lun–Sab para cada barbero demo ────────────────────────
  console.log(`\n📅  Sincronizando horarios (Lun–Sab)...`);
  let schedCreated = 0;
  const schedules  = [];

  for (const { barber, def } of barbers) {
    for (const weekday of WEEKDAYS_LUN_SAB) {
      const existing = await Schedule.findOne({ barber: barber._id, weekday });
      if (!existing) {
        await Schedule.create({ shop: shop._id, barber: barber._id, weekday, startTime: def.startTime, endTime: def.endTime, slotMinutes: def.slotMinutes, active: true });
        schedCreated++;
      }
      schedules.push({ barberId: barber._id, weekday, startTime: def.startTime, endTime: def.endTime, slotMinutes: def.slotMinutes });
    }
  }
  console.log(`   ${schedCreated > 0 ? `✚ ${schedCreated} horarios nuevos creados` : '✓ Todos los horarios ya existían'}`);

  // ── Generar turnos ────────────────────────────────────────────────────────
  console.log(`\n🎲  Generando turnos para los próximos ${DAYS_AHEAD} días...\n`);
  let created = 0;
  let skippedOverlap = 0;

  for (let day = 0; day < DAYS_AHEAD; day++) {
    const date    = dateStr(day);
    const weekday = getWeekday(day);

    if (!WEEKDAYS_LUN_SAB.includes(weekday)) continue;

    for (const { barber, def } of barbers) {
      const sched = schedules.find(s => s.barberId.toString() === barber._id.toString() && s.weekday === weekday);
      if (!sched) continue;

      const slotMin  = sched.slotMinutes;
      const allSlots = generateSlots(sched.startTime, sched.endTime, slotMin);
      if (!allSlots.length) continue;

      const existing   = await Reservation.find({ barber: barber._id, date, status: { $ne: 'cancelled' } });
      const usedRanges = existing.map(r => ({
        start: timeToMin(r.time),
        end: r.endTime ? timeToMin(r.endTime) : timeToMin(r.time) + slotMin,
      }));

      const toFill = Math.max(1, Math.round(allSlots.length * (OCCUPANCY_MIN + Math.random() * (OCCUPANCY_MAX - OCCUPANCY_MIN))));

      let filled = 0;
      for (const slot of shuffle(allSlots)) {
        if (filled >= toFill) break;
        const activity = pick(activities);
        const durMin   = activity.durationMinutes || slotMin;
        const startMin = timeToMin(slot);
        const endMin   = startMin + durMin;

        if (usedRanges.some(r => startMin < r.end && endMin > r.start)) { skippedOverlap++; continue; }

        await Reservation.create({
          shop: shop._id, barber: barber._id, activity: activity._id, client: client._id,
          date, time: slot, endTime: minToTime(endMin), status: 'pending', notes: '[TEST]',
        });

        usedRanges.push({ start: startMin, end: endMin });
        created++;
        filled++;
      }
    }
    process.stdout.write(`   ${date}  (día ${weekday})  → ${created} turnos acumulados\r`);
  }

  console.log(`\n\n✅  Turnos creados: ${created}`);
  if (skippedOverlap) console.log(`⏭   Slots saltados por solapamiento: ${skippedOverlap}`);
  console.log(`\n💡  Comandos:`);
  console.log(`     node seed-demo.mjs              → genera datos demo (idempotente)`);
  console.log(`     node seed-demo.mjs --limpiar    → borra turnos + barberos + horarios + actividades demo\n`);

  await mongoose.disconnect();
}

run().catch(e => { console.error('❌  Error:', e.message); process.exit(1); });
