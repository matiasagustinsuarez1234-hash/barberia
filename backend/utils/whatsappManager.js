import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;

const CENTRAL_ID = 'central';

// id (string) → { client, status, qr }
const clients = new Map();

function createClient(id, clientId) {
  if (clients.has(id)) return clients.get(id);

  const state = { client: null, status: 'connecting', qr: null };
  clients.set(id, state);

  const client = new Client({
    authStrategy: new LocalAuth({ clientId }),
    puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] },
  });

  client.on('qr', (qr) => {
    state.status = 'qr';
    state.qr = qr;
    console.log(`[WA] QR generado para ${id}`);
  });

  client.on('ready', () => {
    state.status = 'ready';
    state.qr = null;
    console.log(`[WA] ✅ Conectado: ${id}`);
  });

  client.on('auth_failure', () => {
    state.status = 'disconnected';
    state.qr = null;
    console.warn(`[WA] ❌ Fallo de autenticación: ${id}`);
  });

  client.on('disconnected', (reason) => {
    state.status = 'disconnected';
    state.qr = null;
    clients.delete(id);
    console.warn(`[WA] Desconectado ${id}:`, reason);
  });

  state.client = client;
  client.initialize();
  return state;
}

// Sesión central (superadmin)
export function initCentral() {
  return createClient(CENTRAL_ID, CENTRAL_ID);
}

export function getCentralStatus() {
  return clients.get(CENTRAL_ID)?.status ?? 'disconnected';
}

export function getCentralQR() {
  return clients.get(CENTRAL_ID)?.qr ?? null;
}

export async function disconnectCentral() {
  const state = clients.get(CENTRAL_ID);
  if (state?.client) {
    try { await state.client.destroy(); } catch (_) { /* ignore */ }
  }
  clients.delete(CENTRAL_ID);
}

// Sesiones por negocio (legacy / futuro Twilio)
export function initClient(shopId) {
  return createClient(shopId, 'shop_' + shopId);
}

export function getStatus(shopId) {
  return clients.get(shopId)?.status ?? 'disconnected';
}

export function getQR(shopId) {
  return clients.get(shopId)?.qr ?? null;
}

export async function disconnect(shopId) {
  const state = clients.get(shopId);
  if (state?.client) {
    try { await state.client.destroy(); } catch (_) { /* ignore */ }
  }
  clients.delete(shopId);
}

// Envío: usa sesión central si está lista, sino la del shop (legacy)
export async function send(shopId, phone, message) {
  const chatId = `${phone.replace(/\D/g, '')}@c.us`;

  const central = clients.get(CENTRAL_ID);
  if (central?.status === 'ready') {
    await central.client.sendMessage(chatId, message);
    return;
  }

  const state = clients.get(shopId);
  if (!state || state.status !== 'ready') {
    throw new Error(`WhatsApp no conectado (central ni shop ${shopId})`);
  }
  await state.client.sendMessage(chatId, message);
}
