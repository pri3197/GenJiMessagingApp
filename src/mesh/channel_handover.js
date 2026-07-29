/**
 * Task Feature 3.2: Multi-Channel Handover Engine
 * Manages transport priority (BLE Mesh -> Wi-Fi Direct -> Acoustic Sound -> Internet Cellular),
 * detects channel degradation or total failure, and executes seamless automatic or manual handovers.
 */

import { SoundChannelEngine } from './sound_channel.js';

export const CHANNEL_TYPE = {
  BLUETOOTH_MESH: 'BLUETOOTH_MESH',
  WIFI_DIRECT: 'WIFI_DIRECT',
  ACOUSTIC_SOUND: 'ACOUSTIC_SOUND',
  INTERNET_CELLULAR: 'INTERNET_CELLULAR'
};

export class ChannelHandoverManager {
  constructor(options = {}) {
    this.soundEngine = options.soundEngine || new SoundChannelEngine();
    this.activeChannel = CHANNEL_TYPE.BLUETOOTH_MESH;
    this.manualOverride = false;
    this.channelStates = new Map([
      [CHANNEL_TYPE.BLUETOOTH_MESH, { healthy: true, latencyMs: 45, rssi: -55 }],
      [CHANNEL_TYPE.WIFI_DIRECT, { healthy: true, latencyMs: 12, rssi: -45 }],
      [CHANNEL_TYPE.ACOUSTIC_SOUND, { healthy: true, latencyMs: 350, signalDb: -20 }],
      [CHANNEL_TYPE.INTERNET_CELLULAR, { healthy: false, latencyMs: 2500, wanOnline: false }]
    ]);
    this.handoverLogs = [];
  }

  // Detect Channel Health or Failure
  detectChannelFailure(channelType = this.activeChannel) {
    const state = this.channelStates.get(channelType);
    if (!state) return true;
    return !state.healthy;
  }

  // Switch Active Channel (Manual or Auto Handover)
  switchChannel(targetChannel, isManual = false) {
    if (!Object.values(CHANNEL_TYPE).includes(targetChannel)) {
      throw new Error(`HANDOVER_ERROR: Unknown channel transport ${targetChannel}`);
    }

    const previousChannel = this.activeChannel;
    this.activeChannel = targetChannel;
    this.manualOverride = isManual;

    // Start microphone listening if acoustic sound channel activated
    if (targetChannel === CHANNEL_TYPE.ACOUSTIC_SOUND) {
      this.soundEngine.startListening();
    } else {
      this.soundEngine.stopListening();
    }

    const logEntry = {
      timestamp: new Date().toISOString(),
      previousChannel,
      activeChannel: targetChannel,
      isManual,
      reason: isManual ? 'USER_MANUAL_TOGGLE' : 'AUTOMATIC_CHANNEL_FAILOVER'
    };

    this.handoverLogs.push(logEntry);
    console.log(`[Channel Handover] Active transport switched to [${targetChannel}] (Manual: ${isManual})`);
    return logEntry;
  }

  // Automatic Handover Fallback Evaluation
  evaluateSeamlessHandover() {
    if (this.manualOverride) {
      return { activeChannel: this.activeChannel, handoverTriggered: false, reason: 'MANUAL_OVERRIDE_ACTIVE' };
    }

    // Check current channel health
    if (!this.detectChannelFailure(this.activeChannel)) {
      return { activeChannel: this.activeChannel, handoverTriggered: false };
    }

    // Fallback Priority Hierarchy
    const priorityList = [
      CHANNEL_TYPE.BLUETOOTH_MESH,
      CHANNEL_TYPE.WIFI_DIRECT,
      CHANNEL_TYPE.ACOUSTIC_SOUND,
      CHANNEL_TYPE.INTERNET_CELLULAR
    ];

    for (const candidateChannel of priorityList) {
      if (!this.detectChannelFailure(candidateChannel)) {
        const log = this.switchChannel(candidateChannel, false);
        return { activeChannel: candidateChannel, handoverTriggered: true, log };
      }
    }

    // Default to Acoustic Sound as universal offline fallback
    const log = this.switchChannel(CHANNEL_TYPE.ACOUSTIC_SOUND, false);
    return { activeChannel: CHANNEL_TYPE.ACOUSTIC_SOUND, handoverTriggered: true, log };
  }

  // Simulate Channel Degradation/Failure for Testing
  setChannelHealth(channelType, healthy) {
    const state = this.channelStates.get(channelType);
    if (state) {
      state.healthy = Boolean(healthy);
      if (!healthy && this.activeChannel === channelType) {
        this.evaluateSeamlessHandover();
      }
    }
  }

  getChannelSummary() {
    return {
      activeChannel: this.activeChannel,
      manualOverride: this.manualOverride,
      channels: Object.fromEntries(this.channelStates),
      batteryImpact: this.soundEngine.getBatteryImpactMetrics(),
      handoverCount: this.handoverLogs.length
    };
  }
}
