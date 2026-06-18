import { Router } from 'express';

const router = Router();

/**
 * Health Check Endpoint
 * GET /api/v1/health
 * Used by cloud load balancers, ping checkers, and client apps to check 
 * whether the backend is up and running.
 */
router.get('/', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    api: 'v1',
  });
});

export default router;
