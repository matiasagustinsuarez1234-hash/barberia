import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
  tls: { rejectUnauthorized: false },
});

/**
 * Envía un email de recordatorio de turno.
 * Retorna 'sent' | 'no_email' | 'error'
 */
export async function sendReminderEmail({ to, clientName, shopName, activity, barberName, date, time, shopSlug }) {
  if (!to || !to.includes('@')) return 'no_email';
  if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) return 'no_email';

  const bookingUrl = shopSlug
    ? `${process.env.PUBLIC_URL}/${shopSlug}/turnos?ver=mis-turnos`
    : process.env.PUBLIC_URL;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #fff; border-radius: 12px; border: 1px solid #e5e7eb;">
      <h2 style="margin: 0 0 4px; font-size: 1.2rem; color: #111;">📅 Recordatorio de turno</h2>
      <p style="color: #6b7280; margin: 0 0 20px; font-size: 0.9rem;">${shopName}</p>

      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
        <p style="margin: 0 0 6px;"><strong>Hola ${clientName}!</strong> Te recordamos que hoy tenés turno.</p>
        <p style="margin: 0 0 4px;">🪒 <strong>${activity}</strong> con ${barberName}</p>
        <p style="margin: 0;">🕐 <strong>${date} a las ${time}</strong></p>
      </div>

      <a href="${bookingUrl}" style="display: block; text-align: center; background: #111; color: #fff; padding: 12px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-bottom: 16px;">
        Ver mis turnos
      </a>

      <p style="color: #9ca3af; font-size: 0.75rem; text-align: center; margin: 0;">
        Este es un mensaje automático de ${shopName}. Por favor no respondas este email.
      </p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"${shopName}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to,
      subject: `Recordatorio — Hoy a las ${time} en ${shopName}`,
      html,
    });
    console.log(`[Email] Recordatorio enviado a ${to} (${clientName}) — ${shopName} ${date} ${time}`);
    return 'sent';
  } catch (e) {
    console.warn(`[Email] Error enviando a ${to}:`, e.message);
    return 'error';
  }
}

/**
 * Envía email de cancelación de turno.
 */
export async function sendCancellationEmail({ to, clientName, shopName, activity, barberName, date, time, reason, shopSlug }) {
  if (!to || !to.includes('@')) return 'no_email';
  if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) return 'no_email';

  const bookingUrl = shopSlug
    ? `${process.env.PUBLIC_URL}/${shopSlug}/turnos`
    : process.env.PUBLIC_URL;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #fff; border-radius: 12px; border: 1px solid #e5e7eb;">
      <h2 style="margin: 0 0 4px; font-size: 1.2rem; color: #111;">❌ Turno cancelado</h2>
      <p style="color: #6b7280; margin: 0 0 20px; font-size: 0.9rem;">${shopName}</p>

      <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
        <p style="margin: 0 0 6px;"><strong>Hola ${clientName},</strong> tu turno fue cancelado.</p>
        <p style="margin: 0 0 4px;">🪒 <strong>${activity}</strong> con ${barberName}</p>
        <p style="margin: 0 0 4px;">📅 <strong>${date} a las ${time}</strong></p>
        ${reason ? `<p style="margin: 0;">Motivo: ${reason}</p>` : ''}
      </div>

      <a href="${bookingUrl}" style="display: block; text-align: center; background: #111; color: #fff; padding: 12px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-bottom: 16px;">
        Reservar nuevo turno
      </a>

      <p style="color: #9ca3af; font-size: 0.75rem; text-align: center; margin: 0;">
        Este es un mensaje automático de ${shopName}. Por favor no respondas este email.
      </p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"${shopName}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to,
      subject: `Turno cancelado — ${date} a las ${time} en ${shopName}`,
      html,
    });
    console.log(`[Email] Cancelación enviada a ${to} (${clientName}) — ${shopName} ${date} ${time}`);
    return 'sent';
  } catch (e) {
    console.warn(`[Email] Error enviando cancelación a ${to}:`, e.message);
    return 'error';
  }
}

/**
 * Envía email de confirmación de turno nuevo.
 */
export async function sendConfirmationEmail({ to, clientName, shopName, activity, barberName, date, time, price, shopSlug }) {
  if (!to || !to.includes('@')) return 'no_email';
  if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) return 'no_email';

  const bookingUrl = shopSlug
    ? `${process.env.PUBLIC_URL}/${shopSlug}/turnos?ver=mis-turnos`
    : process.env.PUBLIC_URL;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #fff; border-radius: 12px; border: 1px solid #e5e7eb;">
      <h2 style="margin: 0 0 4px; font-size: 1.2rem; color: #111;">✅ Turno confirmado</h2>
      <p style="color: #6b7280; margin: 0 0 20px; font-size: 0.9rem;">${shopName}</p>

      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
        <p style="margin: 0 0 6px;"><strong>Hola ${clientName}!</strong> Tu turno quedó registrado.</p>
        <p style="margin: 0 0 4px;">🪒 <strong>${activity}</strong> con ${barberName}</p>
        <p style="margin: 0 0 4px;">📅 <strong>${date} a las ${time}</strong></p>
        ${price ? `<p style="margin: 0;">💰 <strong>${price}</strong></p>` : ''}
      </div>

      <a href="${bookingUrl}" style="display: block; text-align: center; background: #111; color: #fff; padding: 12px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-bottom: 16px;">
        Ver mis turnos
      </a>

      <p style="color: #9ca3af; font-size: 0.75rem; text-align: center; margin: 0;">
        Este es un mensaje automático de ${shopName}. Por favor no respondas este email.
      </p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"${shopName}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to,
      subject: `Turno confirmado — ${date} a las ${time} en ${shopName}`,
      html,
    });
    console.log(`[Email] Confirmación enviada a ${to} (${clientName}) — ${shopName} ${date} ${time}`);
    return 'sent';
  } catch (e) {
    console.warn(`[Email] Error enviando confirmación a ${to}:`, e.message);
    return 'error';
  }
}
