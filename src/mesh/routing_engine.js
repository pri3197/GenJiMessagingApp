/**
 * Task 3.1.4: Mesh Routing Engine Module
 * Manages graph topology, discovers available routes, calculates shortest (min hops) & lowest latency routes,
 * maintains an in-memory routing table & cache, prunes expired routes, and recalculates routes on topology changes.
 */

export class MeshRoutingEngine {
  constructor(options = {}) {
    this.localNodeId = options.localNodeId || 'Node-User-Alpha';
    this.routeTtlMs = options.routeTtlMs || 15000;
    this.adjacencyGraph = new Map(); // nodeId -> Map(neighborId -> { latencyMs, rssi })
    this.routingTable = new Map(); // targetNodeId -> RouteEntry { path, hops, totalLatency, lastUpdated }
  }

  // Add or update directional link in network graph topology
  addLink(nodeA, nodeB, metrics = { latencyMs: 30, rssi: -55 }) {
    if (!this.adjacencyGraph.has(nodeA)) this.adjacencyGraph.set(nodeA, new Map());
    if (!this.adjacencyGraph.has(nodeB)) this.adjacencyGraph.set(nodeB, new Map());

    this.adjacencyGraph.get(nodeA).set(nodeB, metrics);
    this.adjacencyGraph.get(nodeB).set(nodeA, metrics); // Undirected link
  }

  // Remove node or link on topology change
  removeNode(nodeId) {
    if (this.adjacencyGraph.has(nodeId)) {
      this.adjacencyGraph.delete(nodeId);
      for (const neighbors of this.adjacencyGraph.values()) {
        neighbors.delete(nodeId);
      }
      this.recalculateRoutesOnTopologyChange(nodeId);
      return true;
    }
    return false;
  }

  // 1. Discover All Available Routes (BFS Traversal)
  discoverRoutes(targetNodeId, sourceNodeId = this.localNodeId) {
    if (!this.adjacencyGraph.has(sourceNodeId) || !this.adjacencyGraph.has(targetNodeId)) {
      return [];
    }

    const availableRoutes = [];
    const queue = [[sourceNodeId]];

    while (queue.length > 0) {
      const currentPath = queue.shift();
      const lastNode = currentPath[currentPath.length - 1];

      if (lastNode === targetNodeId) {
        // Calculate cumulative metrics for path
        let totalLatency = 0;
        let minRssi = 0;
        for (let i = 0; i < currentPath.length - 1; i++) {
          const edge = this.adjacencyGraph.get(currentPath[i]).get(currentPath[i + 1]);
          totalLatency += edge.latencyMs;
          minRssi = Math.min(minRssi, edge.rssi);
        }

        availableRoutes.push({
          path: currentPath,
          hops: currentPath.length - 1,
          totalLatency,
          minRssi,
          lastUpdated: Date.now()
        });

        if (availableRoutes.length >= 10) break; // Limit search depth
        continue;
      }

      const neighbors = this.adjacencyGraph.get(lastNode);
      if (neighbors) {
        for (const neighborId of neighbors.keys()) {
          if (!currentPath.includes(neighborId)) { // Prevent loops
            queue.push([...currentPath, neighborId]);
          }
        }
      }
    }

    return availableRoutes;
  }

  // 2. Calculate Shortest Route (Minimum Hop Count)
  calculateShortestRoute(targetNodeId, sourceNodeId = this.localNodeId) {
    const routes = this.discoverRoutes(targetNodeId, sourceNodeId);
    if (routes.length === 0) return null;
    return routes.sort((a, b) => a.hops - b.hops || a.totalLatency - b.totalLatency)[0];
  }

  // 3. Calculate Lowest-Latency Route
  calculateLowestLatencyRoute(targetNodeId, sourceNodeId = this.localNodeId) {
    const routes = this.discoverRoutes(targetNodeId, sourceNodeId);
    if (routes.length === 0) return null;
    return routes.sort((a, b) => a.totalLatency - b.totalLatency || a.hops - b.hops)[0];
  }

  // 4 & 5. Maintain Routing Table & Update Route Cache
  updateRouteCache(destinationId, optimalRoute) {
    if (!destinationId || !optimalRoute) return false;
    this.routingTable.set(destinationId, {
      ...optimalRoute,
      cachedAt: Date.now()
    });
    return true;
  }

  // Get cached route from memory table
  getRoute(destinationId) {
    this.removeExpiredRoutes();
    return this.routingTable.get(destinationId) || null;
  }

  // 6. Remove Expired Routes
  removeExpiredRoutes(ttlMs = this.routeTtlMs) {
    const now = Date.now();
    let expiredCount = 0;

    for (const [targetId, entry] of this.routingTable.entries()) {
      if (now - entry.cachedAt > ttlMs) {
        this.routingTable.delete(targetId);
        expiredCount++;
      }
    }
    return expiredCount;
  }

  // 7. Recalculate Routes After Topology Changes
  recalculateRoutesOnTopologyChange(failedNodeId = null) {
    console.log(`[Routing Engine] Topology change detected (Node: ${failedNodeId}). Recalculating active routes...`);
    this.routingTable.clear();

    // Re-evaluate routes for remaining graph destinations
    for (const destinationId of this.adjacencyGraph.keys()) {
      if (destinationId !== this.localNodeId) {
        const optimal = this.calculateLowestLatencyRoute(destinationId);
        if (optimal) {
          this.updateRouteCache(destinationId, optimal);
        }
      }
    }

    return this.routingTable.size;
  }
}
