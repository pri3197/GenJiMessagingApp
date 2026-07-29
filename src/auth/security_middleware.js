/**
 * Task 1.1.6: Security Implementation Module
 * RS256 JWT Signing & Verification, Refresh Token Rotation, IP Rate Limiter,
 * Security Headers (HTTPS/CSP/HSTS), CORS Control, and Authentication Middleware.
 */

import crypto from 'crypto';

export class SecurityEngine {
  constructor() {
    // Generate RSA 2048-bit key pair for RS256 signing
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });

    this.publicKey = publicKey;
    this.privateKey = privateKey;
    this.refreshTokens = new Map(); // token -> { userId, expiresAt }
    this.rateLimitMap = new Map(); // ip -> { count, resetTime }
    this.rateLimitWindowMs = 60000; // 1 minute
    this.maxRequestsPerMin = 100;
  }

  // 3. RS256 JWT Signing (RSA-SHA256)
  signRs256Jwt(payload, expiresInSeconds = 900) {
    const header = { alg: 'RS256', typ: 'JWT' };
    const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const fullPayload = { ...payload, exp, iat: Math.floor(Date.now() / 1000) };

    const b64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
    const b64Payload = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
    const signatureInput = `${b64Header}.${b64Payload}`;

    const signer = crypto.createSign('SHA256');
    signer.update(signatureInput);
    const signature = signer.sign(this.privateKey, 'base64url');

    return `${signatureInput}.${signature}`;
  }

  // 3. RS256 JWT Verification
  verifyRs256Jwt(token) {
    if (!token) throw new Error('AUTHENTICATION_ERROR: Bearer token missing');
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('AUTHENTICATION_ERROR: Invalid JWT token format');

    const [b64Header, b64Payload, signature] = parts;
    const signatureInput = `${b64Header}.${b64Payload}`;

    const verifier = crypto.createVerify('SHA256');
    verifier.update(signatureInput);
    const isValid = verifier.verify(this.publicKey, signature, 'base64url');

    if (!isValid) throw new Error('AUTHENTICATION_ERROR: Invalid RS256 signature');

    const payload = JSON.parse(Buffer.from(b64Payload, 'base64url').toString('utf8'));
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
      throw new Error('AUTHENTICATION_ERROR: JWT token has expired');
    }

    return payload;
  }

  // 4. Implement Refresh Token Rotation
  issueRefreshToken(userId) {
    const refreshToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 7 * 86400000;
    this.refreshTokens.set(refreshToken, { userId, expiresAt });
    return refreshToken;
  }

  rotateRefreshToken(oldRefreshToken) {
    if (!oldRefreshToken || !this.refreshTokens.has(oldRefreshToken)) {
      throw { statusCode: 401, message: 'AUTHENTICATION_ERROR: Invalid or stale refresh token' };
    }

    const record = this.refreshTokens.get(oldRefreshToken);
    if (Date.now() > record.expiresAt) {
      this.refreshTokens.delete(oldRefreshToken);
      throw { statusCode: 401, message: 'AUTHENTICATION_ERROR: Refresh token expired' };
    }

    // Invalidate used refresh token (One-time use rotation)
    this.refreshTokens.delete(oldRefreshToken);

    // Issue new pair
    const newAccessToken = this.signRs256Jwt({ userId: record.userId }, 900);
    const newRefreshToken = this.issueRefreshToken(record.userId);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      tokenType: 'Bearer',
      expiresIn: 900
    };
  }

  // 8. Rate Limiter (Max 100 req/min per IP)
  checkRateLimit(clientIp = '127.0.0.1') {
    const now = Date.now();
    let record = this.rateLimitMap.get(clientIp);

    if (!record || now > record.resetTime) {
      record = { count: 1, resetTime: now + this.rateLimitWindowMs };
      this.rateLimitMap.set(clientIp, record);
      return true;
    }

    record.count++;
    if (record.count > this.maxRequestsPerMin) {
      throw { statusCode: 429, message: 'RATE_LIMIT_EXCEEDED: Too many requests. Limit: 100 req/min.' };
    }

    return true;
  }

  // 1 & 6. Configure Security & CORS Headers
  applySecurityHeaders(res) {
    // 1. HTTPS / Security Headers
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "default-src 'self' https://*.vercel.app https://vercel.live; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live https://*.vercel.app; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; connect-src 'self' https://*.vercel.app https://vercel.live wss://*.vercel.live https://generativelanguage.googleapis.com; img-src 'self' data: blob: https:;");

    // 6. CORS Configuration
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Max-Age', '86400');
  }

  // 9. Authentication Middleware
  authenticate(req) {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw { statusCode: 401, message: 'AUTHENTICATION_ERROR: Bearer authorization token required' };
    }

    const token = authHeader.split(' ')[1];
    return this.verifyRs256Jwt(token);
  }
}
