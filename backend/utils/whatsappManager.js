import Barbershop from '../models/Barbershop.js';
import { decrypt } from './tokenCrypto.js';

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

// Envío: 1) Meta Business API del shop, 2) Twilio central
export async function send(shopId, phone, message) {
  if (process.env.WHATSAPP_ENABLED === 'false') {
    console.log(`[WA] Envío deshabilitado (WHATSAPP_ENABLED=false) → ${phone} | ${message.slice(0, 60)}`);
    return;
  }

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

  throw new Error(`WhatsApp no configurado para shop ${shopId}`);
}
