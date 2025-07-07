// Load environment variables first, before any other imports
import dotenv from 'dotenv';
dotenv.config();

import cors from 'cors';
import express, { Request, Response } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.js';
import coachingPointRoutes from './routes/coachingPoints.js';
import coachingPointEventRoutes from './routes/coachingPointEvents.js';
import coachingPointLabelRoutes from './routes/coachingPointLabels.js';
import coachingPointTaggedPlayerRoutes from './routes/coachingPointTaggedPlayers.js';
import gameRoutes from './routes/games.js';
import teamRoutes from './routes/teams.js';

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

// Health check
app.get('/health', (req: Request, res: Response) =>
{
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/coaching-points', coachingPointRoutes);
app.use('/api/coaching-point-events', coachingPointEventRoutes);
app.use('/api/coaching-point-labels', coachingPointLabelRoutes);
app.use('/api/coaching-point-tagged-players', coachingPointTaggedPlayerRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/teams', teamRoutes);

// Error handling
app.use(errorHandler);

// 404 handler
app.use('*', (req: Request, res: Response) =>
{
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, '0.0.0.0', () =>
{
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
});

export default app;
