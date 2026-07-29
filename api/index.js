/**
 * Vercel Serverless API Dispatcher
 */
import { SoundChannelEngine } from '../src/mesh/sound_channel.js';
import { ChannelHandoverManager } from '../src/mesh/channel_handover.js';
import { RecentActivityManager } from '../src/activity/recent_activity.js';

const soundEngine = new SoundChannelEngine();
const handoverManager = new ChannelHandoverManager({ soundEngine });
const activityManager = new RecentActivityManager();

export default async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  if (pathname.includes('/sound/status')) {
    return res.status(200).json(handoverManager.getChannelSummary());
  }

  if (pathname.includes('/activity/list')) {
    return res.status(200).json({
      count: activityManager.getActivities().length,
      activities: activityManager.getActivities()
    });
  }

  return res.status(200).json({
    status: 'HEALTHY',
    system: 'Emergency BLE Mesh AI System',
    platform: 'Vercel Serverless Production'
  });
}
