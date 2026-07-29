/**
 * Query Deduplication & TTL Cache - Task 2.1.2.2
 * Hashes normalized prompts using MD5(prompt). Identical queries within 15 minutes (900,000ms)
 * return instant cached AI responses without consuming Gemini API quota.
 */

import { createHash } from 'crypto';

export class QueryCache {
  /**
   * @param {number} [ttlMs=900000] - Default TTL in ms (15 minutes = 900,000ms)
   */
  constructor(ttlMs = 900000) {
    this.ttlMs = ttlMs;
    this.cache = new Map();
    this.hitCount = 0;
    this.missCount = 0;
  }

  /**
   * Normalizes prompt string by converting to lowercase, removing punctuation, and trimming extra spaces
   * @param {string} prompt 
   * @returns {string} Normalized string
   */
  normalizePrompt(prompt) {
    if (!prompt) return '';
    return String(prompt)
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/gi, '')
      .replace(/\s+/g, ' ');
  }

  /**
   * Computes MD5 hash fingerprint for normalized prompt
   * @param {string} prompt 
   * @returns {string} MD5 hash string
   */
  hashPrompt(prompt) {
    const normalized = this.normalizePrompt(prompt);
    return createHash('md5').update(normalized).digest('hex');
  }

  /**
   * Retrieves cached AI response if present and unexpired
   * @param {string} prompt 
   * @returns {Object|null} Cached response or null on miss/expiration
   */
  get(prompt) {
    this.cleanExpired();
    const hash = this.hashPrompt(prompt);
    if (!hash) return null;

    const entry = this.cache.get(hash);
    if (!entry) {
      this.missCount++;
      return null;
    }

    if (Date.now() - entry.cachedAt > entry.ttlMs) {
      this.cache.delete(hash);
      this.missCount++;
      return null;
    }

    this.hitCount++;
    return {
      ...entry.response,
      isCached: true,
      cacheHitAt: Date.now(),
      md5Hash: hash
    };
  }

  /**
   * Stores an AI response in the query cache with 15-min TTL
   * @param {string} prompt 
   * @param {Object} response 
   * @param {number} [customTtlMs]
   */
  set(prompt, response, customTtlMs) {
    const hash = this.hashPrompt(prompt);
    if (!hash) return;

    this.cache.set(hash, {
      prompt: this.normalizePrompt(prompt),
      response,
      cachedAt: Date.now(),
      ttlMs: customTtlMs !== undefined ? customTtlMs : this.ttlMs
    });
  }

  /**
   * Removes cached entries older than their TTL
   */
  cleanExpired() {
    const now = Date.now();
    for (const [hash, entry] of this.cache.entries()) {
      if (now - entry.cachedAt > entry.ttlMs) {
        this.cache.delete(hash);
      }
    }
  }

  /**
   * Returns current cache statistics
   * @returns {Object}
   */
  getStats() {
    this.cleanExpired();
    return {
      size: this.cache.size,
      hitCount: this.hitCount,
      missCount: this.missCount
    };
  }
}
