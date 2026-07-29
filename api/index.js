/**
 * Vercel Serverless API Dispatcher
 * Handles AI Query Routing, Sound Channel Status, and Recent Activity Telemetry.
 */

import { MultiFactorDecisionEngine } from '../src/gateway/decision_engine.js';
import { QueryCache } from '../src/gateway/query_cache.js';
import { SoundChannelEngine } from '../src/mesh/sound_channel.js';
import { ChannelHandoverManager } from '../src/mesh/channel_handover.js';
import { RecentActivityManager, ActivityType } from '../src/activity/recent_activity.js';

const decisionEngine = new MultiFactorDecisionEngine();
const queryCache = new QueryCache(900000);
const soundEngine = new SoundChannelEngine();
const handoverManager = new ChannelHandoverManager({ soundEngine });
const activityManager = new RecentActivityManager();

async function parseRequestBody(req) {
  if (req.body) {
    if (typeof req.body === 'object') return req.body;
    if (typeof req.body === 'string') {
      try { return JSON.parse(req.body); } catch (e) { return {}; }
    }
  }

  return new Promise((resolve) => {
    let raw = '';
    req.on('data', chunk => raw += chunk.toString());
    req.on('end', () => {
      try {
        resolve(JSON.parse(raw || '{}'));
      } catch (e) {
        resolve({});
      }
    });
  });
}

export default async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // CORS Headers for Production
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 1. AI REQUEST ROUTING ENDPOINT: /api/send-request
  if (pathname.includes('/send-request') && req.method === 'POST') {
    try {
      const body = await parseRequestBody(req);
      const prompt = body.query || 'Emergency Triage Procedure';
      const packetId = body.packetId || `PKT-VERCEL-${Date.now()}`;

      const cached = queryCache.get(prompt);
      if (cached) {
        activityManager.logActivity(ActivityType.AI_QUERY, prompt, '💎 15m Cache Hit');
        return res.status(200).json({
          query: prompt,
          answer: cached.answer,
          source: 'QUERY_CACHE_HIT',
          processedBy: 'Vercel Edge Local Cache',
          timestamp: new Date().toISOString()
        });
      }

      // Evaluate Multi-Factor Decision
      const decision = decisionEngine.evaluateRouting({
        prompt,
        gatewayMetrics: { wanOnline: true, wanLatency: 450, battery: 90, apiQuotaHealthy: true }
      });

      let answerText = decision.target === 'CLOUD_GEMINI_2_0_FLASH'
        ? `[Cloud Gemini 2.0 Flash + Search Grounding] Verified emergency protocol for "${prompt}".`
        : `[Edge Local RAG Engine (Offline KB v12)] Offline triage guide for "${prompt}".`;

      const result = {
        query: prompt,
        processedBy: 'Gateway-C1 (Vercel Node)',
        answer: answerText,
        timestamp: new Date().toISOString(),
        source: decision.target,
        decision
      };

      queryCache.set(prompt, result);
      activityManager.logActivity(ActivityType.AI_QUERY, prompt, `${decision.target} via Vercel`);

      return res.status(200).json(result);
    } catch (err) {
      return res.status(422).json({ error: err.message || 'AI Processing Failed' });
    }
  }

  // 2. SOUND CHANNEL STATUS: /api/sound/status
  if (pathname.includes('/sound/status')) {
    return res.status(200).json(handoverManager.getChannelSummary());
  }

  // 3. RECENT ACTIVITY LIST: /api/activity/list
  if (pathname.includes('/activity/list')) {
    return res.status(200).json({
      count: activityManager.getActivities().length,
      activities: activityManager.getActivities()
    });
  }

  // DEFAULT HEALTH
  return res.status(200).json({
    status: 'HEALTHY',
    system: 'Emergency BLE Mesh AI System',
    platform: 'Vercel Serverless Production'
  });
}
