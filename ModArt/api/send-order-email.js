const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL     = process.env.FROM_EMAIL || 'orders@modart.store';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://modart-print-on-demand.vercel.app';

// Rate limit: 20 order emails per IP per hour
const rateLimitMap = new Map();

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Rate limit: 20 per IP per hour
  const ip  = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  const now = Date.now();
  const rec = rateLimitMap.get(ip) || { count: 0, start: now };
  if (now - rec.start > 3600000) { rec.count = 0; rec.start = now; }
  rec.count++;
  rateLimitMap.set(ip, rec);
  if (rec.count > 20) return res.status(429).json({ error: 'Too many requests.' });

  const { type, to, orderNumber, items, total, shippingAddress, trackingNumber, courier } = req.body || {};
  if (!to || !orderNumber || !type) return res.status(400).json({ error: 'Missing required fields' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return res.status(400).json({ error: 'Invalid email' });
  if (!RESEND_API_KEY) return res.status(500).json({ error: 'Email service not configured' });

  let subject, html;
  if (type === 'order_confirmation') {
    subject = `Order Confirmed — ${orderNumber} | ModArt`;
    html    = buildOrderEmail({ orderNumber, items, total, shippingAddress });
  } else if (type === 'tracking_update') {
    subject = `Your Order is on the Way — ${orderNumber} | ModArt`;
    html    = buildTrackingEmail({ orderNumber, trackingNumber, courier, shippingAddress });
  } else {
    return res.status(400).json({ error: 'Unknown email type' });
  }

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: `ModArt <${FROM_EMAIL}>`, to: [to], subject, html }),
    });
    if (!r.ok) return res.status(502).json({ error: 'Email delivery failed' });
    return res.status(200).json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function buildOrderEmail({ orderNumber, items=[], total, shippingAddress={} }) {
  const rows = items.map(i => `<tr><td style="padding:8px 0;border-bottom:1px solid #E2DFD8;font-size:13px">${esc(i.name)} — ${esc(i.size)}</td><td style="padding:8px 0;border-bottom:1px solid #E2DFD8;font-size:13px;text-align:right">×${i.qty}</td><td style="padding:8px 0;border-bottom:1px solid #E2DFD8;font-size:13px;font-weight:700;text-align:right">₹${(i.price*i.qty).toLocaleString('en-IN')}</td></tr>`).join('');
  return `<!DOCTYPE html><html><body style="margin:0;padding:40px 20px;background:#F7F5F1;font-family:Arial,sans-serif"><div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden"><div style="background:#111;padding:28px;text-align:center"><div style="font-size:20px;font-weight:900;letter-spacing:.2em;color:#fff">MODART</div></div><div style="padding:32px"><h2 style="color:#111">Order Confirmed</h2><div style="background:#F7F5F1;border-radius:8px;padding:16px;margin-bottom:24px"><div style="font-size:10px;color:#9E9E9E;text-transform:uppercase;letter-spacing:.2em">Order Number</div><div style="font-size:18px;font-weight:900;color:#D72638">${esc(orderNumber)}</div></div><table width="100%">${rows}<tr><td colspan="2" style="padding-top:12px;font-weight:700">Total (COD)</td><td style="padding-top:12px;font-size:16px;font-weight:900;color:#D72638;text-align:right">₹${Number(total).toLocaleString('en-IN')}</td></tr></table><div style="margin-top:20px;padding:16px;background:#FFF8F0;border-radius:8px;border-left:3px solid #F59E0B"><div style="font-size:12px;font-weight:700;color:#92400E">Payment: Cash on Delivery</div></div></div></div></body></html>`;
}

function buildTrackingEmail({ orderNumber, trackingNumber, courier, shippingAddress={} }) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:40px 20px;background:#F7F5F1;font-family:Arial,sans-serif"><div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden"><div style="background:#111;padding:28px;text-align:center"><div style="font-size:20px;font-weight:900;letter-spacing:.2em;color:#fff">MODART</div></div><div style="padding:32px"><h2 style="color:#111">Your Order is on the Way</h2><div style="background:#F7F5F1;border-radius:8px;padding:16px;margin-bottom:16px"><div style="font-size:10px;color:#9E9E9E;text-transform:uppercase">Order</div><div style="font-size:16px;font-weight:900;color:#D72638">${esc(orderNumber)}</div></div><div style="background:#F0FDF4;border-radius:8px;padding:20px;border-left:3px solid #22C55E">${courier?`<div style="font-size:12px;color:#166534">Courier: <strong>${esc(courier)}</strong></div>`:''}<div style="font-size:15px;font-weight:800;color:#111">${esc(trackingNumber)}</div></div></div></div></body></html>`;
}
