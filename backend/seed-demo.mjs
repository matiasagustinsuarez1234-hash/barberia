/**
 * seed-demo.mjs — Genera turnos de prueba para ver cómo queda la grilla
 *
 * Uso (desde la carpeta backend/):
 *   node seed-demo.mjs              → agrega turnos aleatorios
 *   node seed-demo.mjs --limpiar    → borra todos los turnos de prueba
 *
 * Configura las constantes de abajo según el entorno.
 */

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync } from 'fs';
import mongoose from 'mongoose';

// ── Configuración ────────────────────────────────────────────────────────────

const SHOP_SLUG      = 'barberiatest'; // slug del negocio en MongoDB
const TEST_PHONE     = '5491130755116'; // celular normalizado (549 + número)
const TEST_CLIENT_NAME = 'Demo Cliente';
const DAYS_AHEAD     = 7;   // cuántos días hacia adelante llenar
const OCCUPANCY_MIN  = 0.35; // mínimo % de slots a ocupar por barbero/día
const OCCUPANCY_MAX  = 0.60; // máximo % de slots a ocupar

// ── Leer .env del mismo directorio ───────────────────────────────────────────

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

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeToMin(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function minToTime(m) {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
function generateSlots(start, end, step) {
  const slots = [];
  for (let t = timeToMin(start); t < timeToMin(end); t += step) slots.push(minToTime(t));
  return slots;
}
function dateStr(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function getWeekday(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.getDay();
}
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// ── Esquemas mínimos (sin importar los modelos con todas sus dependencias) ───

const clientSchema = new mongoose.Schema({
  name: String, phone: String, username: String, email: String,
});
const shopSchema = new mongoose.Schema({
  name: String, slug: String, active: Boolean,
});
const barberSchema = new mongoose.Schema({
  name: String, shop: mongoose.Schema.Types.ObjectId, active: Boolean,
  surchargeType: String, surchargeValue: Number,
});
const activitySchema = new mongoose.Schema({
  title: String, price: Number, durationMinutes: Number,
  shop: mongoose.Schema.Types.ObjectId,
});
const scheduleSchema = new mongoose.Schema({
  barber: mongoose.Schema.Types.ObjectId,
  shop: mongoose.Schema.Types.ObjectId,
  weekday: Number, startTime: String, endTime: String,
  slotMinutes: Number, active: Boolean,
});
const reservationSchema = new mongoose.Schema({
  shop: mongoose.Schema.Types.ObjectId,
  barber: mongoose.Schema.Types.ObjectId,
  activity: mongoose.Schema.Types.ObjectId,
  client: mongoose.Schema.Types.ObjectId,
  date: String, time: String, endTime: String,
  status: String, notes: String,
  cancellationReason: String,
});

// Registrar modelos (o reutilizar si ya existen)
const Client      = mongoose.models.Client      || mongoose.model('Client',      clientSchema);
const Barbershop  = mongoose.models.Barbershop  || mongoose.model('Barbershop',  shopSchema);
const Barber      = mongoose.models.Barber      || mongoose.model('Barber',      barberSchema);
const Activity    = mongoose.models.Activity    || mongoose.model('Activity',    activitySchema);
const Schedule    = mongoose.models.Schedule    || mongoose.model('Schedule',    scheduleSchema);
const Reservation = mongoose.models.Reservation || mongoose.model('Reservation', reservationSchema);

// ── Main ─────────────────────────────────────────────────────────────────────

const LIMPIAR = process.argv.includes('--limpiar');

async function run() {
  console.log(`\n🔌  Conectando a MongoDB...`);
  await mongoose.connect(MONGO_URI);
  console.log(`✅  Conectado\n`);

  // ── Buscar negocio ────────────────────────────────────────────────────────
  const shop = await Barbershop.findOne({ slug: SHOP_SLUG });
  if (!shop) {
    console.error(`❌  No se encontró el negocio con slug "${SHOP_SLUG}"`);
    console.error(`    Shops disponibles:`);
    const all = await Barbershop.find({}, 'name slug');
    all.forEach(s => console.error(`      • ${s.name}  →  slug: "${s.slug}"`));
    await mongoose.disconnect();
    process.exit(1);
  }
  console.log(`🏪  Negocio: ${shop.name} (slug: ${shop.slug})`);

  // ── Limpiar turnos de prueba ──────────────────────────────────────────────
  if (LIMPIAR) {
    const result = await Reservation.deleteMany({ shop: shop._id, notes: '[TEST]' });
    console.log(`🗑   Se borraron ${result.deletedCount} turno(s) de prueba de "${shop.name}"`);
    await mongoose.disconnect();
    console.log('\n✅  Listo\n');
    return;
  }

  // ── Buscar/crear cliente de prueba ────────────────────────────────────────
  let client = await Client.findOne({ phone: TEST_PHONE });
  if (!client) {
    client = await Client.create({
      name: TEST_CLIENT_NAME,
      phone: TEST_PHONE,
      username: `demo_${Date.now()}`,
      email: '',
    });
    console.log(`👤  Cliente de prueba creado: ${client.name} (${TEST_PHONE})`);
  } else {
    console.log(`👤  Cliente de prueba encontrado: ${client.name} (${TEST_PHONE})`);
  }

  // ── Cargar barberos, actividades, horarios ────────────────────────────────
  const barbers    = await Barber.find({ shop: shop._id });
  const activities = await Activity.find({ shop: shop._id });
  const schedules  = await Schedule.find({ shop: shop._id, active: { $ne: false } });

  if (!barbers.length)    { console.error('❌  Sin barberos'); await mongoose.disconnect(); return; }
  if (!activities.length) { console.error('❌  Sin actividades'); await mongoose.disconnect(); return; }
  if (!schedules.length)  { console.error('❌  Sin horarios'); await mongoose.disconnect(); return; }

  console.log(`\n💈  Barberos: ${barbers.map(b => b.name).join(', ')}`);
  console.log(`✂️   Actividades: ${activities.map(a => a.title).join(', ')}`);

  // ── Generar turnos ────────────────────────────────────────────────────────
  let created = 0;
  let skipped = 0;
  const statuses = ['pending', 'pending', 'pending', 'confirmed']; // más pendientes que confirmados

  for (let day = 0; day < DAYS_AHEAD; day++) {
    const date    = dateStr(day);
    const weekday = getWeekday(day);

    for (const barber of barbers) {
      const sched = schedules.find(
        s => s.barber.toString() === barber._id.toString() && s.weekday === weekday
      );
      if (!sched) continue; // barbero no trabaja ese día

      const slotMin = sched.slotMinutes || 30;
      const allSlots = generateSlots(sched.startTime, sched.endTime, slotMin);
      if (!allSlots.length) continue;

      // Reservas ya existentes del barbero ese día
      const existing = await Reservation.find({
        barber: barber._id, date, status: { $ne: 'cancelled' },
      });
      const usedRanges = existing.map(r => ({
        start: timeToMin(r.time),
        end: r.endTime ? timeToMin(r.endTime) : timeToMin(r.time) + slotMin,
      }));

      const occupancy = OCCUPANCY_MIN + Math.random() * (OCCUPANCY_MAX - OCCUPANCY_MIN);
      const toFill    = Math.max(1, Math.round(allSlots.length * occupancy));
      const shuffled  = shuffle(allSlots);

      let filledCount = 0;
      for (const slot of shuffled) {
        if (filledCount >= toFill) break;

        const activity  = pick(activities);
        const durMin    = activity.durationMinutes || slotMin;
        const startMin  = timeToMin(slot);
        const endMin    = startMin + durMin;

        // Verificar solapamiento con rangos ya usados (existentes + los que agregamos en esta corrida)
        const overlaps = usedRanges.some(r => startMin < r.end && endMin > r.start);
        if (overlaps) { skipped++; continue; }

        await Reservation.create({
          shop:     shop._id,
          barber:   barber._id,
          activity: activity._id,
          client:   client._id,
          date,
          time:     slot,
          endTime:  minToTime(endMin),
          status:   pick(statuses),
          notes:    '[TEST]',
        });

        usedRanges.push({ start: startMin, end: endMin });
        created++;
        filledCount++;
      }
    }
  }

  console.log(`\n📅  Turnos creados: ${created}`);
  if (skipped) console.log(`⏭   Slots saltados por solapamiento: ${skipped}`);
  console.log(`\n💡  Para borrarlos: node seed-demo.mjs --limpiar\n`);

  await mongoose.disconnect();
  console.log('✅  Listo\n');
}

run().catch(e => { console.error('❌  Error:', e.message); process.exit(1); });
