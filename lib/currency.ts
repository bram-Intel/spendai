/**
 * Currency conversion utilities for Nigerian Naira (NGN)
 * 1 Naira = 100 Kobo
 */

/**
 * Convert Naira to Kobo (for storing in database)
 * @param naira Amount in Naira
 * @returns Amount in Kobo (integer)
 */
export function nairaToKobo(naira: number): number {
  return Math.round(naira * 100);
}

/**
 * Convert Kobo to Naira (for displaying to user)
 * @param kobo Amount in Kobo
 * @returns Amount in Naira
 */
export function koboToNaira(kobo: number): number {
  return kobo / 100;
}

/**
 * Format amount in Naira with currency symbol
 * @param naira Amount in Naira
 * @returns Formatted string (e.g., "₦1,234.56")
 */
export function formatNaira(naira: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
  }).format(naira);
}

/**
 * Format amount in Kobo as Naira with currency symbol
 * @param kobo Amount in Kobo
 * @returns Formatted string (e.g., "₦1,234.56")
 */
export function formatKobo(kobo: number): string {
  return formatNaira(koboToNaira(kobo));
}
