/**
 * Task 3.1.7: Peer-to-Peer Message Exchange Module
 * Manages P2P BLE mesh frame formatting, AES-256-GCM payload encryption, HMAC-SHA256 digital signing,
 * signature verification, multi-hop relay forwarding, duplicate forwarding prevention, TTL management,
 * and temporary transit message caching.
 */

import crypto from 'crypto';
import { RelayDeduplicationCache } from './multipath_failover.js';

export class PeerMessageExchangeManager {
  constructor(options = {}) {
    this.localNodeId = options.localNodeId || 'Node-User-Alpha';
    this.sharedSecret = options.sharedSecret || 'BLE_MESH_P2P_SHARED_SECRET_2026';
    this.dedupCache = new RelayDeduplicationCache(options.dedupTtlMs || 60000);
    this.tempMessageCache = new Map(); // packetId -> packetRecord
    this.sequenceCounter = 0;
  }

  // 2. Encrypt Messages (AES-256-GCM)
  encryptPayload(plainText, keyHex = crypto.scryptSync(this.sharedSecret, 'p2p_salt', 32)) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', keyHex, iv);
    let ciphertext = cipher.update(plainText, 'utf8', 'hex');
    ciphertext += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return {
      iv: iv.toString('hex'),
      ciphertext,
      authTag
    };
  }

  // Decrypt Payload (AES-256-GCM)
  decryptPayload(encryptedBody, keyHex = crypto.scryptSync(this.sharedSecret, 'p2p_salt', 32)) {
    const iv = Buffer.from(encryptedBody.iv, 'hex');
    const authTag = Buffer.from(encryptedBody.authTag, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyHex, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedBody.ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  // 3. Sign Messages (HMAC-SHA256)
  signMessage(packetHeader, secret = this.sharedSecret) {
    const dataToSign = `${packetHeader.packetId}:${packetHeader.senderId}:${packetHeader.targetId}:${packetHeader.sequenceNumber}:${packetHeader.ttl}`;
    return crypto.createHmac('sha256', secret).update(dataToSign).digest('hex');
  }

  // 4. Verify Incoming Signatures
  verifyMessageSignature(packet, secret = this.sharedSecret) {
    if (!packet || !packet.signature) return false;
    const expectedSig = this.signMessage(packet, secret);
    return crypto.timingSafeEqual(Buffer.from(packet.signature), Buffer.from(expectedSig));
  }

  // 1. Create Mesh Message Format
  createMeshMessage(targetId, textPayload, options = {}) {
    this.sequenceCounter++;
    const packetId = `PKT-P2P-${Date.now()}-${this.sequenceCounter}`;
    const ttl = options.ttl !== undefined ? options.ttl : 7; // Default 7 hops

    const encryptedBody = this.encryptPayload(textPayload);

    const packetHeader = {
      packetId,
      senderId: this.localNodeId,
      targetId,
      sequenceNumber: this.sequenceCounter,
      ttl,
      timestamp: Date.now()
    };

    const signature = this.signMessage(packetHeader);

    const packet = {
      ...packetHeader,
      encryptedBody,
      signature
    };

    // 8. Store temporary message cache
    this.tempMessageCache.set(packetId, { packet, status: 'QUEUED', createdAt: Date.now() });

    return packet;
  }

  // 5. Forward Messages & 6. Prevent Duplicate Forwarding & 7. Manage Message TTL
  async forwardMessage(packet, relayTransmitFn) {
    if (!packet) throw new Error('P2P_ERROR: Null packet cannot be forwarded');

    // 4. Verify Incoming Signature
    const isValidSig = this.verifyMessageSignature(packet);
    if (!isValidSig) {
      throw new Error('P2P_SIG_ERROR: Incoming P2P packet HMAC signature verification failed');
    }

    // 6. Prevent Duplicate Forwarding
    if (!this.dedupCache.shouldRelay(packet)) {
      return { status: 'DROPPED_DUPLICATE', packetId: packet.packetId };
    }

    // Check Destination match
    if (packet.targetId === this.localNodeId) {
      const decryptedText = this.decryptPayload(packet.encryptedBody);
      return {
        status: 'DELIVERED_TO_SELF',
        packetId: packet.packetId,
        senderId: packet.senderId,
        text: decryptedText
      };
    }

    // 7. Manage Message TTL
    if (packet.ttl <= 1) {
      console.warn(`[P2P Relay] Dropping packet [${packet.packetId}] due to TTL expiration (TTL: 0)`);
      return { status: 'DROPPED_TTL_EXPIRED', packetId: packet.packetId };
    }

    // Decrement TTL for hop forwarding
    const forwardedPacket = {
      ...packet,
      ttl: packet.ttl - 1
    };

    // Re-sign packet for new TTL state
    forwardedPacket.signature = this.signMessage(forwardedPacket);

    // 8. Store temporary message cache
    this.tempMessageCache.set(packet.packetId, { packet: forwardedPacket, status: 'FORWARDING', createdAt: Date.now() });

    // 5. Forward Message
    if (typeof relayTransmitFn === 'function') {
      await relayTransmitFn(forwardedPacket);
    }

    return {
      status: 'FORWARDED',
      packetId: packet.packetId,
      remainingTtl: forwardedPacket.ttl
    };
  }

  // 8. Clear Stale Temporary Message Cache
  pruneTempCache(maxAgeMs = 60000) {
    const now = Date.now();
    let pruned = 0;
    for (const [id, record] of this.tempMessageCache.entries()) {
      if (now - record.createdAt > maxAgeMs) {
        this.tempMessageCache.delete(id);
        pruned++;
      }
    }
    return pruned;
  }
}
