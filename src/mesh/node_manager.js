/**
 * Task 3.1.2: Mesh Node Manager Module
 * Registers discovered mesh nodes, updates node status, prunes inactive/stale nodes,
 * processes heartbeats, tracks RSSI (moving average), monitors battery, tracks latency, and calculates hop counts.
 */

export const NODE_STATUS = {
  ACTIVE: 'ACTIVE',
  DEGRADED: 'DEGRADED',
  DISCONNECTED: 'DISCONNECTED'
};

export class MeshNodeManager {
  constructor(options = {}) {
    this.inactivityTimeoutMs = options.inactivityTimeoutMs || 10000;
    this.nodes = new Map(); // nodeId -> NodeRecord
  }

  // 1. Register Discovered Node
  registerNode(nodeData = {}) {
    if (!nodeData.nodeId) {
      throw new Error('NODE_MANAGER_ERROR: Valid nodeId required to register node');
    }

    const now = Date.now();
    const existing = this.nodes.get(nodeData.nodeId);

    const record = {
      nodeId: nodeData.nodeId,
      deviceName: nodeData.deviceName || `Mesh-Node-${nodeData.nodeId.slice(-4)}`,
      role: nodeData.role || 'NODE',
      status: NODE_STATUS.ACTIVE,
      rssi: nodeData.rssi || -60,
      rssiHistory: existing ? [...existing.rssiHistory.slice(-9), nodeData.rssi || -60] : [nodeData.rssi || -60],
      battery: nodeData.battery !== undefined ? nodeData.battery : 100,
      isLowBattery: (nodeData.battery !== undefined ? nodeData.battery : 100) <= 20,
      latencyMs: nodeData.latencyMs || 50,
      latencyHistory: existing ? [...existing.latencyHistory.slice(-9), nodeData.latencyMs || 50] : [nodeData.latencyMs || 50],
      hops: nodeData.hops || 1,
      registeredAt: existing ? existing.registeredAt : now,
      lastHeartbeat: now
    };

    this.nodes.set(nodeData.nodeId, record);
    return record;
  }

  // 2. Update Node Status
  updateNodeStatus(nodeId, status) {
    const node = this.nodes.get(nodeId);
    if (!node) return false;
    if (Object.values(NODE_STATUS).includes(status)) {
      node.status = status;
      return true;
    }
    return false;
  }

  // 3. Remove Inactive Node (Pruning)
  pruneInactiveNodes(ttlMs = this.inactivityTimeoutMs) {
    const now = Date.now();
    const removedNodes = [];

    for (const [nodeId, node] of this.nodes.entries()) {
      if (now - node.lastHeartbeat > ttlMs) {
        node.status = NODE_STATUS.DISCONNECTED;
        this.nodes.delete(nodeId);
        removedNodes.push(nodeId);
      }
    }

    if (removedNodes.length > 0) {
      console.log(`[Mesh Node Manager] Pruned ${removedNodes.length} inactive nodes:`, removedNodes);
    }
    return removedNodes;
  }

  // 4. Update Heartbeat & 5. Track RSSI & 6. Track Battery & 7. Track Latency
  receiveHeartbeat(nodeId, metrics = {}) {
    const node = this.nodes.get(nodeId);
    if (!node) return false;

    const now = Date.now();
    node.lastHeartbeat = now;
    node.status = NODE_STATUS.ACTIVE;

    // Track RSSI (Moving Average)
    if (metrics.rssi !== undefined) {
      node.rssi = metrics.rssi;
      node.rssiHistory.push(metrics.rssi);
      if (node.rssiHistory.length > 10) node.rssiHistory.shift();
    }

    // Track Battery
    if (metrics.battery !== undefined) {
      node.battery = metrics.battery;
      node.isLowBattery = metrics.battery <= 20;
    }

    // Track Latency
    if (metrics.latencyMs !== undefined) {
      node.latencyMs = metrics.latencyMs;
      node.latencyHistory.push(metrics.latencyMs);
      if (node.latencyHistory.length > 10) node.latencyHistory.shift();
    }

    // Update Hop Count
    if (metrics.hops !== undefined) {
      node.hops = metrics.hops;
    }

    return node;
  }

  // 5. Calculate Average RSSI
  getAverageRssi(nodeId) {
    const node = this.nodes.get(nodeId);
    if (!node || node.rssiHistory.length === 0) return 0;
    const sum = node.rssiHistory.reduce((acc, v) => acc + v, 0);
    return Math.round(sum / node.rssiHistory.length);
  }

  // 7. Calculate Average Latency
  getAverageLatency(nodeId) {
    const node = this.nodes.get(nodeId);
    if (!node || node.latencyHistory.length === 0) return 0;
    const sum = node.latencyHistory.reduce((acc, v) => acc + v, 0);
    return Math.round(sum / node.latencyHistory.length);
  }

  // 8. Calculate Hop Count from Route Path Array
  calculateHopCount(pathArray = []) {
    if (!Array.isArray(pathArray) || pathArray.length <= 1) return 1;
    return pathArray.length - 1;
  }

  // Get active nodes list
  getActiveNodes() {
    return Array.from(this.nodes.values()).filter(n => n.status === NODE_STATUS.ACTIVE);
  }
}
