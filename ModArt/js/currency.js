/**
 * ModArt Currency Module
 * Auto-detects user country and converts prices to local currency.
 * Default: INR. Falls back to INR silently on any error.
 */
export const CURRENCY_MAP = {
IN: { code: 'INR', symbol: '₹',   rate: 1,      locale: 'en-IN' },
US: { code: 'USD', symbol: '$',   rate: 0.012,  locale: 'en-US' },
GB: { code: 'GBP', symbol: '£',   rate: 0.0095, locale: 'en-GB' },
EU: { code: 'EUR', symbol: '€',   rate: 0.011,  locale: 'de-DE' },
AU: { code: 'AUD', symbol: 'A$',  rate: 0.018,  locale: 'en-AU' },
CA: { code: 'CAD', symbol: 'C$',  rate: 0.016,  locale: 'en-CA' },
SG: { code: 'SGD', symbol: 'S$',  rate: 0.016,  locale: 'en-SG' },
AE: { code: 'AED', symbol: 'د.إ', rate: 0.044,  locale: 'ar-AE' },
JP: { code: 'JPY', symbol: '¥',   rate: 1.78,   locale: 'ja-JP' },
};

const EU_COUNTRIES = ['DE','FR','IT','ES','NL','BE','AT','PT','PL','SE','DK','FI','NO','CH','IE','GR','CZ','RO','HU','SK'];

export let activeCurrency = CURRENCY_MAP['IN'];

export async function detectAndSetCurrency() {
  try {
    const res = await fetch('https://ipapi.co/json/', {signal: AbortSignal.timeout(3000)});
    if (!res.ok) throw new Error('geo failed');
    const data = await res.json();
    const cc = data.country_code;
    if (EU_COUNTRIES.includes(cc)) {
      activeCurrency = CURRENCY_MAP['EU'];
    } else if (CURRENCY_MAP[cc]) {
      activeCurrency = CURRENCY_MAP[cc];
    } else {
      activeCurrency = CURRENCY_MAP['IN'];
    }
  } catch {
    activeCurrency = CURRENCY_MAP['IN'];
  }
  sessionStorage.setItem('modart_currency', JSON.stringify(activeCurrency));
  return activeCurrency;
}

export async function initCurrency() {
  const cached = sessionStorage.getItem('modart_currency');
  if (cached) {
    activeCurrency = JSON.parse(cached);
    return activeCurrency;
  }
  return detectAndSetCurrency();
}

export function formatPrice(inrAmount) {
  const converted = inrAmount * activeCurrency.rate;
  return new Intl.NumberFormat(activeCurrency.locale, {
    style: 'currency',
    currency: activeCurrency.code,
    maximumFractionDigits: activeCurrency.code === 'JPY' ? 0 : 2,
    minimumFractionDigits: 0,
  }).format(converted);
}

export function getCurrencyBadge() {
  return `${activeCurrency.symbol} ${activeCurrency.code}`;
}

if (typeof window !== 'undefined') {
  window.formatPrice    = formatPrice;
  window.getCurrencyBadge = getCurrencyBadge;
  // Use a getter so window.activeCurrency always reflects the live module value
  Object.defineProperty(window, 'activeCurrency', { get: () => activeCurrency, configurable: true });
}
