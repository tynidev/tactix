import { Request, Response, Router } from 'express';
import { AuthenticatedRequest, authenticateUser } from '../middleware/auth.js';
import { supabase, supabaseAuth } from '../utils/supabase.js';

const router = Router();

// Sign up new user
router.post('/signup', async (req: Request, res: Response): Promise<void> =>
{
  try
  {
    const { email, password, name } = req.body;

    if (!email || !password || !name)
    {
      res.status(400).json({ error: 'Email, password, and name are required' });
      return;
    }

    // Create user in Supabase Auth using signUp with anon key client
    console.log('Attempting signup for:', email);

    const { data: authData, error: authError } = await supabaseAuth.auth.signUp({
      email,
      password,
      options: {
        data: { name },
      },
    });

    if (authError)
    {
      console.error('Supabase Auth Error:', {
        message: authError.message,
        status: authError.status,
        name: authError.name,
        cause: authError.cause,
        stack: authError.stack,
      });
      res.status(400).json({ error: authError.message });
      return;
    }

    if (!authData.user)
    {
      res.status(400).json({ error: 'Failed to create user' });
      return;
    }

    // The trigger should have automatically created the user record in public.user_profiles
    // Let's verify it exists and retrieve it - use service role client for this
    const { data: userData, error: userError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (userError)
    {
      // Clean up auth user if we can't find the user record - use service role for admin operation
      await supabase.auth.admin.deleteUser(authData.user.id);
      res.status(400).json({ error: `Failed to retrieve user profile: ${userError.message}` });
      return;
    }

    res.status(201).json({
      message: 'User created successfully',
      user: userData,
    });
  }
  catch (error)
  {
    res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// Get current user profile
router.get('/me', authenticateUser, async (req: AuthenticatedRequest, res: Response): Promise<void> =>
{
  try
  {
    const userId = req.user?.id;

    if (!userId)
    {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { data: userData, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error)
    {
      res.status(404).json({
        error: 'User not found',
        details: {
          userId,
          message: error.message || String(error),
        },
      });
      return;
    }

    res.json(userData);
  }
  catch (error)
  {
    res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// Update user profile
router.put('/profile', authenticateUser, async (req: AuthenticatedRequest, res: Response): Promise<void> =>
{
  try
  {
    const userId = req.user?.id;
    const { name } = req.body;

    if (!userId)
    {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    if (!name || typeof name !== 'string' || !name.trim())
    {
      res.status(400).json({ error: 'Name is required and must be a valid string' });
      return;
    }

    const { data: userData, error } = await supabase
      .from('user_profiles')
      .update({ name: name.trim() })
      .eq('id', userId)
      .select()
      .single();

    if (error)
    {
      res.status(400).json({
        error: 'Failed to update profile',
        details: error.message || String(error),
      });
      return;
    }

    res.json({
      message: 'Profile updated successfully',
      user: userData,
    });
  }
  catch (error)
  {
    res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// Test Supabase connection
router.get('/test-connection', async (req: Request, res: Response): Promise<void> =>
{
  try
  {
    // Test if we can reach Supabase
    const { data, error } = await supabase.from('user_profiles').select('count').limit(1);

    if (error)
    {
      res.status(500).json({
        error: 'Supabase connection failed',
        details: error.message,
        supabaseUrl: process.env.SUPABASE_URL,
      });
      return;
    }

    res.json({
      message: 'Supabase connection successful',
      supabaseUrl: process.env.SUPABASE_URL,
    });
  }
  catch (error)
  {
    res.status(500).json({
      error: 'Connection test failed',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// Test Supabase Auth connection
router.get('/test-auth', async (req: Request, res: Response): Promise<void> =>
{
  try
  {
    // Try to get the current session (should be null if not logged in)
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error)
    {
      res.status(500).json({
        error: 'Supabase Auth test failed',
        details: error.message,
        errorObject: error,
      });
      return;
    }

    res.json({
      message: 'Supabase Auth connection successful',
      hasSession: !!session,
      supabaseUrl: process.env.SUPABASE_URL,
    });
  }
  catch (error)
  {
    res.status(500).json({
      error: 'Auth test failed',
      details: error instanceof Error ? error.message : String(error),
      errorType: error?.constructor?.name,
    });
  }
});

export default router;
