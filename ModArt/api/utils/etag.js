/**
 * ETag Utility
 * 
 * Performance FIX: M-4 - ETag headers for conditional requests
 * 
 * Generates ETags for API responses and handles If-None-Match headers
 * to reduce unnecessary data transfer with 304 Not Modified responses.
 */

import crypto from 'crypto';

/**
 * Generates an ETag for response data
 * @param {any} data - Response data to hash
 * @returns {string} ETag value
 */
export function generateETag(data) {
  const content = typeof data === 'string' ? data : JSON.stringify(data);
  const hash = crypto.createHash('md5').update(content).digest('hex');
  return `"${hash}"`;
}

/**
 * Checks if request ETag matches current ETag
 * @param {Request} request - Incoming request
 * @param {string} etag - Current ETag
 * @returns {boolean} True if ETags match
 */
export function checkETag(request, etag) {
  const ifNoneMatch = request.headers.get('if-none-match');
  return ifNoneMatch === etag;
}

/**
 * Adds ETag headers to response
 * @param {Response} response - Response object
 * @param {string} etag - ETag value
 * @returns {Response} Response with ETag header
 */
export function addETagHeader(response, etag) {
  const headers = new Headers(response.headers);
  headers.set('ETag', etag);
  headers.set('Cache-Control', 'no-cache'); // Must revalidate but can use cached version
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

/**
 * Creates a 304 Not Modified response
 * @param {string} etag - ETag value
 * @returns {Response} 304 response
 */
export function createNotModifiedResponse(etag) {
  return new Response(null, {
    status: 304,
    statusText: 'Not Modified',
    headers: {
      'ETag': etag,
      'Cache-Control': 'no-cache'
    }
  });
}

/**
 * Middleware to handle ETag for API responses
 * @param {Request} request - Incoming request
 * @param {any} data - Response data
 * @returns {Response} Response with ETag or 304
 */
export function handleETag(request, data) {
  const etag = generateETag(data);
  
  // Check if client has cached version
  if (checkETag(request, etag)) {
    console.log('✅ ETag match - returning 304 Not Modified');
    return createNotModifiedResponse(etag);
  }
  
  // Return full response with ETag
  const response = new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'ETag': etag,
      'Cache-Control': 'no-cache'
    }
  });
  
  return response;
}

/**
 * Weak ETag generator for dynamic content
 * @param {any} data - Response data
 * @param {string} lastModified - Last modified timestamp
 * @returns {string} Weak ETag
 */
export function generateWeakETag(data, lastModified) {
  const content = typeof data === 'string' ? data : JSON.stringify(data);
  const hash = crypto.createHash('md5')
    .update(content + lastModified)
    .digest('hex')
    .substring(0, 16);
  return `W/"${hash}"`;
}
