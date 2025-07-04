import { Request, Response, Router } from 'express';
import { AuthenticatedRequest, authenticateUser } from '../middleware/auth.js';
import { supabase } from '../utils/supabase.js';

const router = Router();

// Sign up new user
router.post('/signup', async (req: Request, res: Response): Promise<void> =>
{
  try
  {
    const { email, password, name } = req.body;

    console.log('Signup request:', { email, name, hasPassword: !!password });

    if (!email || !password || !name)
    {
      console.log('Missing required fields:', { email: !!email, password: !!password, name: !!name });
      res.status(400).json({ error: 'Email, password, and name are required' });
      return;
    }

    // Create user in Supabase Auth using signUp instead of admin
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
      },
    });

    console.log('Supabase auth creation result:', {
      authData: !!authData?.user,
      authError: authError ?
        {
          message: authError.message,
          status: authError.status,
          code: authError.code,
        } :
        null,
    });

    if (authError)
    {
      console.error('Auth creation error:', authError);
      res.status(400).json({ error: authError.message });
      return;
    }

    if (!authData.user)
    {
      res.status(400).json({ error: 'Failed to create user' });
      return;
    }

    // The trigger should have automatically created the user record in public.users
    // Let's verify it exists and retrieve it
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    console.log('User database retrieval result:', {
      userData: !!userData,
      userError: userError ?
        {
          message: userError.message,
          code: userError.code,
          details: userError.details,
          hint: userError.hint,
        } :
        null,
    });

    if (userError)
    {
      console.error('User database retrieval error:', userError);
      // Clean up auth user if we can't find the user record
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
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user profile
router.get('/me', authenticateUser, async (req: AuthenticatedRequest, res: Response): Promise<void> =>
{
  try
  {
    const userId = req.user?.id;

    const { data: userData, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error)
    {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json(userData);
  }
  catch (error)
  {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
