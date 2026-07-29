/**
 * Gateway Discovery & Selection Pipeline - Task 3.1.3
 * Receives heartbeat packets, verifies cryptographic HMAC signatures,
 * extracts telemetry metrics, calculates composite scores, ranks gateways,
 * elects optimal gateways, and detects gateway failures.
 */

import crypto from 'crypto';

/**
 * Calculates composite gateway score based on specification formula:
 * Score = (100 - Hops) * 0.25 + (100 + RSSI) * 0.20 + (5000 / max(500, WAN_Latency_ms)) * 0.20 + (100 - Load%) * 0.15 + Battery% * 0.10 + WAN_Bonus (10)
 */
export function calculateGatewayScore(metrics = {}) {
  const hops = metrics.hops !== undefined ? metrics.hops : 1;
  const rssi = metrics.rssi !== undefined ? metrics.rssi : -70;
  const wanLatency = metrics.wanLatency !== undefined ? metrics.wanLatency : 1000;
  const load = metrics.load !== undefined ? metrics.load : 0;
  const battery = metrics.battery !== undefined ? metrics.battery : 100;
  const wanOnline = Boolean(metrics.wanOnline);

  const hopsScore = (100 - hops) * 0.25;
  const rssiScore = (100 + rssi) * 0.20;
  const latencyScore = (5000 / Math.max(500, wanLatency)) * 0.20;
  const loadScore = (100 - load) * 0.15;
  const batteryScore = battery * 0.10;
  const wanBonus = wanOnline ? 10 : 0;

  const totalScore = hopsScore + rssiScore + latencyScore + loadScore + batteryScore + wanBonus;
  return Math.round(totalScore * 100) / 100;
}

export class GatewayDiscoveryPipeline {
  constructor(options = {}) {
    this.maxAgeMs = options.maxAgeMs || 10000; // Drop heartbeats older than 10s
    this.secretKey = options.secretKey || 'BLE_MESH_HMAC_SECRET_KEY';
    this.gateways = new Map();
  }

  // Subtask 2: Verify HMAC-SHA256 Heartbeat Signature
  verifyHeartbeatSignature(packet, secretKey = this.secretKey) {
    if (!packet || !packet.signature) return false;
    const dataToSign = `${packet.gatewayId}:${packet.sequenceNumber}:${packet.timestamp}`;
    const expectedSignature = crypto.createHmac('sha256', secretKey).update(dataToSign).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(packet.signature), Buffer.from(expectedSignature));
  }

  // Subtask 1: Receive Heartbeat Packet & Subtask 3: Extract Gateway Metrics
  registerBeacon(beaconPayload, requireSignature = false) {
    if (!beaconPayload || !beaconPayload.gatewayId) return null;

    // Verify signature if required or present
    if (requireSignature || beaconPayload.signature) {
      const isValidSig = this.verifyHeartbeatSignature(beaconPayload);
      if (!isValidSig) {
        throw new Error('HMAC_SIG_ERROR: Heartbeat packet signature verification failed');
      }
    }

    const gatewayId = beaconPayload.gatewayId;
    const metrics = beaconPayload.metrics || {};
    const timestamp = beaconPayload.timestamp || Date.now();
    
    // Subtask 4: Calculate Gateway Score
    const score = calculateGatewayScore(metrics);

    const record = {
      gatewayId,
      sequenceNumber: beaconPayload.sequenceNumber || 0,
      timestamp,
      lastSeen: Date.now(),
      metrics,
      score,
      status: 'ONLINE'
    };

    this.gateways.set(gatewayId, record);
    return record;
  }

  // Subtask 7: Detect Gateway Failures
  detectGatewayFailures(timeoutMs = this.maxAgeMs) {
    const now = Date.now();
    const failedGateways = [];

    for (const [id, record] of this.gateways.entries()) {
      if (now - record.lastSeen > timeoutMs) {
        record.status = 'FAILED';
        failedGateways.push(id);
      }
    }

    return failedGateways;
  }

  // Subtask 7: Prune Stale Gateways
  pruneStaleGateways() {
    const failedIds = this.detectGatewayFailures();
    for (const id of failedIds) {
      this.gateways.delete(id);
    }
    return failedIds.length;
  }

  // Subtask 5: Rank Gateways by Score Descending
  getRankedGateways() {
    this.pruneStaleGateways();
    const list = Array.from(this.gateways.values());
    return list.sort((a, b) => b.score - a.score);
  }

  // Subtask 6: Select Optimal Gateway
  selectOptimalGateway() {
    const ranked = this.getRankedGateways();
    if (ranked.length === 0) return null;
    return ranked[0];
  }

  // Legacy method alias for backwards compatibility
  selectElectedGateway() {
    return this.selectOptimalGateway();
  }
}
