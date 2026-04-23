/**
 * CSRF Token Generation Endpoint
 * 
 * ✅ SECURITY FIX: CSRF protection for all mutations
 * 
 * Generates and validates CSRF tokens to prevent
 * Cross-Site Request Forgery attacks.
 * 
 * Usage:
 * 1. GET /api/csrf-token - Get a new token
 * 2. Include token in X-CSRF-Token header for all POST/PUT/DELETE requests
 * 3. Token expires after 15 minutes
 */

import crypto from 'crypto';

// In-memory token storage (use Redis in production for Phase 1)
// This will be replaced with Redis in the rate limiting implementation
const tokens = new Map();

// Clean up expired tokens every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, data] of tokens.entries()) {
    if (now > data.expiresAt) {
      tokens.delete(sessionId);
    }
  }
}, 5 * 60 * 1000);

export default function handler(req, res) {
  if (req.method === 'GET') {
    return generateToken(req, res);
  } else if (req.method === 'POST') {
    return validateToken(req, res);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

/**
 * Generate a new CSRF token
 */
function generateToken(req, res) {
  try {
    // Generate secure random token
    const token = crypto.randomBytes(32).toString('hex');
    
    // Get or create session ID
    const sessionId = req.cookies?.['csrf-session'] || 
                     crypto.randomBytes(16).toString('hex');
    
    // Store token with expiry (15 minutes)
    const expiresAt = Date.now() + 15 * 60 * 1000;
    tokens.set(sessionId, {
      token,
      expiresAt,
      createdAt: Date.now()
    });
    
    // Set session cookie (HttpOnly, Secure, SameSite)
    res.setHeader('Set-Cookie', [
      `csrf-session=${sessionId}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=900`
    ]);
    
    // Return token to client
    return res.status(200).json({ 
      csrfToken: token,
      expiresIn: 900 // seconds
    });
    
  } catch (error) {
    console.error('CSRF token generation error:', error);
    return res.status(500).json({ 
      error: 'Failed to generate CSRF token' 
    });
  }
}

/**
 * Validate a CSRF token
 */
function validateToken(req, res) {
  try {
    const { token } = req.body;
    const sessionId = req.cookies?.['csrf-session'];
    
    if (!token || !sessionId) {
      return res.status(400).json({ 
        valid: false,
        error: 'Missing token or session' 
      });
    }
    
    const stored = tokens.get(sessionId);
    
    if (!stored) {
      return res.status(400).json({ 
        valid: false,
        error: 'Invalid session' 
      });
    }
    
    if (Date.now() > stored.expiresAt) {
      tokens.delete(sessionId);
      return res.status(400).json({ 
        valid: false,
        error: 'Token expired' 
      });
    }
    
    if (stored.token !== token) {
      return res.status(400).json({ 
        valid: false,
        error: 'Invalid token' 
      });
    }
    
    return res.status(200).json({ valid: true });
    
  } catch (error) {
    console.error('CSRF token validation error:', error);
    return res.status(500).json({ 
      error: 'Failed to validate CSRF token' 
    });
  }
}

/**
 * Middleware to validate CSRF token
 * Use this in other API endpoints
 */
export async function validateCsrfToken(req) {
  const token = req.headers['x-csrf-token'];
  const sessionId = req.cookies?.['csrf-session'];
  
  if (!token || !sessionId) {
    return { valid: false, error: 'Missing CSRF token' };
  }
  
  const stored = tokens.get(sessionId);
  
  if (!stored) {
    return { valid: false, error: 'Invalid CSRF session' };
  }
  
  if (Date.now() > stored.expiresAt) {
    tokens.delete(sessionId);
    return { valid: false, error: 'CSRF token expired' };
  }
  
  if (stored.token !== token) {
    return { valid: false, error: 'Invalid CSRF token' };
  }
  
  return { valid: true };
}
