import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { HeartbeatBeacon } from './mesh/heartbeat.js';
import { calculateGatewayScore, GatewayDiscoveryPipeline } from './mesh/gateway_selection.js';
import { RelayDeduplicationCache, MultipathFailoverManager } from './mesh/multipath_failover.js';
import { MultiFactorDecisionEngine } from './gateway/decision_engine.js';
import { PriorityLeakyBucketQueue } from './gateway/priority_queue.js';
import { QueryCache } from './gateway/query_cache.js';
import { BluetoothMeshService } from './mesh/mesh_integration.js';
import { MeshDiagnosticsEngine } from './mesh/diagnostics.js';
import { AuthDatabaseEngine } from './db/auth_entities.js';
import { RegistrationService } from './auth/registration_service.js';
import { LoginService } from './auth/login_service.js';
import { OtpService } from './auth/otp_service.js';
import { DeviceRegistrationService } from './auth/device_registration_service.js';
import { SecurityEngine } from './auth/security_middleware.js';
import { RecentActivityManager, ActivityType } from './activity/recent_activity.js';
import { SoundChannelEngine } from './mesh/sound_channel.js';
import { ChannelHandoverManager, CHANNEL_TYPE } from './mesh/channel_handover.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const ENV_PATH = path.join(__dirname, '..', '.env');

// Lightweight Native .env Loader
function loadEnvFile() {
  if (fs.existsSync(ENV_PATH)) {
    try {
      const content = fs.readFileSync(ENV_PATH, 'utf8');
      const lines = content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const [key, ...valueParts] = trimmed.split('=');
          const value = valueParts.join('=').trim();
          if (key && !process.env[key.trim()]) {
            process.env[key.trim()] = value;
          }
        }
      }
    } catch (e) {
      console.warn('Notice: Could not load .env file directly:', e.message);
    }
  }
}
loadEnvFile();

// Core Infrastructure Setup
const pipeline = new GatewayDiscoveryPipeline();
const decisionEngine = new MultiFactorDecisionEngine();
const workerQueue = new PriorityLeakyBucketQueue({ maxWorkers: 30, bucketCapacity: 300 });
const queryCache = new QueryCache(900000);

const gatewayC1Beacon = new HeartbeatBeacon({ gatewayId: 'Gateway-C1', wanOnline: true, rssi: -55, battery: 92, wanLatency: 450, hops: 1 });
const gatewayC2Beacon = new HeartbeatBeacon({ gatewayId: 'Gateway-C2', wanOnline: true, rssi: -67, battery: 72, wanLatency: 830, hops: 2 });

const failoverManager = new MultipathFailoverManager({ discoveryPipeline: pipeline, timeoutMs: 2500 });
const meshService = new BluetoothMeshService({ failoverManager, localNodeId: 'Node-User-Alpha' });
const diagnosticsEngine = new MeshDiagnosticsEngine({ failoverManager });
const activityManager = new RecentActivityManager();

const soundEngine = new SoundChannelEngine({ secretKey: process.env.HMAC_SECRET_KEY || 'ACOUSTIC_SOUND_SHARED_SECRET_2026' });
const handoverManager = new ChannelHandoverManager({ soundEngine });

const authDb = new AuthDatabaseEngine();
const registrationService = new RegistrationService(authDb);
const loginService = new LoginService(authDb);
const otpService = new OtpService(authDb);
const deviceService = new DeviceRegistrationService(authDb);
const securityEngine = new SecurityEngine();

let c1Jammed = false;
let apiQuotaHealthy = true;

pipeline.registerBeacon(gatewayC1Beacon.generateBeaconPayload());
pipeline.registerBeacon(gatewayC2Beacon.generateBeaconPayload());

