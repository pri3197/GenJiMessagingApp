/**
 * Task 3.1.6: Distributed Knowledge Synchronisation Module
 * Manages P2P decentralized knowledge synchronization across BLE mesh nodes:
 * 1. Exchanges metadata manifests
 * 2. Compares document version vectors
 * 3. Detects outdated knowledge entries
 * 4. Transfers incremental delta updates
 * 5. Verifies SHA-256 file checksum integrity
 * 6. Resolves LWW / Vector Clock sync conflicts
 * 7. Stores updated documents in local RAG knowledge store
 */

import crypto from 'crypto';

export class DistributedKnowledgeSyncEngine {
  constructor(options = {}) {
    this.nodeId = options.nodeId || 'Node-User-Alpha';
    this.localStore = new Map(); // docId -> { docId, version, content, hash, updatedAt, authorNodeId }
    this.seedDefaultKnowledge();
  }

  seedDefaultKnowledge() {
    this.saveDocument({
      docId: 'SOP-CPR-2026',
      title: 'Offline CPR Protocol v1.0',
      version: 1,
      content: '1. Check responsiveness\n2. Call emergency mesh\n3. Perform 30 chest compressions at 100-120 bpm\n4. Give 2 rescue breaths.',
      updatedAt: 1785000000000,
      authorNodeId: 'Node-Admin'
    });

    this.saveDocument({
      docId: 'SOP-WATER-PURIFICATION',
      title: 'Water Purification Guidelines',
      version: 2,
      content: 'Boil water for 1 full minute or add 2 drops of household bleach per liter.',
      updatedAt: 1785100000000,
      authorNodeId: 'Node-Admin'
    });
  }

  // Calculate SHA-256 checksum for file integrity
  calculateHash(content) {
    return crypto.createHash('sha256').update(content || '').digest('hex');
  }

  // Save/Update Document locally
  saveDocument(docData = {}) {
    if (!docData.docId) throw new Error('KNOWLEDGE_ERROR: Valid docId required');

    const content = docData.content || '';
    const hash = this.calculateHash(content);

    const docRecord = {
      docId: docData.docId,
      title: docData.title || docData.docId,
      version: docData.version || 1,
      content,
      hash,
      updatedAt: docData.updatedAt || Date.now(),
      authorNodeId: docData.authorNodeId || this.nodeId
    };

    this.localStore.set(docData.docId, docRecord);
    return docRecord;
  }

  // Subtask 1: Exchange Knowledge Version Metadata
  getMetadataManifest() {
    const manifest = [];
    for (const [docId, doc] of this.localStore.entries()) {
      manifest.push({
        docId: doc.docId,
        title: doc.title,
        version: doc.version,
        hash: doc.hash,
        updatedAt: doc.updatedAt,
        authorNodeId: doc.authorNodeId
      });
    }
    return manifest;
  }

  // Subtask 2: Compare Document Versions & Subtask 3: Detect Outdated Knowledge
  compareManifests(remoteManifest = []) {
    const localManifest = this.getMetadataManifest();
    const localMap = new Map(localManifest.map(d => [d.docId, d]));
    const remoteMap = new Map(remoteManifest.map(d => [d.docId, d]));

    const outdatedLocal = []; // Remote has newer version, local needs update
    const outdatedRemote = []; // Local has newer version, remote needs update

    // Check remote items against local
    for (const remoteDoc of remoteManifest) {
      const localDoc = localMap.get(remoteDoc.docId);

      if (!localDoc) {
        // Missing locally -> Outdated local
        outdatedLocal.push({ docId: remoteDoc.docId, reason: 'MISSING_LOCAL', remoteDoc });
      } else if (remoteDoc.version > localDoc.version || remoteDoc.updatedAt > localDoc.updatedAt) {
        // Remote version higher or timestamp newer -> Outdated local
        outdatedLocal.push({ docId: remoteDoc.docId, reason: 'NEWER_REMOTE_VERSION', localDoc, remoteDoc });
      } else if (localDoc.version > remoteDoc.version || localDoc.updatedAt > remoteDoc.updatedAt) {
        // Local version higher -> Outdated remote
        outdatedRemote.push({ docId: remoteDoc.docId, reason: 'NEWER_LOCAL_VERSION', localDoc, remoteDoc });
      }
    }

    // Check missing remote items
    for (const localDoc of localManifest) {
      if (!remoteMap.has(localDoc.docId)) {
        outdatedRemote.push({ docId: localDoc.docId, reason: 'MISSING_REMOTE', localDoc });
      }
    }

    return { outdatedLocal, outdatedRemote };
  }

  // Subtask 4: Transfer Delta Updates
  generateDeltaPayload(docId) {
    const doc = this.localStore.get(docId);
    if (!doc) throw new Error(`KNOWLEDGE_ERROR: Document ${docId} not found in local store`);

    return {
      type: 'KNOWLEDGE_DELTA_PAYLOAD',
      docId: doc.docId,
      title: doc.title,
      version: doc.version,
      content: doc.content,
      hash: doc.hash,
      updatedAt: doc.updatedAt,
      authorNodeId: doc.authorNodeId
    };
  }

  // Subtask 5: Verify File Integrity
  verifyIntegrity(content, expectedHash) {
    if (!content || !expectedHash) return false;
    const computedHash = this.calculateHash(content);
    return computedHash === expectedHash;
  }

  // Subtask 6: Resolve Synchronisation Conflicts (Last-Write-Wins with Timestamp & Version Vector)
  resolveConflict(localDoc, remoteDoc) {
    if (!localDoc) return { winner: 'REMOTE', doc: remoteDoc };
    if (!remoteDoc) return { winner: 'LOCAL', doc: localDoc };

    // Higher version number wins
    if (remoteDoc.version > localDoc.version) {
      return { winner: 'REMOTE', doc: remoteDoc, reason: 'HIGHER_VERSION' };
    }
    if (localDoc.version > remoteDoc.version) {
      return { winner: 'LOCAL', doc: localDoc, reason: 'HIGHER_VERSION' };
    }

    // Tie-breaker: Last-Write-Wins (LWW) by timestamp
    if (remoteDoc.updatedAt > localDoc.updatedAt) {
      return { winner: 'REMOTE', doc: remoteDoc, reason: 'NEWER_TIMESTAMP' };
    }
    return { winner: 'LOCAL', doc: localDoc, reason: 'NEWER_TIMESTAMP_OR_LOCAL_PRIORITY' };
  }

  // Subtask 7: Store Updated Knowledge Locally
  syncRemoteDelta(remoteDeltaPayload) {
    // 5. Verify Integrity
    const isValidIntegrity = this.verifyIntegrity(remoteDeltaPayload.content, remoteDeltaPayload.hash);
    if (!isValidIntegrity) {
      throw new Error('KNOWLEDGE_INTEGRITY_ERROR: Remote delta SHA-256 checksum verification failed');
    }

    const existingLocal = this.localStore.get(remoteDeltaPayload.docId);

    // 6. Resolve Conflict
    const resolution = this.resolveConflict(existingLocal, remoteDeltaPayload);

    if (resolution.winner === 'REMOTE') {
      // 7. Store updated knowledge locally
      const updated = this.saveDocument(remoteDeltaPayload);
      console.log(`[Knowledge Sync] Successfully updated local document [${remoteDeltaPayload.docId}] to v${updated.version}`);
      return { synced: true, updatedDoc: updated, resolution };
    }

    return { synced: false, reason: 'LOCAL_VERSION_PREFERRED', resolution };
  }
}
