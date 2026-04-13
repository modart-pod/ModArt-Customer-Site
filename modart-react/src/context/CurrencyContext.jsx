import { createContext, useContext, useEffect, useState } from 'react';

const CURRENCY_MAP = {
  IN: { code: 'INR', symbol: '₹',  rate: 1,     locale: 'en-IN' },
  US: { code: 'USD', symbol: '$',  rate: 0.012, locale: 'en-US' },
  GB: { code: 'GBP', symbol: '£',  rate: 0.0095,locale: 'en-GB' },
  EU: { code: 'EUR', symbol: '€',  rate: 0.011, locale: 'de-DE' },
  AU: { code: 'AUD', symbol: 'A$', rate: 0.018, locale: 'en-AU' },
  JP: { code: 'JPY', symbol: '¥',  rate: 1.78,  locale: 'ja-JP' },
};
const EU = ['DE','FR','IT','ES','NL','BE','AT','PT','PL','SE','DK','FI','NO','CH','IE','GR'];

const CurrencyContext = createContext(CURRENCY_MAP['IN']);

export function CurrencyProvider({ children }) {
  const [currency, setCurrency] = useState(() => {
    try {
      const c = sessionStorage.getItem('modart_currency');
      return c ? JSON.parse(c) : CURRENCY_MAP['IN'];
    } catch { return CURRENCY_MAP['IN']; }
  });

  useEffect(() => {
    if (sessionStorage.getItem('modart_currency')) return;
    fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(3000) })
      .then(r => r.json())
      .then(d => {
        const cc = d.country_code;
        const cur = EU.includes(cc) ? CURRENCY_MAP['EU'] : (CURRENCY_MAP[cc] || CURRENCY_MAP['IN']);
        setCurrency(cur);
        sessionStorage.setItem('modart_currency', JSON.stringify(cur));
      })
      .catch(() => {});
  }, []);

  const formatPrice = (inrAmount) => {
    const converted = inrAmount * currency.rate;
    return new Intl.NumberFormat(currency.locale, {
      style: 'currency',
      currency: currency.code,
      maximumFractionDigits: currency.code === 'JPY' ? 0 : 0,
      minimumFractionDigits: 0,
    }).format(converted);
  };

  return (
    <CurrencyContext.Provider value={{ currency, formatPrice }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export const useCurrency = () => useContext(CurrencyContext);
