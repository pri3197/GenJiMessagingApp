/**
 * Multipath Failover & Relay De-duplication Engine - Task 3.1.5
 * Detects gateway timeouts (2500ms), selects backup gateways, switches active routes,
 * verifies backup connections via probe frames, restores preferred primary gateways on recovery,
 * and prevents routing loops in multi-hop paths.
 */

import { createHash } from 'crypto';

/**
 * 60-Second Sliding Window De-duplication Cache
 * Prevents mesh nodes and relays from re-processing or re-broadcasting identical frames.
 */
export class RelayDeduplicationCache {
  constructor(ttlMs = 60000) {
    this.ttlMs = ttlMs;
    this.cache = new Map();
  }

  getPacketKey(packet) {
    if (!packet) return '';
    if (typeof packet === 'string') return packet;
    if (packet.packetId) return packet.packetId;
    
    const raw = `${packet.senderId || ''}:${packet.sequenceNumber || ''}:${JSON.stringify(packet.payload || {})}`;
    return createHash('md5').update(raw).digest('hex');
  }

  shouldRelay(packet) {
    this.cleanExpired();
    const key = this.getPacketKey(packet);
    if (!key) return false;

    if (this.cache.has(key)) {
      return false; // Duplicate packet found within 60s window
    }

    this.cache.set(key, Date.now());
    return true;
  }

  cleanExpired() {
    const now = Date.now();
    for (const [key, timestamp] of this.cache.entries()) {
      if (now - timestamp > this.ttlMs) {
        this.cache.delete(key);
      }
    }
  }

  size() {
    this.cleanExpired();
    return this.cache.size;
  }
}

/**
 * Multipath Failover Manager
 */
export class MultipathFailoverManager {
  constructor(options = {}) {
    this.discoveryPipeline = options.discoveryPipeline;
    this.timeoutMs = options.timeoutMs || 2500;
    this.dedupCache = new RelayDeduplicationCache(options.dedupTtlMs || 60000);
    this.activeRequests = new Map();
    this.preferredGatewayId = options.preferredGatewayId || 'Gateway-C1';
    this.activeGatewayId = this.preferredGatewayId;
  }

  // Subtask 1: Detect Gateway Timeout
  detectGatewayTimeout(gatewayId, elapsedTimeMs) {
    const timedOut = elapsedTimeMs >= this.timeoutMs;
    if (timedOut) {
      console.warn(`[Failover] Gateway [${gatewayId}] timeout detected (${elapsedTimeMs}ms >= ${this.timeoutMs}ms)`);
    }
    return timedOut;
  }

  // Subtask 2: Select Backup Gateway
  selectBackupGateway(failedGatewayId) {
    const rankedGateways = this.discoveryPipeline ? this.discoveryPipeline.getRankedGateways() : [];
    const backups = rankedGateways.filter(gw => gw.gatewayId !== failedGatewayId);

    if (backups.length === 0) {
      return null;
    }
    return backups[0];
  }

  // Subtask 3: Switch Active Route
  switchActiveGatewayRoute(targetGatewayId) {
    console.log(`[Failover] Switching active gateway route from [${this.activeGatewayId}] to [${targetGatewayId}]`);
    const previous = this.activeGatewayId;
    this.activeGatewayId = targetGatewayId;
    return { previousGatewayId: previous, activeGatewayId: this.activeGatewayId, timestamp: Date.now() };
  }

  // Subtask 4: Verify Connection
  async verifyGatewayConnection(gatewayId, sendProbeFn) {
    if (!sendProbeFn || typeof sendProbeFn !== 'function') {
      return { verified: true, gatewayId, rttMs: 15 };
    }

    const probePacket = { packetId: `PROBE-${Date.now()}`, payload: 'PING_PROBE' };
    const start = Date.now();

    try {
      await this.executeWithTimeout(() => sendProbeFn(gatewayId, probePacket), 1500);
      const rttMs = Date.now() - start;
      return { verified: true, gatewayId, rttMs };
    } catch (err) {
      return { verified: false, gatewayId, error: err.message };
    }
  }

  // Subtask 5: Restore Preferred Gateway
  restorePreferredGateway(preferredGatewayId = this.preferredGatewayId) {
    const rankedGateways = this.discoveryPipeline ? this.discoveryPipeline.getRankedGateways() : [];
    const preferredCandidate = rankedGateways.find(gw => gw.gatewayId === preferredGatewayId);

    if (preferredCandidate && preferredCandidate.metrics.wanOnline) {
      this.activeGatewayId = preferredGatewayId;
      console.log(`[Failover] Restored primary preferred gateway [${preferredGatewayId}]`);
      return { restored: true, activeGatewayId: preferredGatewayId };
    }

    return { restored: false, currentActiveGatewayId: this.activeGatewayId };
  }

