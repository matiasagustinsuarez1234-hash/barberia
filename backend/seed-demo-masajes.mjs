/**
 * seed-demo-masajes.mjs — Genera profesionales, horarios, actividades y turnos de prueba
 * para una casa de masajes / centro de bienestar.
 *
 * Uso (desde la carpeta backend/):
 *   node seed-demo-masajes.mjs              → crea/asegura datos demo
 *   node seed-demo-masajes.mjs --regenerar  → idem (alias explícito)
 *   node seed-demo-masajes.mjs --limpiar    → borra TODO lo demo
 */

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync } from 'fs';
import mongoose from 'mongoose';

// ── Configuración ─────────────────────────────────────────────────────────────

const SHOP_SLUG        = 'masajestest';   // ← cambiar al slug real del negocio
const TEST_PHONE       = '5491130755116';
const TEST_CLIENT_NAME = 'Demo Cliente';
const DAYS_AHEAD       = 14;
const OCCUPANCY_MIN    = 0.35;
const OCCUPANCY_MAX    = 0.60;

const DEMO_PREFIX = '[DEMO]';

// ── 8 actividades demo ────────────────────────────────────────────────────────

const DEMO_ACTIVITIES = [
  { title: 'Masaje descontracturante de espalda', price: 18000, durationMinutes: 45 },
  { title: 'Masaje de piernas y pies',            price: 15000, durationMinutes: 40 },
  { title: 'Masaje cuerpo completo',              price: 30000, durationMinutes: 90 },
  { title: 'Masaje relajante',                    price: 20000, durationMinutes: 60 },
  { title: 'Sesión de Reiki',                     price: 16000, durationMinutes: 60 },
  { title: 'Sesión de kinesiología',              price: 22000, durationMinutes: 50 },
  { title: 'Reflexología podal',                  price: 14000, durationMinutes: 45 },
  { title: 'Drenaje linfático manual',            price: 25000, durationMinutes: 60 },
];

// ── 2 profesionales demo ──────────────────────────────────────────────────────

