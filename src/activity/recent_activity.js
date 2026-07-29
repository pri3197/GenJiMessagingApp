/**
 * Task 2.1.5: Recent Activity Engine
 * Logs and categorizes real-time network events: AI queries, Mesh messages,
 * Gateway failover changes, and P2P history synchronisation events.
 */

export const ActivityType = {
  AI_QUERY: 'AI_QUERY',
  MESH_MESSAGE: 'MESH_MESSAGE',
  GATEWAY_CHANGE: 'GATEWAY_CHANGE',
  SYNC_EVENT: 'SYNC_EVENT'
};

export class RecentActivityManager {
  constructor() {
    this.activities = [];
    this.seedDefaultActivities();
  }

  seedDefaultActivities() {
    this.logActivity(ActivityType.AI_QUERY, 'Emergency CPR Protocol Query', '⚡ Edge Local RAG (Gateway C1)', '13:45');
    this.logActivity(ActivityType.MESH_MESSAGE, 'Relay B1 active in District 4', 'Node B1 - Rescue Relay', '13:40');
    this.logActivity(ActivityType.GATEWAY_CHANGE, 'Elected Gateway updated to Gateway C1', 'Composite Score: 69.25', '12:50');
    this.logActivity(ActivityType.SYNC_EVENT, 'P2P History Sync completed with Node B2', 'Integrated 3 delta messages', '12:30');
  }

  // Log new activity event
  logActivity(type, title, detail, time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })) {
    const entry = {
      id: `act-${Date.now()}-${Math.floor(Math.random()*1000)}`,
      type,
      title,
      detail,
      time,
      timestamp: Date.now()
    };
    this.activities.unshift(entry);
    if (this.activities.length > 50) this.activities.pop();
    return entry;
  }

  // Get filtered activities
  getActivities(typeFilter = 'ALL') {
    if (typeFilter === 'ALL') return this.activities;
    return this.activities.filter(a => a.type === typeFilter);
  }

  // 5. Clear activity history
  clearHistory() {
    this.activities = [];
    console.log('Recent activity history cleared.');
    return true;
  }
}
