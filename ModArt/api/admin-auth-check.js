/**
 * Admin Authentication Middleware
 * 
 * ✅ SECURITY FIX: Server-side admin route protection
 * 
 * This endpoint protects /admin.html by verifying:
 * 1. Valid session token exists
 * 2. Token is not expired
 * 3. User has admin role
 * 
 * If all checks pass, serves admin.html
 * Otherwise, returns 401/403 error
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get session token from cookie or Authorization header
    const token = req.cookies?.['sb-access-token'] || 
                  req.cookies?.['sb-' + process.env.VITE_SUPABASE_URL?.split('//')[1]?.split('.')[0] + '-auth-token'] ||
                  req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      console.log('❌ No token provided');
      return res.status(401).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Unauthorized - ModArt Admin</title>
          <style>
            body { 
              font-family: 'Space Grotesk', sans-serif; 
              display: flex; 
              align-items: center; 
              justify-content: center; 
              min-height: 100vh; 
              margin: 0;
              background: #F7F5F1;
            }
            .error-container {
              text-align: center;
              padding: 40px;
              max-width: 500px;
            }
            h1 { 
              font-size: 48px; 
              margin: 0 0 16px 0;
              color: #D72638;
            }
            p { 
              font-size: 16px; 
              color: #6B6B6B;
              margin: 0 0 24px 0;
            }
            a {
              display: inline-block;
              padding: 12px 24px;
              background: #D72638;
              color: white;
              text-decoration: none;
              border-radius: 8px;
              font-weight: 700;
              letter-spacing: 0.08em;
              text-transform: uppercase;
              font-size: 12px;
            }
            a:hover {
              background: #B81F2E;
            }
          </style>
        </head>
        <body>
          <div class="error-container">
            <h1>401</h1>
            <p>Unauthorized. Please log in to access the admin panel.</p>
            <a href="/login.html?redirect=/admin">Login</a>
          </div>
        </body>
        </html>
      `);
    }

    // Initialize Supabase client
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.VITE_SUPABASE_ANON_KEY
    );

    // Verify token with Supabase
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      console.log('❌ Invalid token:', userError?.message);
      return res.status(401).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Session Expired - ModArt Admin</title>
          <style>
            body { 
              font-family: 'Space Grotesk', sans-serif; 
              display: flex; 
              align-items: center; 
              justify-content: center; 
              min-height: 100vh; 
              margin: 0;
              background: #F7F5F1;
            }
            .error-container {
              text-align: center;
              padding: 40px;
              max-width: 500px;
            }
            h1 { 
              font-size: 48px; 
              margin: 0 0 16px 0;
              color: #D72638;
            }
            p { 
              font-size: 16px; 
              color: #6B6B6B;
              margin: 0 0 24px 0;
            }
            a {
              display: inline-block;
              padding: 12px 24px;
              background: #D72638;
              color: white;
              text-decoration: none;
              border-radius: 8px;
              font-weight: 700;
              letter-spacing: 0.08em;
              text-transform: uppercase;
              font-size: 12px;
            }
            a:hover {
              background: #B81F2E;
            }
          </style>
        </head>
        <body>
          <div class="error-container">
            <h1>401</h1>
            <p>Your session has expired. Please log in again.</p>
            <a href="/login.html?redirect=/admin&reason=expired">Login</a>
          </div>
        </body>
        </html>
      `);
    }

    // Check if user is admin
    // Method 1: Check email against admin email from env
    const adminEmail = process.env.ADMIN_EMAIL || 'modart.pod@gmail.com';
    const isAdminByEmail = user.email === adminEmail;

    // Method 2: Check role in profiles table (if exists)
    let isAdminByRole = false;
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      
      isAdminByRole = profile?.role === 'admin';
    } catch (e) {
      // Profiles table might not exist yet, that's okay
      console.log('Note: profiles table not found, using email check only');
    }

    const isAdmin = isAdminByEmail || isAdminByRole;

    if (!isAdmin) {
      console.log('❌ User is not admin:', user.email);
      return res.status(403).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Forbidden - ModArt Admin</title>
          <style>
            body { 
              font-family: 'Space Grotesk', sans-serif; 
              display: flex; 
              align-items: center; 
              justify-content: center; 
              min-height: 100vh; 
              margin: 0;
              background: #F7F5F1;
            }
            .error-container {
              text-align: center;
              padding: 40px;
              max-width: 500px;
            }
            h1 { 
              font-size: 48px; 
              margin: 0 0 16px 0;
              color: #D72638;
            }
            p { 
              font-size: 16px; 
              color: #6B6B6B;
              margin: 0 0 24px 0;
            }
            a {
              display: inline-block;
              padding: 12px 24px;
              background: #D72638;
              color: white;
              text-decoration: none;
              border-radius: 8px;
              font-weight: 700;
              letter-spacing: 0.08em;
              text-transform: uppercase;
              font-size: 12px;
            }
            a:hover {
              background: #B81F2E;
            }
          </style>
        </head>
        <body>
          <div class="error-container">
            <h1>403</h1>
            <p>Forbidden. You don't have permission to access the admin panel.</p>
            <a href="/">Go Home</a>
          </div>
        </body>
        </html>
      `);
    }

    // User is authenticated admin - serve admin.html
    console.log('✅ Admin authenticated:', user.email);

    // Read and serve admin.html
    try {
      const adminHtmlPath = join(process.cwd(), 'admin.html');
      const adminHtml = readFileSync(adminHtmlPath, 'utf-8');
      
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      
      return res.status(200).send(adminHtml);
    } catch (fileError) {
      console.error('❌ Error reading admin.html:', fileError);
      return res.status(500).json({ 
        error: 'Internal server error',
        message: 'Could not load admin panel'
      });
    }

  } catch (error) {
    console.error('❌ Admin auth error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}
