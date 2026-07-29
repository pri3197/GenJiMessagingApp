/**
 * AI Decision Orchestrator & Multi-Factor Engine - Task 2.1.1
 * Evaluates WAN availability, WAN latency (< 3500ms), Battery level (> 15%),
 * Gemini API quota health, query priority, and cache hit status.
 * Dynamically routes queries to Cloud Gemini 2.0 Flash or Edge AI System (Local RAG).
 */

export const PriorityLevel = {
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW'
};

export const RouteTarget = {
  CACHE_HIT: 'CACHE_HIT',
  CLOUD_GEMINI_2_0_FLASH: 'CLOUD_GEMINI_2_0_FLASH',
  EDGE_LOCAL_RAG: 'EDGE_LOCAL_RAG'
};

/**
 * Classifies prompt urgency into priority levels (Task 2.1.1.1)
 * @param {string} prompt 
 * @param {string} [overridePriority]
 * @returns {string} PriorityLevel string
 */
export function classifyQueryPriority(prompt = '', overridePriority = null) {
  if (overridePriority && Object.values(PriorityLevel).includes(overridePriority)) {
    return overridePriority;
  }

  const text = String(prompt).toLowerCase();
  const criticalKeywords = ['sos', 'bleed', 'bleeding', 'trapped', 'cardiac', 'unconscious', 'breathing', 'drowning', 'fire', 'explosion', 'stabbing'];
  const highKeywords = ['flood', 'medical', 'first aid', 'injury', 'fracture', 'burn', 'shelter', 'evacuation', 'rescue'];
  const mediumKeywords = ['food', 'water', 'power', 'charging', 'supplies', 'signal', 'contact'];

  if (criticalKeywords.some(kw => text.includes(kw))) return PriorityLevel.CRITICAL;
  if (highKeywords.some(kw => text.includes(kw))) return PriorityLevel.HIGH;
  if (mediumKeywords.some(kw => text.includes(kw))) return PriorityLevel.MEDIUM;

  return PriorityLevel.LOW;
}

export class MultiFactorDecisionEngine {
  /**
   * Evaluates query routing destination based on Section 3 Decision Matrix
   * 
   * @param {Object} params
   * @param {string} params.prompt - Query string
   * @param {Object} params.gatewayMetrics - Current gateway telemetry metrics
   * @param {boolean} [params.gatewayMetrics.wanOnline=true]
   * @param {number} [params.gatewayMetrics.wanLatency=500] - Latency in ms (threshold: 3500ms)
   * @param {number} [params.gatewayMetrics.battery=90] - Battery % (threshold: 15%)
   * @param {boolean} [params.gatewayMetrics.apiQuotaHealthy=true] - Gemini API quota status
   * @param {boolean} [params.isCacheHit=false] - Whether prompt hit MD5 TTL query cache
   * @param {string} [params.overridePriority] - Explicit priority override
   * 
   * @returns {Object} Routing decision object with target, priority, checks, and reason
   */
  evaluateRouting(params = {}) {
    const {
      prompt = '',
      gatewayMetrics = {},
      isCacheHit = false,
      overridePriority = null
    } = params;

    // Check 1: Query Cache Hit
    if (isCacheHit) {
      return {
        target: RouteTarget.CACHE_HIT,
        priority: classifyQueryPriority(prompt, overridePriority),
        reasons: ['Instant Query Cache Hit (MD5 prompt hash match within 15m TTL)'],
        checks: {
          cacheHit: true,
          wanOnline: Boolean(gatewayMetrics.wanOnline),
          latencyMs: gatewayMetrics.wanLatency || 0,
          batteryPct: gatewayMetrics.battery || 0,
          apiQuotaHealthy: gatewayMetrics.apiQuotaHealthy !== false
        }
      };
    }

    const priority = classifyQueryPriority(prompt, overridePriority);

    const wanOnline = gatewayMetrics.wanOnline !== undefined ? Boolean(gatewayMetrics.wanOnline) : true;
    const wanLatency = gatewayMetrics.wanLatency !== undefined ? Number(gatewayMetrics.wanLatency) : 500;
    const battery = gatewayMetrics.battery !== undefined ? Number(gatewayMetrics.battery) : 90;
    const apiQuotaHealthy = gatewayMetrics.apiQuotaHealthy !== undefined ? Boolean(gatewayMetrics.apiQuotaHealthy) : true;

    // Evaluate individual factor checks
    const checkWan = wanOnline;
    const checkLatency = wanLatency < 3500; // Requirement: Latency < 3500ms
    const checkBattery = battery > 15;      // Requirement: Battery > 15%
    const checkQuota = apiQuotaHealthy;

    const reasons = [];
    if (!checkWan) reasons.push('WAN Offline (No cloud internet connection)');
    if (!checkLatency) reasons.push(`WAN Latency excessive (${wanLatency}ms >= 3500ms threshold)`);
    if (!checkBattery) reasons.push(`Gateway Battery critical (${battery}% <= 15% threshold)`);
    if (!checkQuota) reasons.push('Gemini API Quota exhausted or rate-limited');
    if (priority === PriorityLevel.CRITICAL) reasons.push('CRITICAL Emergency Priority query prefers instant Edge AI response');

    const allCloudChecksPassed = checkWan && checkLatency && checkBattery && checkQuota && priority !== PriorityLevel.CRITICAL;

    if (allCloudChecksPassed) {
      return {
        target: RouteTarget.CLOUD_GEMINI_2_0_FLASH,
        priority,
        reasons: ['WAN online, latency < 3500ms, battery > 15%, API quota healthy'],
        checks: {
          cacheHit: false,
          wanOnline: true,
          wanLatencyMs: wanLatency,
          batteryPct: battery,
          apiQuotaHealthy: true
        }
      };
    }

    return {
      target: RouteTarget.EDGE_LOCAL_RAG,
      priority,
      reasons,
      checks: {
        cacheHit: false,
        wanOnline: checkWan,
        wanLatencyMs: wanLatency,
        batteryPct: battery,
        apiQuotaHealthy: checkQuota
      }
    };
  }
}
