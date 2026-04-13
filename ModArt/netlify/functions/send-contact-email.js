/**
 * Netlify Function: send-contact-email
 * Forwards contact form submissions to the store email via Resend.
 */

const RESEND_API_KEY  = process.env.RESEND_API_KEY;
const FROM_EMAIL      = process.env.FROM_EMAIL      || 'noreply@modart.store';
const STORE_EMAIL     = process.env.STORE_EMAIL     || 'modart.pod@gmail.com';
const ALLOWED_ORIGIN  = process.env.ALLOWED_ORIGIN  || 'https://modart-site.netlify.app';

// Simple rate-limit: max 3 submissions per IP per 10 minutes (in-memory, resets on cold start)
const rateLimitMap = new Map();
const RATE_LIMIT   = 3;
const RATE_WINDOW  = 10 * 60 * 1000;

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(), body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return respond(405, { error: 'Method not allowed' });
  }

  // Rate limiting
  const ip  = event.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  const now = Date.now();
  const rec = rateLimitMap.get(ip) || { count: 0, start: now };
  if (now - rec.start > RATE_WINDOW) { rec.count = 0; rec.start = now; }
  rec.count++;
  rateLimitMap.set(ip, rec);
  if (rec.count > RATE_LIMIT) {
    return respond(429, { error: 'Too many requests. Please wait a few minutes.' });
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return respond(400, { error: 'Invalid JSON' }); }

  const { name, email, subject, message } = body;

  // Validate
  if (!name || !email || !subject || !message) {
    return respond(400, { error: 'All fields are required.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return respond(400, { error: 'Invalid email address.' });
  }
  if (name.length > 100 || subject.length > 200 || message.length > 2000) {
    return respond(400, { error: 'Input too long.' });
  }

  if (!RESEND_API_KEY) {
    return respond(500, { error: 'Email service not configured.' });
  }

  const esc = (s) => String(s || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
      <h2 style="color:#D72638">New Contact Form Submission</h2>
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:8px 0;font-weight:700;color:#444;width:100px">Name</td><td style="padding:8px 0;color:#111">${esc(name)}</td></tr>
        <tr><td style="padding:8px 0;font-weight:700;color:#444">Email</td><td style="padding:8px 0;color:#111"><a href="mailto:${esc(email)}">${esc(email)}</a></td></tr>
        <tr><td style="padding:8px 0;font-weight:700;color:#444">Subject</td><td style="padding:8px 0;color:#111">${esc(subject)}</td></tr>
      </table>
      <div style="margin-top:16px;padding:16px;background:#F7F5F1;border-radius:8px;font-size:14px;color:#333;line-height:1.6;white-space:pre-wrap">${esc(message)}</div>
    </div>`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from:     `ModArt Contact <${FROM_EMAIL}>`,
        to:       [STORE_EMAIL],
        reply_to: email,
        subject:  `[Contact] ${subject} — from ${name}`,
        html,
      }),
    });
    if (!res.ok) return respond(502, { error: 'Email delivery failed.' });
    return respond(200, { success: true });
  } catch (e) {
    return respond(500, { error: 'Internal server error.' });
  }
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function respond(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    body: JSON.stringify(body),
  };
}
