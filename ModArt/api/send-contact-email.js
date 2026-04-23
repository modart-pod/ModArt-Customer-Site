import { checkRateLimit } from './utils/rate-limiter.js';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL     = process.env.FROM_EMAIL  || 'noreply@modart.store';
const STORE_EMAIL    = process.env.STORE_EMAIL || 'modart.pod@gmail.com';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Redis-based rate limit: 3 contact emails per 10 minutes per IP
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  const rateLimit = await checkRateLimit(ip, 3, 600, 'contact_email');
  
  // Set rate limit headers
  res.setHeader('X-RateLimit-Limit', '3');
  res.setHeader('X-RateLimit-Remaining', rateLimit.remaining.toString());
  res.setHeader('X-RateLimit-Reset', rateLimit.resetIn.toString());
  
  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', rateLimit.retryAfter.toString());
    return res.status(429).json({ 
      error: 'Too many requests. Please wait before sending another message.',
      retryAfter: rateLimit.retryAfter 
    });
  }

  const { name, email, subject, message } = req.body || {};
  if (!name || !email || !subject || !message) return res.status(400).json({ error: 'All fields required.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Invalid email.' });
  if (!RESEND_API_KEY) return res.status(500).json({ error: 'Email service not configured.' });

  const esc = s => String(s||'').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const html = `<div style="font-family:sans-serif;max-width:600px;padding:24px"><h2 style="color:#D72638">New Contact Form Submission</h2><p><strong>Name:</strong> ${esc(name)}</p><p><strong>Email:</strong> <a href="mailto:${esc(email)}">${esc(email)}</a></p><p><strong>Subject:</strong> ${esc(subject)}</p><div style="margin-top:16px;padding:16px;background:#F7F5F1;border-radius:8px;white-space:pre-wrap">${esc(message)}</div></div>`;

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: `ModArt Contact <${FROM_EMAIL}>`, to: [STORE_EMAIL], reply_to: email, subject: `[Contact] ${subject} — from ${name}`, html }),
    });
    if (!r.ok) return res.status(502).json({ error: 'Email delivery failed.' });
    return res.status(200).json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
