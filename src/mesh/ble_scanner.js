/**
 * Task 3.1.1: BLE Scanner Module
 * Initializes BLE adapter, manages scanning windows, filters emergency mesh UUIDs,
 * parses BLE advertisement packets, discovers nodes & gateways, handles scan timeouts and radio errors.
 */

export const BLE_ADAPTER_STATE = {
  POWERED_ON: 'POWERED_ON',
  POWERED_OFF: 'POWERED_OFF',
  UNAUTHORIZED: 'UNAUTHORIZED',
  UNSUPPORTED: 'UNSUPPORTED'
};

export const EMERGENCY_MESH_SERVICE_UUID = '0000feaa-0000-1000-8000-00805f9b34fb';

export class BleScanner {
  constructor(options = {}) {
    this.adapterState = options.adapterState || BLE_ADAPTER_STATE.POWERED_ON;
    this.isScanning = false;
    this.scanTimeoutTimer = null;
    this.scanWindowMs = options.scanWindowMs || 10000;

    this.discoveredNodes = new Map(); // nodeId -> nodeData
    this.discoveredGateways = new Map(); // gatewayId -> gatewayData
    this.errorLogs = [];
  }

  // 1. Initialize BLE Adapter
  initBleAdapter() {
    if (this.adapterState === BLE_ADAPTER_STATE.POWERED_OFF) {
      throw new Error('BLE_ERROR: Bluetooth adapter is powered off. Please enable Bluetooth.');
    }
    if (this.adapterState === BLE_ADAPTER_STATE.UNAUTHORIZED) {
      throw new Error('BLE_ERROR: Bluetooth scan permission unauthorized by user.');
    }
    if (this.adapterState === BLE_ADAPTER_STATE.UNSUPPORTED) {
      throw new Error('BLE_ERROR: Device does not support Bluetooth Low Energy (BLE).');
    }
    console.log('[BLE Scanner] BLE Adapter initialized cleanly in POWERED_ON state.');
    return { success: true, state: this.adapterState };
  }

  // 4. Filter Emergency Devices & 5. Parse BLE Advertisement Packets
  parseAdvertisement(advPacket = {}) {
    const {
      deviceId,
      deviceName,
      rssi,
      serviceUuids = [],
      manufacturerData = {},
      txPowerLevel
    } = advPacket;

    // 4. Filter Emergency Devices
    const isEmergencyMeshDevice = serviceUuids.includes(EMERGENCY_MESH_SERVICE_UUID) ||
      (manufacturerData.companyId === 0x0999 && manufacturerData.protocol === 'BLE_MESH_AI');

    if (!isEmergencyMeshDevice) {
      return null; // Ignore non-emergency BLE devices
    }

    const role = manufacturerData.role || 'NODE'; // 'NODE' or 'GATEWAY'
    const parsedData = {
      deviceId: deviceId || `BLE-${Math.floor(Math.random()*100000)}`,
      deviceName: deviceName || (role === 'GATEWAY' ? 'Emergency Gateway Node' : 'Emergency Peer Node'),
      rssi: rssi || -65,
      txPowerLevel: txPowerLevel || -4,
      role,
      battery: manufacturerData.battery !== undefined ? manufacturerData.battery : 85,
      wanOnline: manufacturerData.wanOnline !== undefined ? manufacturerData.wanOnline : (role === 'GATEWAY'),
      hops: manufacturerData.hops || 1,
      lastSeen: Date.now()
    };

    // 6 & 7. Discover Nearby Nodes and Gateways
    if (role === 'GATEWAY') {
      this.discoveredGateways.set(parsedData.deviceId, parsedData);
    } else {
      this.discoveredNodes.set(parsedData.deviceId, parsedData);
    }

    return parsedData;
  }

  // 2. Start Scanning with Timeout
  startScan(scanWindowMs = this.scanWindowMs) {
    this.initBleAdapter();

    if (this.isScanning) {
      console.log('[BLE Scanner] Scan already active.');
      return false;
    }

    this.isScanning = true;
    console.log(`[BLE Scanner] Started BLE scanning (Window: ${scanWindowMs}ms)...`);

    // 8. Handle Scan Timeout
    this.scanTimeoutTimer = setTimeout(() => {
      this.handleScanTimeout();
    }, scanWindowMs);

    return true;
  }

  // 3. Stop Scanning
  stopScan() {
    if (this.scanTimeoutTimer) {
      clearTimeout(this.scanTimeoutTimer);
      this.scanTimeoutTimer = null;
    }
    if (this.isScanning) {
      this.isScanning = false;
      console.log('[BLE Scanner] BLE scanning stopped.');
      return true;
    }
    return false;
  }

  // 8. Handle Scan Timeout
  handleScanTimeout() {
    console.log(`[BLE Scanner] Scan window timeout reached (${this.scanWindowMs}ms). Auto-stopping scan.`);
    this.stopScan();
    return {
      event: 'SCAN_TIMEOUT',
      discoveredNodesCount: this.discoveredNodes.size,
      discoveredGatewaysCount: this.discoveredGateways.size
    };
  }

  // 9. Handle BLE Errors
  handleBleError(err) {
    const errorEntry = {
      timestamp: new Date().toISOString(),
      message: err.message || 'Unknown BLE Radio Error',
      code: err.code || 'BLE_RADIO_FAIL'
    };
    this.errorLogs.push(errorEntry);
    this.stopScan();
    console.error('[BLE Scanner Error]', errorEntry);
    return errorEntry;
  }
}
