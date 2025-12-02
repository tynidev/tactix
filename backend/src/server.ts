// Load environment variables first, before any other imports
import dotenv from 'dotenv';
dotenv.config();

import cors from 'cors';
import express, { Request, Response } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { errorHandler } from './middleware/errorHandler.js';
import { getSupabase } from './utils/supabase.js';
import analyticsRoutes from './routes/analytics.js';
import authRoutes from './routes/auth.js';
import coachingPointEventRoutes from './routes/coachingPointEvents.js';
import coachingPointLabelRoutes from './routes/coachingPointLabels.js';
import coachingPointRoutes from './routes/coachingPoints.js';
import coachingPointTaggedPlayerRoutes from './routes/coachingPointTaggedPlayers.js';
import coachingPointViewRoutes from './routes/coachingPointViews.js';
import gameRoutes from './routes/games.js';
import playerRoutes from './routes/players.js';
import teamRoutes from './routes/teams.js';
import testRoutes from './routes/test.js';
import veoRoutes from './routes/veo.js';

const app = express();
const PORT = Number(process.env.PORT) || 3001;

// Middleware
app.use(helmet());
app.use(morgan('combined'));

app.use(cors({
  origin: (origin, callback) =>
  {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    if (process.env.FRONTEND_URL === origin)
    {
      callback(null, true);
    }
    else
    {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check with optional database ping
app.get('/health', async (req: Request, res: Response) =>
{
  const checkDb = req.query.db === 'true';
  
  const response: any = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  };

  // Optional database check to keep Supabase active
  if (checkDb) {
    try {
      const supabase = getSupabase();
      
      // Simple query to keep connection active - just count teams
      const { data, error } = await supabase
        .from('teams')
        .select('id', { count: 'exact', head: true });
      
      if (error) throw error;
      
      response.database = {
        status: 'connected',
        recordCount: data || 0,
      };
    } catch (error) {
      console.error('Database health check failed:', error);
      response.database = {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
      return res.status(503).json(response);
    }
  }

  return res.json(response);
});

// Root route for platform health checks
app.get('/', (req: Request, res: Response) =>
{
  res.status(200).send('OK');
});
app.head('/', (req: Request, res: Response) =>
{
  res.status(200).end();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/coaching-points', coachingPointRoutes);
app.use('/api/coaching-point-events', coachingPointEventRoutes);
app.use('/api/coaching-point-labels', coachingPointLabelRoutes);
app.use('/api/coaching-point-tagged-players', coachingPointTaggedPlayerRoutes);
app.use('/api', coachingPointViewRoutes); // Mounted at /api since routes include full paths
app.use('/api/games', gameRoutes);
app.use('/api/players', playerRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/veo', veoRoutes);
app.use('/api/test', testRoutes);

// Error handling
app.use(errorHandler);

// 404 handler
app.use('*', (req: Request, res: Response) =>
{
  res.status(404).json({ error: 'Route not found' });
});

const server = app.listen(PORT, '0.0.0.0', () =>
{
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
});

// Graceful shutdown handling
process.on('SIGTERM', async () =>
{
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  const { closeBrowser } = await import('./utils/veoParser.js');
  await closeBrowser();
  server.close(() =>
  {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () =>
{
  console.log('🛑 SIGINT received, shutting down gracefully...');
  const { closeBrowser } = await import('./utils/veoParser.js');
  await closeBrowser();
  server.close(() =>
  {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

export default app;
