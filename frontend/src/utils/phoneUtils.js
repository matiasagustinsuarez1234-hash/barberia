/**
 * Normaliza un número de celular al formato WhatsApp Argentina.
 * Formato final: 549 + areaCode + localNumber (siempre 13 dígitos en total,
 * ya que en Argentina areaCode + localNumber = 10 dígitos).
 *
 * @param {string} raw       - Número ingresado por el usuario (cualquier formato)
 * @param {string} areaCode  - Característica de la zona, ej: "11", "341", "351"
 *
 * Ejemplos con areaCode "11":
 *   "11 2345-6789"   → "5491123456789"
 *   "01123456789"    → "5491123456789"
 *   "5491123456789"  → "5491123456789"
 *
 * Ejemplos con areaCode "341" (Rosario):
 *   "341 234-5678"   → "5493412345678"
 *   "3412345678"     → "5493412345678"
 */
export function normalizeArgPhone(raw, areaCode = '11') {
  let digits = raw.replace(/\D/g, '');

  // Quitar 0 inicial (ej: 011..., 0341...)
  if (digits.startsWith('0')) digits = digits.slice(1);

  // Normalizar prefijo internacional
  if (digits.startsWith('549')) {
    // ya tiene 54 + 9 de celular
  } else if (digits.startsWith('54')) {
    // tiene 54 pero le falta el 9 de celular
    digits = '549' + digits.slice(2);
  } else if (digits.startsWith('9')) {
    digits = '54' + digits;
  } else {
    digits = '549' + digits;
  }

  // En Argentina: característica + número local = 10 dígitos siempre
  const localDigits = 10 - areaCode.length;
  const regex = new RegExp(`^549${areaCode}\\d{${localDigits}}$`);

  if (!regex.test(digits)) {
    return {
      phone: null,
      error: `El número debe corresponder a la zona (característica ${areaCode}) con ${localDigits} dígitos locales. Ej: ${areaCode} ${'X'.repeat(Math.ceil(localDigits / 2))}-${'X'.repeat(Math.floor(localDigits / 2))}`,
    };
  }

  return { phone: digits, error: null };
}