const DEMO_PROFESSIONALS = [
  { name: `${DEMO_PREFIX} Valeria`, specialties: ['Masajes', 'Reiki'],         startTime: '09:00', endTime: '18:00', slotMinutes: 60, surchargeType: 'none',    surchargeValue: 0  },
  { name: `${DEMO_PREFIX} ⭐ Marcos`, specialties: ['Kinesiología', 'Masajes'], startTime: '10:00', endTime: '20:00', slotMinutes: 60, surchargeType: 'percent', surchargeValue: 15 },
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
const Barber      = mongoose.models.Barber      || mongoose.model('Barber',      new S({ name: String, shop: ObjId, active: Boolean, specialties: [String], surchargeType: String, surchargeValue: Number, activities: [ObjId] }));
const Activity    = mongoose.models.Activity    || mongoose.model('Activity',    new S({ title: String, price: Number, durationMinutes: Number, shop: ObjId, active: Boolean, notes: String }));
const Schedule    = mongoose.models.Schedule    || mongoose.model('Schedule',    new S({ barber: ObjId, shop: ObjId, weekday: Number, startTime: String, endTime: String, slotMinutes: Number, active: Boolean }));
const Reservation = mongoose.models.Reservation || mongoose.model('Reservation', new S({ shop: ObjId, barber: ObjId, activity: ObjId, client: ObjId, date: String, time: String, endTime: String, status: String, notes: String }));

// ── Main ──────────────────────────────────────────────────────────────────────

const LIMPIAR   = process.argv.includes('--limpiar');
const REGENERAR = process.argv.includes('--regenerar') || (!LIMPIAR);

async function run() {
  console.log(`\n🔌  Conectando a MongoDB...`);
  await mongoose.connect(MONGO_URI);
  console.log(`✅  Conectado\n`);

  let shop = await Barbershop.findOne({ slug: SHOP_SLUG });
  if (!shop) {
    shop = await Barbershop.create({ name: 'Casa de Masajes Demo', slug: SHOP_SLUG, active: true });
    console.log(`🏪  Negocio creado: ${shop.name} (slug: ${shop.slug})\n`);
  } else {
    console.log(`🏪  Negocio: ${shop.name} (slug: ${shop.slug})\n`);
  }

  // ── --limpiar ─────────────────────────────────────────────────────────────
  if (LIMPIAR) {
    console.log(`🗑   Limpiando datos demo del shop "${shop.name}"...\n`);

    const res = await Reservation.deleteMany({ shop: shop._id, notes: '[TEST]' });
    console.log(`    Turnos [TEST] borrados:       ${res.deletedCount}`);

    const demoNames   = DEMO_PROFESSIONALS.map(p => p.name);
    const demoProfs   = await Barber.find({ shop: shop._id, name: { $in: demoNames } }, '_id');
    const demoProfIds = demoProfs.map(p => p._id);

    const sch = await Schedule.deleteMany({ barber: { $in: demoProfIds } });
    const bar = await Barber.deleteMany({ _id: { $in: demoProfIds } });
    console.log(`    Profesionales [DEMO] borrados: ${bar.deletedCount}`);
    console.log(`    Horarios borrados:             ${sch.deletedCount}`);

    const demoTitles = DEMO_ACTIVITIES.map(a => a.title);
    const act = await Activity.deleteMany({ shop: shop._id, title: { $in: demoTitles } });
    console.log(`    Actividades demo borradas:     ${act.deletedCount}`);

    if (shop.name === 'Casa de Masajes Demo') {
      await Barbershop.deleteOne({ _id: shop._id });
      console.log(`    Negocio demo borrado:          1`);
    }

    console.log(`\n✅  Limpieza completa.`);
    console.log(`💡  Para volver a generar datos: node seed-demo-masajes.mjs\n`);
    await mongoose.disconnect(); return;
  }

  // ── Seed ──────────────────────────────────────────────────────────────────

  let client = await Client.findOne({ phone: TEST_PHONE });
  if (!client) {
    client = await Client.create({ name: TEST_CLIENT_NAME, phone: TEST_PHONE, username: `demo_${Date.now()}`, email: '' });
    console.log(`👤  Cliente creado: ${client.name}`);
  } else {
    console.log(`👤  Cliente: ${client.name} (${TEST_PHONE})`);
  }

  console.log(`\n💆  Sincronizando ${DEMO_ACTIVITIES.length} actividades demo...`);
  const activities = [];
  for (const def of DEMO_ACTIVITIES) {
    let act = await Activity.findOne({ shop: shop._id, title: def.title });
    if (!act) {
      act = await Activity.create({ shop: shop._id, title: def.title, price: def.price, durationMinutes: def.durationMinutes, active: true });
      console.log(`   ✚ Creada: ${def.title} (${def.durationMinutes} min, $${def.price.toLocaleString('es-AR')})`);
    } else {
      console.log(`   ✓ Ya existe: ${def.title}`);
    }
    activities.push(act);
  }

  console.log(`\n🧑‍⚕️  Sincronizando ${DEMO_PROFESSIONALS.length} profesionales demo...`);
  const professionals = [];
  for (const def of DEMO_PROFESSIONALS) {
    let prof = await Barber.findOne({ shop: shop._id, name: def.name });
    if (!prof) {
      prof = await Barber.create({ shop: shop._id, name: def.name, specialties: def.specialties, active: true, surchargeType: def.surchargeType, surchargeValue: def.surchargeValue });
      const surchargeLabel = def.surchargeType === 'percent' ? ` (+${def.surchargeValue}%)` : def.surchargeType === 'fixed' ? ` (+$${def.surchargeValue})` : '';
      console.log(`   ✚ Creado: ${def.name}${surchargeLabel}`);
    } else {
      console.log(`   ✓ Ya existe: ${def.name}`);
    }
    professionals.push({ prof, def });
  }

  const activityIds = activities.map(a => a._id);
  for (const { prof } of professionals) {
    await Barber.findByIdAndUpdate(prof._id, { activities: activityIds });
  }
  console.log(`\n🔗  Actividades asignadas a todos los profesionales demo`);

  console.log(`\n📅  Sincronizando horarios (Lun–Sab)...`);
  let schedCreated = 0;
  const schedules  = [];

  for (const { prof, def } of professionals) {
    for (const weekday of WEEKDAYS_LUN_SAB) {
      const existing = await Schedule.findOne({ barber: prof._id, weekday });
      if (!existing) {
        await Schedule.create({ shop: shop._id, barber: prof._id, weekday, startTime: def.startTime, endTime: def.endTime, slotMinutes: def.slotMinutes, active: true });
        schedCreated++;
      }
      schedules.push({ profId: prof._id, weekday, startTime: def.startTime, endTime: def.endTime, slotMinutes: def.slotMinutes });
    }
  }
  console.log(`   ${schedCreated > 0 ? `✚ ${schedCreated} horarios nuevos creados` : '✓ Todos los horarios ya existían'}`);

  console.log(`\n🎲  Generando turnos para los próximos ${DAYS_AHEAD} días...\n`);
  let created = 0;
  let skippedOverlap = 0;

  for (let day = 0; day < DAYS_AHEAD; day++) {
    const date    = dateStr(day);
    const weekday = getWeekday(day);

    if (!WEEKDAYS_LUN_SAB.includes(weekday)) continue;

    for (const { prof, def } of professionals) {
      const sched = schedules.find(s => s.profId.toString() === prof._id.toString() && s.weekday === weekday);
      if (!sched) continue;

      const slotMin  = sched.slotMinutes;
      const allSlots = generateSlots(sched.startTime, sched.endTime, slotMin);
      if (!allSlots.length) continue;

      const existing   = await Reservation.find({ barber: prof._id, date, status: { $ne: 'cancelled' } });
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
          shop: shop._id, barber: prof._id, activity: activity._id, client: client._id,
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
  console.log(`     node seed-demo-masajes.mjs              → genera datos demo (idempotente)`);
  console.log(`     node seed-demo-masajes.mjs --limpiar    → borra turnos + profesionales + horarios + actividades demo\n`);

  await mongoose.disconnect();
}

run().catch(e => { console.error('❌  Error:', e.message); process.exit(1); });
