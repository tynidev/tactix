import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getApiUrl } from '../../utils/api';
import ThemeToggle from '../ThemeToggle/ThemeToggle';

export const Auth: React.FC = () =>
{
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

  const { signIn, signUp } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Function to validate team code and get team info
  const validateTeamCode = async (code: string) =>
  {
    try
    {
      const apiUrl = getApiUrl();
      console.log('Validating team code:', code, 'API URL:', apiUrl);

      const response = await fetch(`${apiUrl}/api/teams/join-codes/${code}/validate`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('Validation response status:', response.status);
      console.log('Validation response ok:', response.ok);

      if (!response.ok)
      {
        const errorData = await response.json().catch(() => ({}));
        console.error('Validation error response:', errorData);
        throw new Error(errorData.error || 'Invalid or expired team code');
      }

      const data = await response.json();
      console.log('Validation success data:', data);

      return {
        name: data.team_name,
        role: data.team_role || 'guardian', // Default to guardian if no role specified
      };
    }
    catch (error)
    {
      console.error('Team code validation error:', error);
      return null;
    }
  };

  // Function to join team with code
  const joinTeamWithCode = async (code: string) =>
  {
    try
    {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/teams/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ joinCode: code }),
      });

      const data = await response.json();

      if (!response.ok)
      {
        // Handle "already a member" case gracefully
        if (data.error?.includes('already a member'))
        {
          setTeamJoinStatus('success');
          setSuccessMessage(`Welcome back! You're already a member of ${teamInfo?.name}.`);
          return true;
        }
        throw new Error(data.error || 'Failed to join team');
      }

      setTeamJoinStatus('success');
      setSuccessMessage(`Successfully joined ${data.team.name} as ${data.team.role}!`);
      return true;
    }
    catch (error)
    {
      console.error('Team join error:', error);
      setTeamJoinStatus('error');
      setTeamJoinError(error instanceof Error ? error.message : 'Failed to join team');
      return false;
    }
  };

  // Check for team code in URL on component mount
  useEffect(() =>
  {
    const code = searchParams.get('teamCode');
    if (code)
    {
      console.log('Team code found in URL:', code);
      setTeamCode(code);
      validateTeamCode(code).then(info =>
      {
        console.log('Team validation result:', info);
        if (info)
        {
          console.log('Setting team info:', info);
          setTeamInfo(info);
        }
        else
        {
          console.log('Team validation failed, setting error');
          setError('Invalid or expired team invitation code');
        }
      }).catch(error =>
      {
        console.error('Team validation promise error:', error);
        setError('Failed to validate team invitation code');
      });

      // Clear the team code from URL
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('teamCode');
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
      let result;
      if (isLogin)
      {
        result = await signIn(email, password);
      }
      else
      {
        if (!name.trim())
        {
          setError('Name is required');
          setLoading(false);
          return;
        }
        result = await signUp(email, password, name);
      }

      if (result.error)
      {
        setError(result.error);
      }
      else
      {
        // Authentication successful
        if (!isLogin)
        {
          setSuccessMessage('Account created successfully! Check your email for verification.');
          // Clear the form
          setEmail('');
          setPassword('');
          setName('');
        }

        // If we have a team code, attempt to join the team
        if (teamCode && teamInfo)
        {
          const joinSuccess = await joinTeamWithCode(teamCode);
          if (joinSuccess)
          {
            // Navigate to dashboard after successful team join
            setTimeout(() =>
            {
              navigate('/dashboard');
            }, 2000);
          }
        }
        else if (isLogin)
        {
          // Normal login without team code - navigate to dashboard
          setTimeout(() =>
          {
            navigate('/dashboard');
          }, 1000);
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
          <h1>TACTIX</h1>
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
