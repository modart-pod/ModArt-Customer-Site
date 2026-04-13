/**
 * Netlify Function: send-order-email
 * Sends order confirmation email via Resend API.
 * Called server-side so API key is never exposed to the browser.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL     = process.env.FROM_EMAIL || 'orders@modart.store';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://modart-site.netlify.app';

export const handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders(),
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return respond(405, { error: 'Method not allowed' });
  }

  // Validate origin
  const origin = event.headers.origin || event.headers.Origin || '';
  if (origin && origin !== ALLOWED_ORIGIN) {
    return respond(403, { error: 'Forbidden' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return respond(400, { error: 'Invalid JSON' });
  }

  const { type, to, orderNumber, items, total, shippingAddress, trackingNumber, courier } = body;

  // Basic validation
  if (!to || !orderNumber || !type) {
    return respond(400, { error: 'Missing required fields' });
  }

  // Sanitize email
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return respond(400, { error: 'Invalid email address' });
  }

  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY not set');
    return respond(500, { error: 'Email service not configured' });
  }

  let subject, html;

  if (type === 'order_confirmation') {
    subject = `Order Confirmed — ${orderNumber} | ModArt`;
    html    = buildOrderConfirmationEmail({ orderNumber, items, total, shippingAddress });
  } else if (type === 'tracking_update') {
    subject = `Your Order is on the Way — ${orderNumber} | ModArt`;
    html    = buildTrackingEmail({ orderNumber, trackingNumber, courier, shippingAddress });
  } else {
    return respond(400, { error: 'Unknown email type' });
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from:    `ModArt <${FROM_EMAIL}>`,
        to:      [to],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Resend error:', err);
      return respond(502, { error: 'Email delivery failed' });
    }

    return respond(200, { success: true });
  } catch (e) {
    console.error('Email send exception:', e.message);
    return respond(500, { error: 'Internal server error' });
  }
};

// ── Email Templates ──────────────────────────────────────────────

function buildOrderConfirmationEmail({ orderNumber, items = [], total, shippingAddress = {} }) {
  const itemRows = items.map(i => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #E2DFD8;font-size:13px;color:#444">${escHtml(i.name)} — ${escHtml(i.size)}</td>
      <td style="padding:10px 0;border-bottom:1px solid #E2DFD8;font-size:13px;color:#444;text-align:right">×${i.qty}</td>
      <td style="padding:10px 0;border-bottom:1px solid #E2DFD8;font-size:13px;color:#111;font-weight:700;text-align:right">₹${(i.price * i.qty).toLocaleString('en-IN')}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#F7F5F1;font-family:'Helvetica Neue',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F5F1;padding:40px 20px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
        <!-- Header -->
        <tr><td style="background:#111;padding:28px 32px;text-align:center">
          <div style="font-size:20px;font-weight:900;letter-spacing:.2em;color:#fff;text-transform:uppercase">MODART</div>
          <div style="font-size:10px;font-weight:700;letter-spacing:.3em;color:rgba(255,255,255,.4);margin-top:4px;text-transform:uppercase">Premium Custom Garment Studio</div>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px">
          <div style="font-size:22px;font-weight:800;color:#111;margin-bottom:6px">Order Confirmed</div>
          <div style="font-size:13px;color:#6B6B6B;margin-bottom:24px">Thanks for your order. We'll get it ready soon.</div>
          <div style="background:#F7F5F1;border-radius:8px;padding:16px 20px;margin-bottom:24px">
            <div style="font-size:10px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:#9E9E9E;margin-bottom:4px">Order Number</div>
            <div style="font-size:18px;font-weight:900;color:#D72638;letter-spacing:.06em">${escHtml(orderNumber)}</div>
          </div>
          <!-- Items -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px">
            <tr>
              <th style="font-size:10px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:#9E9E9E;text-align:left;padding-bottom:8px">Item</th>
              <th style="font-size:10px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:#9E9E9E;text-align:right;padding-bottom:8px">Qty</th>
              <th style="font-size:10px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:#9E9E9E;text-align:right;padding-bottom:8px">Price</th>
            </tr>
            ${itemRows}
            <tr>
              <td colspan="2" style="padding-top:12px;font-size:13px;font-weight:700;color:#111">Total (COD)</td>
              <td style="padding-top:12px;font-size:16px;font-weight:900;color:#D72638;text-align:right">₹${Number(total).toLocaleString('en-IN')}</td>
            </tr>
          </table>
          <!-- Shipping -->
          <div style="border-top:1px solid #E2DFD8;padding-top:20px;margin-top:4px">
            <div style="font-size:10px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:#9E9E9E;margin-bottom:8px">Shipping To</div>
            <div style="font-size:13px;color:#444;line-height:1.6">
              ${escHtml(shippingAddress.fullName || '')}<br/>
              ${escHtml(shippingAddress.street || '')}<br/>
              ${escHtml(shippingAddress.city || '')}${shippingAddress.postal ? ', ' + escHtml(shippingAddress.postal) : ''}<br/>
              ${escHtml(shippingAddress.country || 'India')}
            </div>
          </div>
          <div style="margin-top:24px;padding:16px;background:#FFF8F0;border-radius:8px;border-left:3px solid #F59E0B">
            <div style="font-size:12px;font-weight:700;color:#92400E">Payment: Cash on Delivery</div>
            <div style="font-size:11px;color:#92400E;margin-top:2px">Please keep the exact amount ready at the time of delivery.</div>
          </div>
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#F7F5F1;padding:20px 32px;text-align:center;border-top:1px solid #E2DFD8">
          <div style="font-size:11px;color:#9E9E9E">Questions? Reply to this email or visit <a href="https://modart-site.netlify.app" style="color:#D72638;text-decoration:none">modart-site.netlify.app</a></div>
          <div style="font-size:10px;color:#C0BDB8;margin-top:6px">© ${new Date().getFullYear()} ModArt. All rights reserved.</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function buildTrackingEmail({ orderNumber, trackingNumber, courier, shippingAddress = {} }) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#F7F5F1;font-family:'Helvetica Neue',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F5F1;padding:40px 20px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
        <tr><td style="background:#111;padding:28px 32px;text-align:center">
          <div style="font-size:20px;font-weight:900;letter-spacing:.2em;color:#fff;text-transform:uppercase">MODART</div>
          <div style="font-size:10px;font-weight:700;letter-spacing:.3em;color:rgba(255,255,255,.4);margin-top:4px;text-transform:uppercase">Premium Custom Garment Studio</div>
        </td></tr>
        <tr><td style="padding:32px">
          <div style="font-size:22px;font-weight:800;color:#111;margin-bottom:6px">Your Order is on the Way</div>
          <div style="font-size:13px;color:#6B6B6B;margin-bottom:24px">Your ModArt order has been dispatched.</div>
          <div style="background:#F7F5F1;border-radius:8px;padding:16px 20px;margin-bottom:20px">
            <div style="font-size:10px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:#9E9E9E;margin-bottom:4px">Order Number</div>
            <div style="font-size:16px;font-weight:900;color:#D72638">${escHtml(orderNumber)}</div>
          </div>
          <div style="background:#F0FDF4;border-radius:8px;padding:20px;border-left:3px solid #22C55E;margin-bottom:20px">
            <div style="font-size:10px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:#166534;margin-bottom:6px">Tracking Details</div>
            ${courier ? `<div style="font-size:12px;color:#166534;margin-bottom:4px">Courier: <strong>${escHtml(courier)}</strong></div>` : ''}
            <div style="font-size:15px;font-weight:800;color:#111;letter-spacing:.06em">${escHtml(trackingNumber)}</div>
          </div>
          <div style="font-size:13px;color:#444">
            Delivering to: <strong>${escHtml(shippingAddress.fullName || '')}</strong>, ${escHtml(shippingAddress.city || '')}
          </div>
        </td></tr>
        <tr><td style="background:#F7F5F1;padding:20px 32px;text-align:center;border-top:1px solid #E2DFD8">
          <div style="font-size:11px;color:#9E9E9E">© ${new Date().getFullYear()} ModArt. All rights reserved.</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

// ── Helpers ──────────────────────────────────────────────────────

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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