const heartbeatInterval = setInterval(() => {
  if (!c1Jammed) pipeline.registerBeacon(gatewayC1Beacon.generateBeaconPayload());
  pipeline.registerBeacon(gatewayC2Beacon.generateBeaconPayload());
}, 3000);

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json'
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;
  const clientIp = req.socket.remoteAddress || '127.0.0.1';

  securityEngine.applySecurityHeaders(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Production Health Check Endpoints (/health & /api/health)
  if (pathname === '/health' || pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'HEALTHY',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      activeChannel: handoverManager.activeChannel,
      meshService: 'ACTIVE',
      memoryUsageMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
    }));
    return;
  }

  // Rate Limiting
  try {
    securityEngine.checkRateLimit(clientIp);
  } catch (err) {
    res.writeHead(err.statusCode || 429, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
    return;
  }

  // FEATURE 3.2 API: SOUND CHANNEL ENDPOINTS
  if (pathname === '/api/sound/status' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(handoverManager.getChannelSummary()));
    return;
  }

  if (pathname === '/api/sound/toggle' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const targetChannel = payload.channel || (handoverManager.activeChannel === CHANNEL_TYPE.ACOUSTIC_SOUND ? CHANNEL_TYPE.BLUETOOTH_MESH : CHANNEL_TYPE.ACOUSTIC_SOUND);
        const result = handoverManager.switchChannel(targetChannel, true);
        activityManager.logActivity(ActivityType.GATEWAY_CHANGE, `Transport Switched to ${targetChannel}`, 'Manual Toggle');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, activeChannel: targetChannel, result }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (pathname === '/api/sound/transmit' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const text = payload.text || 'Emergency Sound Signal';
        const chirpPayload = soundEngine.encodeToAudioFrequencies(text);
        activityManager.logActivity(ActivityType.MESH_MESSAGE, 'Acoustic Sound Signal Transmitted', `FSK Tones: ${chirpPayload.frequencySequenceHz.length}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, chirpPayload }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // TASK 2.1.5 API: RECENT ACTIVITY ENDPOINTS
  if (pathname === '/api/activity/list' && req.method === 'GET') {
    const filter = parsedUrl.searchParams.get('filter') || 'ALL';
    const list = activityManager.getActivities(filter);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ count: list.length, filter, activities: list }));
    return;
  }

  if (pathname === '/api/activity/clear' && req.method === 'POST') {
    activityManager.clearHistory();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Activity history cleared' }));
    return;
  }

  // TASK 1.1.6 API: REFRESH TOKEN ROTATION ENDPOINT
  if (pathname === '/api/auth/token/refresh' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const result = securityEngine.rotateRefreshToken(payload.refreshToken);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        const statusCode = err.statusCode || 401;
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // TASK 1.1.2 API: USER REGISTRATION ENDPOINT
  if (pathname === '/api/auth/register' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const result = registrationService.registerUser(payload);
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        const statusCode = err.statusCode || 500;
        const errorMessage = err.message || 'INTERNAL_SERVER_ERROR: Registration failed';
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: errorMessage }));
      }
    });
    return;
  }

  // TASK 1.1.3 API: USER LOGIN ENDPOINT
  if (pathname === '/api/auth/login' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const result = loginService.loginUser(payload, clientIp);

        const rs256AccessToken = securityEngine.signRs256Jwt({ userId: result.user.id, email: result.user.email, role: result.user.role_id });
        const refreshToken = securityEngine.issueRefreshToken(result.user.id);
        result.accessToken = rs256AccessToken;
        result.refreshToken = refreshToken;

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        const statusCode = err.statusCode || 500;
        const errorMessage = err.message || 'INTERNAL_SERVER_ERROR: Login failed';
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: errorMessage }));
      }
    });
    return;
  }

  // TASK 1.1.4 API: OTP ENDPOINTS
  if (pathname === '/api/auth/otp/request' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const result = otpService.requestOtp(payload.identifier, payload.channel || 'EMAIL');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        const statusCode = err.statusCode || 500;
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (pathname === '/api/auth/otp/verify' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const result = otpService.verifyOtp(payload.identifier, payload.otp);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        const statusCode = err.statusCode || 500;
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (pathname === '/api/auth/otp/resend' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const result = otpService.resendOtp(payload.identifier);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        const statusCode = err.statusCode || 500;
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // TASK 1.1.5 API: DEVICE REGISTRATION ENDPOINT
  if (pathname === '/api/auth/device/register' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const result = deviceService.registerDevice(payload);
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        const statusCode = err.statusCode || 500;
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // EPIC 8 MESH DIAGNOSTICS API ENDPOINTS
  if (pathname === '/api/diagnostics/summary' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(diagnosticsEngine.getDiagnosticsSummary()));
    return;
  }

  if (pathname === '/api/diagnostics/ping' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', async () => {
      try {
        const data = JSON.parse(body || '{}');
        const result = await diagnosticsEngine.pingGateway(data.gatewayId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (pathname === '/api/diagnostics/trace' && req.method === 'GET') {
    const targetNode = parsedUrl.searchParams.get('target') || 'Gateway';
    const trace = diagnosticsEngine.traceMeshPath(targetNode);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(trace));
    return;
  }

  if (pathname === '/api/diagnostics/switch-gateway' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        const switched = diagnosticsEngine.switchGateway(data.targetGatewayId);
        activityManager.logActivity(ActivityType.GATEWAY_CHANGE, `Gateway Switched to ${switched.activeGatewayId}`, `Latency: ${switched.latency}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(switched));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // TASK 6 API: Send BLE Mesh Chat Message
  if (pathname === '/api/mesh/send' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const targetNode = data.targetNode || 'Node-B1';
        const text = data.text || 'Emergency Message';
        const isOnline = data.isOnline !== undefined ? Boolean(data.isOnline) : true;

        const result = await meshService.sendChatMessage(targetNode, text, isOnline);
        activityManager.logActivity(ActivityType.MESH_MESSAGE, `Sent message to ${targetNode}`, text);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(422, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // TASK 6 API: Drain Offline Queue
  if (pathname === '/api/mesh/drain-offline' && req.method === 'POST') {
    try {
      const results = await meshService.drainOfflineQueue();
      activityManager.logActivity(ActivityType.MESH_MESSAGE, 'Offline Queue Drained', `Re-transmitted ${results.length} queued packets`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ drainedCount: results.length, items: results }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // TASK 6 API: P2P History Sync
  if (pathname === '/api/mesh/sync' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const synced = meshService.synchronizeConversationHistory(data.peerNodeId, data.localHistory || [], data.peerHistory || []);
        activityManager.logActivity(ActivityType.SYNC_EVENT, `P2P History Sync with ${data.peerNodeId}`, `Integrated ${synced.length} total messages`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ syncedCount: synced.length, history: synced }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (pathname === '/api/state') {
    pipeline.pruneStaleGateways();
    const ranked = pipeline.getRankedGateways();
    const elected = pipeline.selectElectedGateway();
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      gateways: {
        C1: {
          metrics: gatewayC1Beacon.generateBeaconPayload().metrics,
          jammed: c1Jammed,
          score: calculateGatewayScore(gatewayC1Beacon.generateBeaconPayload().metrics)
        },
        C2: {
          metrics: gatewayC2Beacon.generateBeaconPayload().metrics,
          jammed: false,
          score: calculateGatewayScore(gatewayC2Beacon.generateBeaconPayload().metrics)
        }
      },
      ranked,
      electedGatewayId: elected ? elected.gatewayId : null,
      dedupCacheSize: failoverManager.dedupCache.size(),
      offlineQueueSize: meshService.offlineQueue.size(),
      queueStats: {
        activeWorkers: workerQueue.activeWorkers,
        maxWorkers: workerQueue.maxWorkers,
        pending: workerQueue.getPendingCount(),
        totalProcessed: workerQueue.totalProcessed
      },
      cacheStats: queryCache.getStats(),
      apiQuotaHealthy
    }));
    return;
  }

  if (pathname === '/api/send-request' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const prompt = data.query || 'Emergency Procedure';
        const packetId = data.packetId || `PKT-${Date.now()}-${Math.floor(Math.random()*1000)}`;

        const cachedResponse = queryCache.get(prompt);
        let decision;
        let isHit = false;

        if (cachedResponse) {
          isHit = true;
          decision = decisionEngine.evaluateRouting({ prompt, isCacheHit: true });
        } else {
          const electedGw = pipeline.selectElectedGateway();
          const metrics = electedGw ? electedGw.metrics : { wanOnline: false, wanLatency: 5000, battery: 0 };
          metrics.apiQuotaHealthy = apiQuotaHealthy;
          decision = decisionEngine.evaluateRouting({ prompt, gatewayMetrics: metrics });
        }

        const queueTask = {
          id: packetId,
          priority: decision.priority,
          handler: async () => {
            if (isHit) {
              diagnosticsEngine.logAiRouting(prompt, '💎 15m MD5 Query Cache Hit', 'Cached Local', '0ms');
              activityManager.logActivity(ActivityType.AI_QUERY, prompt, '💎 15m MD5 Cache Hit');
              return { query: prompt, answer: cachedResponse.answer, source: 'QUERY_CACHE_HIT', decision };
            }

            const mockSendFn = async (targetGwId, pkt) => {
              if (targetGwId === 'Gateway-C1' && c1Jammed) {
                await new Promise(resolve => setTimeout(resolve, 3500));
                throw new Error('PRIMARY_GATEWAY_JAMMED_RF_TIMEOUT');
              }
              await new Promise(resolve => setTimeout(resolve, 200));

              let answerText = decision.target === 'CLOUD_GEMINI_2_0_FLASH'
                ? `[Cloud Gemini 2.0 Flash + Search Grounding] Verified emergency protocol for "${prompt}".`
                : `[Edge Local RAG Engine (Offline KB v12)] Offline triage guide for "${prompt}".`;

              const resObj = { query: prompt, processedBy: targetGwId, answer: answerText, timestamp: new Date().toISOString(), source: decision.target, decision };
              queryCache.set(prompt, resObj);

              const targetLabel = decision.target === 'CLOUD_GEMINI_2_0_FLASH' ? '☁️ Cloud Gemini 2.0' : '⚡ Edge Local RAG';
              diagnosticsEngine.logAiRouting(prompt, targetLabel, `Gateway ${targetGwId.includes('C1') ? 'C1' : 'C2'}`, `${diagnosticsEngine.latencyMs}ms`);
              activityManager.logActivity(ActivityType.AI_QUERY, prompt, `${targetLabel} via ${targetGwId}`);

              return resObj;
            };

            const packet = { packetId, senderId: 'Node-User-Alpha', payload: prompt };
            return await failoverManager.sendRequestWithFailover(packet, mockSendFn);
          }
        };

        const result = await workerQueue.enqueue(queueTask);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        diagnosticsEngine.logAiRouting(data.query || 'Prompt', '⚠️ Failed', 'Offline', '0ms');
        activityManager.logActivity(ActivityType.AI_QUERY, data.query || 'Prompt', '⚠️ Processing Failed');
        res.writeHead(422, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Static File Serving
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  const extname = String(path.extname(filePath)).toLowerCase();
  const contentType = MIME_TYPES[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 Not Found</h1>', 'utf-8');
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${error.code}`, 'utf-8');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

// Dynamic Port Binding (Cloud Hosting Compatible)
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`\n⚡ Emergency BLE Mesh AI Server running at http://${HOST}:${PORT}`);
  console.log(`⚡ Health Check available at http://${HOST}:${PORT}/health`);
});

// Graceful Shutdown Handlers
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received. Closing HTTP server and timers...');
  clearInterval(heartbeatInterval);
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received. Closing HTTP server and timers...');
  clearInterval(heartbeatInterval);
  server.close(() => process.exit(0));
});