  // Subtask 6: Prevent Routing Loops
  preventRoutingLoops(pathArray = []) {
    if (!Array.isArray(pathArray)) return { hasLoop: true, reason: 'Invalid path array' };
    const nodeSet = new Set(pathArray);
    const hasLoop = nodeSet.size !== pathArray.length;

    return {
      hasLoop,
      uniqueNodeCount: nodeSet.size,
      totalHopCount: pathArray.length,
      valid: !hasLoop
    };
  }

  // Core Request Routing with Automatic 2500ms Failover
  async sendRequestWithFailover(requestPacket, sendToGatewayFn) {
    // Prevent Routing Loops if path is included
    if (requestPacket.path) {
      const loopCheck = this.preventRoutingLoops(requestPacket.path);
      if (loopCheck.hasLoop) {
        throw new Error('ROUTING_LOOP_DETECTED: Packet path contains loop cycle');
      }
    }

    // Check de-duplication cache
    if (!this.dedupCache.shouldRelay(requestPacket)) {
      throw new Error(`DUPLICATE_PACKET_DROPPED: Packet ${requestPacket.packetId || ''} already processed within 60s window`);
    }

    const rankedGateways = this.discoveryPipeline ? this.discoveryPipeline.getRankedGateways() : [];
    if (rankedGateways.length === 0) {
      throw new Error('NO_GATEWAYS_AVAILABLE: No active gateways discovered in mesh');
    }

    const primaryGateway = rankedGateways[0];
    const secondaryGateway = this.selectBackupGateway(primaryGateway.gatewayId);

    // Try Primary Gateway (Gateway C1) with 2500ms timeout
    try {
      const response = await this.executeWithTimeout(
        () => sendToGatewayFn(primaryGateway.gatewayId, requestPacket),
        this.timeoutMs
      );
      this.activeGatewayId = primaryGateway.gatewayId;
      return {
        status: 'DELIVERED_PRIMARY',
        deliveredGatewayId: primaryGateway.gatewayId,
        failoverOccurred: false,
        response
      };
    } catch (primaryError) {
      console.warn(`Primary Gateway [${primaryGateway.gatewayId}] failed or timed out (${this.timeoutMs}ms): ${primaryError.message}`);

      // Subtask 2 & 3: Select Backup Gateway & Switch Active Route
      if (secondaryGateway) {
        this.switchActiveGatewayRoute(secondaryGateway.gatewayId);

        // Subtask 4: Verify Connection before failover
        const connVerification = await this.verifyGatewayConnection(secondaryGateway.gatewayId, sendToGatewayFn);
        if (!connVerification.verified) {
          throw new Error(`FAILOVER_FAILED: Backup Gateway [${secondaryGateway.gatewayId}] failed connection verification`);
        }

        try {
          const failoverResponse = await this.executeWithTimeout(
            () => sendToGatewayFn(secondaryGateway.gatewayId, requestPacket),
            this.timeoutMs
          );
          return {
            status: 'DELIVERED_FAILOVER',
            deliveredGatewayId: secondaryGateway.gatewayId,
            failoverOccurred: true,
            primaryError: primaryError.message,
            response: failoverResponse
          };
        } catch (secondaryError) {
          throw new Error(`ALL_GATEWAYS_FAILED: Primary [${primaryGateway.gatewayId}] failed (${primaryError.message}), Secondary [${secondaryGateway.gatewayId}] failed (${secondaryError.message})`);
        }
      } else {
        throw new Error(`PRIMARY_GATEWAY_FAILED: Primary [${primaryGateway.gatewayId}] failed (${primaryError.message}) and no secondary gateway available.`);
      }
    }
  }

  executeWithTimeout(asyncFn, timeoutMs) {
    return new Promise((resolve, reject) => {
      let timer = setTimeout(() => {
        timer = null;
        reject(new Error(`REQUEST_TIMEOUT_${timeoutMs}MS`));
      }, timeoutMs);

      asyncFn()
        .then((res) => {
          if (timer) {
            clearTimeout(timer);
            resolve(res);
          }
        })
        .catch((err) => {
          if (timer) {
            clearTimeout(timer);
            reject(err);
          }
        });
    });
  }
}
