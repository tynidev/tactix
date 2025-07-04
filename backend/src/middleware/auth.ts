import { NextFunction, Request, Response } from 'express';
import { supabaseAuth } from '../utils/supabase.js';

export interface AuthenticatedRequest extends Request
{
  user?: {
    id: string;
    email: string;
  };
}

export const authenticateUser = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) =>
{
  try
  {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer '))
    {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.split(' ')[1];

    // Verify the JWT token with Supabase
    const { data: { user }, error } = await supabaseAuth.auth.getUser(token);

    if (error || !user)
    {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Add user info to request
    req.user = {
      id: user.id,
      email: user.email || '',
    };

    next();
  }
  catch (error)
  {
    console.error('Auth middleware error:', error);
    return res.status(401).json({ error: 'Authentication failed' });
  }
};
