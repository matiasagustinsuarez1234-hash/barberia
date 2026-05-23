import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import Barbershop from '../models/Barbershop.js';
import { decrypt } from './tokenCrypto.js';

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
    state.phone = client.info?.wid?.user ?? null;
    console.log(`[WA] ✅ Conectado: ${id} | wid.user=${client.info?.wid?.user} | wid._serialized=${client.info?.wid?._serialized} | pushname=${client.info?.pushname} | me=${client.info?.me?.user}`);
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
  const state = clients.get(CENTRAL_ID);
  const phone = state?.phone ?? state?.client?.info?.wid?.user ?? null;
  return { status: state?.status ?? 'disconnected', phone };
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

const NO_REPLY_FOOTER = '\n\n_Este mensaje es automático, por favor no respondas a este número._';

async function sendViaTwilio(phone, message) {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER } = process.env;
  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      From: `whatsapp:${TWILIO_WHATSAPP_NUMBER}`,
      To: `whatsapp:+${phone.replace(/\D/g, '')}`,
      Body: message,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Twilio error ${res.status}: ${err?.message ?? 'unknown'}`);
  }
}

async function sendViaMeta(phoneNumberId, token, phone, message) {
  const res = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: phone.replace(/\D/g, ''),
      type: 'text',
      text: { body: message },
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Meta API error ${res.status}: ${err?.error?.message ?? 'unknown'}`);
  }
}

// Envío: prioridad 1) Meta Business API del shop, 2) Twilio central, 3) whatsapp-web.js central, 4) fallback por shop (legacy)
export async function send(shopId, phone, message) {
  const fullMessage = message + NO_REPLY_FOOTER;
  const preview = message.replace(/\n/g, ' ').slice(0, 60);

  const shop = await Barbershop.findById(shopId, 'metaWaPhoneNumberId metaWaToken').lean().catch(() => null);
  if (shop?.metaWaPhoneNumberId && shop?.metaWaToken) {
    await sendViaMeta(shop.metaWaPhoneNumberId, decrypt(shop.metaWaToken), phone, fullMessage);
    console.log(`[WA] → ${phone} (Meta Business) | ${preview}`);
    return;
  }

  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER } = process.env;
  if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_WHATSAPP_NUMBER) {
    await sendViaTwilio(phone, fullMessage);
    console.log(`[WA] → ${phone} (Twilio) | ${preview}`);
    return;
  }

  const chatId = `${phone.replace(/\D/g, '')}@c.us`;

  const central = clients.get(CENTRAL_ID);
  if (central?.status === 'ready') {
    await central.client.sendMessage(chatId, fullMessage);
    console.log(`[WA] → ${phone} | ${preview}`);
    return;
  }

  const state = clients.get(shopId);
  if (!state || state.status !== 'ready') {
    throw new Error(`WhatsApp no conectado (Meta, central ni shop ${shopId})`);
  }
  await state.client.sendMessage(chatId, fullMessage);
  console.log(`[WA] → ${phone} (shop) | ${preview}`);
}
