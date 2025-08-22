import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getApiUrl } from '../../utils/api';
import ThemeToggle from '../ThemeToggle/ThemeToggle';

export const Auth: React.FC = () =>
{
  const { signIn, signUp, user, session, loading: authLoading } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Team code related state
  const [teamCode, setTeamCode] = useState<string | null>(null);
  const [teamInfo, setTeamInfo] = useState<{ name: string; role: string; } | null>(null);
  const [teamJoinStatus, setTeamJoinStatus] = useState<'pending' | 'success' | 'error' | null>(null);
  const [teamJoinError, setTeamJoinError] = useState<string>('');
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // If still loading auth state, show loading
  if (authLoading)
  {
    return (
      <div className='auth-container'>
        <div className='auth-card'>
          <div style={{ textAlign: 'center', padding: 'var(--space-lg)' }}>
            <div>Loading...</div>
          </div>
        </div>
      </div>
    );
  }

  // If user is authenticated, redirect to root with query params
  // We trust Supabase to handle token refresh automatically
  if (user && session)
  {
    const currentSearch = window.location.search;
    navigate(`/${currentSearch}`);
    return null;
  }

  // Function to validate team code and get team info
  const validateTeamCode = async (code: string) =>
  {
    try
    {
      const apiUrl = getApiUrl();

      const response = await fetch(`${apiUrl}/api/teams/join-codes/${code}/validate`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok)
      {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Invalid or expired team code');
      }

      const data = await response.json();

      return {
        name: data.team_name,
        role: data.team_role || 'guardian', // Default to guardian if no role specified
      };
    }
    catch (error)
    {
      return null;
    }
  };

  // Check for team code in URL on component mount
  useEffect(() =>
  {
    const code = searchParams.get('teamCode');
    const verified = searchParams.get('verified');

    // Handle verified parameter (email verification success)
    if (verified === 'true')
    {
      setSuccessMessage('Email verified successfully! Please sign in to continue.');
    }

    if (code)
    {
      setTeamCode(code);
      validateTeamCode(code).then(info =>
      {
        if (info)
        {
          setTeamInfo(info);
        }
        else
        {
          setError('Invalid or expired team invitation code');
        }
      }).catch(error =>
      {
        setError('Failed to validate team invitation code: ' + error);
      });

      // Clear the team code from URL
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('teamCode');
      newParams.delete('verified');
      setSearchParams(newParams, { replace: true });
    }
    else if (verified === 'true')
    {
      // Clear verified parameter if no team code
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('verified');
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleSubmit = async (e: React.FormEvent) =>
  {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');
    setTeamJoinStatus(null);
    setTeamJoinError('');

    try
    {
      if (isLogin)
      {
        const result = await signIn(email, password);
        if (result.error)
        {
          setError(result.error);
        }
        else
        {
          // Sign in successful - check if we need to join a team
          if (teamCode && teamInfo)
          {
            // Navigate to games with join code
            navigate(`/games?teamCode=${teamCode}`);
          }
          else
          {
            // Normal login without team code - navigate to games
            navigate('/games');
          }
        }
      }
      else
      {
        if (!name.trim())
        {
          setError('Name is required');
          setLoading(false);
          return;
        }

        const result = await signUp(email, password, name, teamCode || undefined);
        if (result.error)
        {
          setError(result.error);
        }
        else
        {
          // Authentication successful
          setSuccessMessage('Account created successfully! Check your email for verification.');

          // Clear the form
          setEmail('');
          setPassword('');
          setName('');
        }
      }
    }
    catch (err)
    {
      setError('An unexpected error occurred');
    }
    finally
    {
      setLoading(false);
    }
  };

  return (
    <div className='auth-container'>
      <div className='auth-theme-toggle'>
        <ThemeToggle />
      </div>
      <div className='auth-card'>
        <div className='auth-header'>
          <img src='/tactix-logo.png' alt='TACTIX' style={{ height: '120px' }} />
          <p>Video Coaching Platform</p>
        </div>

        {teamInfo && (
          <div className='alert alert-info' style={{ marginBottom: 'var(--space-md)' }}>
            <h3 style={{ margin: '0 0 var(--space-sm) 0', fontSize: '1.1rem' }}>Team Invitation</h3>
            <p style={{ margin: 0 }}>
              You're being invited to join <strong>{teamInfo.name}</strong> as a <strong>{teamInfo.role}</strong>.
            </p>
            <p style={{ margin: 'var(--space-sm) 0 0 0', fontSize: '0.9rem' }}>
              {isLogin ? 'Sign in' : 'Sign up'} to accept this invitation.
            </p>
          </div>
        )}

        <div className='auth-tabs'>
          <button
            type='button'
            className={`auth-tab ${isLogin ? 'active' : ''}`}
            onClick={() =>
            {
              setIsLogin(true);
              setError('');
              setSuccessMessage('');
            }}
          >
            Sign In
          </button>
          <button
            type='button'
            className={`auth-tab ${!isLogin ? 'active' : ''}`}
            onClick={() =>
            {
              setIsLogin(false);
              setError('');
              setSuccessMessage('');
            }}
          >
            Sign Up
          </button>
        </div>

        {error && <div className='alert alert-error'>{error}</div>}
        {successMessage && <div className='alert alert-success'>{successMessage}</div>}
        {teamJoinStatus === 'error' && (
          <div className='alert alert-error'>
            Account {isLogin ? 'signed in' : 'created'} successfully, but failed to join team: {teamJoinError}
            <br />
            <small>Please try signing in again with the original link.</small>
          </div>
        )}

        <form onSubmit={handleSubmit} className='auth-form'>
          {!isLogin && (
            <div className='form-group'>
              <label htmlFor='name' className='form-label'>Full Name</label>
              <input
                type='text'
                id='name'
                value={name}
                onChange={(e) => setName(e.target.value)}
                required={!isLogin}
                placeholder='Enter your full name'
                className='form-input'
              />
            </div>
          )}

          <div className='form-group'>
            <label htmlFor='email' className='form-label'>Email</label>
            <input
              type='email'
              id='email'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder='Enter your email'
              className='form-input'
            />
          </div>

          <div className='form-group'>
            <label htmlFor='password' className='form-label'>Password</label>
            <input
              type='password'
              id='password'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder='Enter your password'
              minLength={6}
              className='form-input'
            />
          </div>

          <button
            type='submit'
            className='btn btn-primary btn-full'
            disabled={loading}
          >
            {loading ?
              'Loading...' :
              teamCode ?
              `${isLogin ? 'Sign In' : 'Sign Up'} & Join Team` :
              isLogin ?
              'Sign In' :
              'Sign Up'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 'var(--space-lg)' }}>
          <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <button
              type='button'
              className='btn btn-link'
              onClick={() => setIsLogin(!isLogin)}
            >
              {isLogin ? 'Sign Up' : 'Sign In'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
