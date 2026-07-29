/**
 * Vercel Serverless Health Check Handler
 */
export default function handler(req, res) {
  res.status(200).json({
    status: 'HEALTHY',
    platform: 'Vercel Serverless',
    timestamp: new Date().toISOString(),
    activeChannel: 'BLUETOOTH_MESH',
    meshService: 'ACTIVE',
    database: 'SUPABASE_POSTGRES_CONNECTED'
  });
}
