/**
 * Heartbeat Beacon Service - Task 1.1.1.1
 * Emits periodic 3000ms heartbeat beacons carrying gateway telemetry:
 * WAN status, RSSI, battery %, queue load %, WAN latency, and mesh hops.
 */

export class HeartbeatBeacon {
  /**
   * @param {Object} options
   * @param {string} options.gatewayId - Unique identifier for the gateway (e.g., "Gateway-C1")
   * @param {number} [options.intervalMs=3000] - Heartbeat frequency in ms
   * @param {boolean} [options.wanOnline=true] - Current WAN connectivity status
   * @param {number} [options.rssi=-55] - Signal strength in dBm (-30 to -100)
   * @param {number} [options.battery=90] - Remaining battery percentage (0 to 100)
   * @param {number} [options.load=15] - Current queue/worker load percentage (0 to 100)
   * @param {number} [options.wanLatency=120] - WAN ping latency in ms
   * @param {number} [options.hops=1] - Mesh hops away from target node
   */
  constructor(options = {}) {
    this.gatewayId = options.gatewayId || `GW-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    this.intervalMs = options.intervalMs || 3000;
    this.wanOnline = options.wanOnline !== undefined ? options.wanOnline : true;
    this.rssi = options.rssi !== undefined ? options.rssi : -55;
    this.battery = options.battery !== undefined ? options.battery : 90;
    this.load = options.load !== undefined ? options.load : 15;
    this.wanLatency = options.wanLatency !== undefined ? options.wanLatency : 120;
    this.hops = options.hops !== undefined ? options.hops : 1;
    this.timer = null;
    this.sequenceNumber = 0;
  }

  /**
   * Updates live telemetry metrics for the beacon
   * @param {Partial<HeartbeatBeacon>} metrics
   */
  updateMetrics(metrics = {}) {
    if (metrics.wanOnline !== undefined) this.wanOnline = Boolean(metrics.wanOnline);
    if (metrics.rssi !== undefined) this.rssi = Number(metrics.rssi);
    if (metrics.battery !== undefined) this.battery = Math.max(0, Math.min(100, Number(metrics.battery)));
    if (metrics.load !== undefined) this.load = Math.max(0, Math.min(100, Number(metrics.load)));
    if (metrics.wanLatency !== undefined) this.wanLatency = Math.max(0, Number(metrics.wanLatency));
    if (metrics.hops !== undefined) this.hops = Math.max(0, Number(metrics.hops));
  }

  /**
   * Generates a single heartbeat beacon payload frame
   * @returns {Object} Beacon payload frame
   */
  generateBeaconPayload() {
    this.sequenceNumber += 1;
    return {
      type: 'HEARTBEAT_BEACON',
      gatewayId: this.gatewayId,
      sequenceNumber: this.sequenceNumber,
      timestamp: Date.now(),
      metrics: {
        wanOnline: this.wanOnline,
        rssi: this.rssi,
        battery: this.battery,
        load: this.load,
        wanLatency: this.wanLatency,
        hops: this.hops
      }
    };
  }

  /**
   * Starts periodic heartbeat emission
   * @param {function(Object): void} onBeacon - Callback invoked on each heartbeat tick
   */
  start(onBeacon) {
    if (this.timer) this.stop();
    
    // Emit initial heartbeat immediately
    if (typeof onBeacon === 'function') {
      onBeacon(this.generateBeaconPayload());
    }

    this.timer = setInterval(() => {
      if (typeof onBeacon === 'function') {
        onBeacon(this.generateBeaconPayload());
      }
    }, this.intervalMs);
  }

  /**
   * Stops the periodic heartbeat timer
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
