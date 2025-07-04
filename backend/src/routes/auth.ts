import { Router } from 'express';
import { AuthenticatedRequest, authenticateUser } from '../middleware/auth.js';
import { supabase } from '../utils/supabase.js';

const router = Router();

// Sign up new user
router.post('/signup', async (req, res) =>
{
  try
  {
    const { email, password, name } = req.body;

    console.log('Signup request:', { email, name, hasPassword: !!password });

    if (!email || !password || !name)
    {
      console.log('Missing required fields:', { email: !!email, password: !!password, name: !!name });
      return res.status(400).json({ error: 'Email, password, and name are required' });
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
      return res.status(400).json({ error: authError.message });
    }

    if (!authData.user)
    {
      return res.status(400).json({ error: 'Failed to create user' });
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
      return res.status(400).json({ error: `Failed to retrieve user profile: ${userError.message}` });
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

// Sign up with team join code
router.post('/signup/:teamJoinCode', async (req, res) =>
{
  try
  {
    const { teamJoinCode } = req.params;
    const { email, password, name } = req.body;

    if (!email || !password || !name)
    {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    // TODO: Implement team join code logic
    // For now, just create user as coach
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError)
    {
      return res.status(400).json({ error: authError.message });
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        email,
        name,
      })
      .select()
      .single();

    if (userError)
    {
      await supabase.auth.admin.deleteUser(authData.user.id);
      return res.status(400).json({ error: 'Failed to create user profile' });
    }

    res.status(201).json({
      message: 'User created and joined team successfully',
      user: userData,
      teamJoinCode,
    });
  }
  catch (error)
  {
    console.error('Signup with team error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user profile
router.get('/me', authenticateUser, async (req: AuthenticatedRequest, res) =>
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
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(userData);
  }
  catch (error)
  {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Development endpoint to clean up test users (remove in production)
router.delete('/cleanup/:email', async (req, res) =>
{
  try
  {
    const { email } = req.params;

    console.log('Cleanup request for email:', email);

    // List all users to find the one with this email
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();

    if (listError)
    {
      console.error('Error listing users:', listError);
      return res.status(400).json({ error: 'Failed to list users' });
    }

    const userToDelete = users.find(user => user.email === email);

    if (userToDelete)
    {
      // Delete from auth
      const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(userToDelete.id);

      if (deleteAuthError)
      {
        console.error('Error deleting auth user:', deleteAuthError);
        return res.status(400).json({ error: 'Failed to delete auth user' });
      }

      // Delete from users table
      const { error: deleteUserError } = await supabase
        .from('users')
        .delete()
        .eq('id', userToDelete.id);

      if (deleteUserError)
      {
        console.error('Error deleting user record:', deleteUserError);
      }

      res.json({ message: 'User cleaned up successfully', userId: userToDelete.id });
    }
    else
    {
      res.json({ message: 'No user found with that email' });
    }
  }
  catch (error)
  {
    console.error('Cleanup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
