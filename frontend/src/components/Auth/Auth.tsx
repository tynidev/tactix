import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getApiUrl } from '../../utils/api';
import ThemeToggle from '../ThemeToggle/ThemeToggle';

interface AuthProps
{
  redirectUrl?: string;
}

export const Auth: React.FC<AuthProps> = ({ redirectUrl }) =>
{
  const { signIn, signUp, resetPassword, updatePassword, user, session, loading: authLoading } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Forgot password state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);

  // Password reset state
  const [isPasswordReset, setIsPasswordReset] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordResetLoading, setPasswordResetLoading] = useState(false);

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

  // Check for password reset mode first - this needs to happen before redirect logic
  const mode = searchParams.get('mode');
  const isInPasswordResetMode = mode === 'password-reset';

  // If user is authenticated AND not in password reset mode (check URL param OR component state), redirect to intended destination
  // We trust Supabase to handle token refresh automatically
  if (user && session && !isInPasswordResetMode && !isPasswordReset)
  {
    if (redirectUrl)
    {
      navigate(redirectUrl);
    }
    else
    {
      // Check if we have a teamCode to preserve
      const teamCodeParam = searchParams.get('teamCode');

      if (teamCodeParam)
      {
        const currentSearch = window.location.search;
        navigate(`/${currentSearch}`);
      }
      else
      {
        navigate('/games');
      }
    }
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

  // Check for team code and password reset mode in URL on component mount
  useEffect(() =>
  {
    const code = searchParams.get('teamCode');
    const verified = searchParams.get('verified');
    const mode = searchParams.get('mode');

    // Handle password reset mode
    if (mode === 'password-reset')
    {
      setIsPasswordReset(true);
      setSuccessMessage('Please enter your new password below.');

      // Clear the mode parameter
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('mode');
      setSearchParams(newParams, { replace: true });
      return;
    }

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
          else if (redirectUrl)
          {
            // Redirect to the intended destination
            navigate(redirectUrl);
          }
          else
          {
            // Default: navigate to games
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

  const handleForgotPasswordSubmit = async (e: React.FormEvent) =>
  {
    e.preventDefault();
    setForgotPasswordLoading(true);
    setError('');
    setSuccessMessage('');

    try
    {
      const result = await resetPassword(forgotPasswordEmail);
      if (result.error)
      {
        setError(result.error);
      }
      else
      {
        setSuccessMessage('Password reset email sent! Check your inbox and follow the instructions.');
        setShowForgotPassword(false);
        setForgotPasswordEmail('');
      }
    }
    catch (err)
    {
      setError('An unexpected error occurred');
    }
    finally
    {
      setForgotPasswordLoading(false);
    }
  };

  const handlePasswordResetSubmit = async (e: React.FormEvent) =>
  {
    e.preventDefault();
    setPasswordResetLoading(true);
    setError('');
    setSuccessMessage('');

    if (newPassword !== confirmPassword)
    {
      setError('Passwords do not match');
      setPasswordResetLoading(false);
      return;
    }

    if (newPassword.length < 6)
    {
      setError('Password must be at least 6 characters long');
      setPasswordResetLoading(false);
      return;
    }

    try
    {
      const result = await updatePassword(newPassword);
      if (result.error)
      {
        setError(result.error);
      }
      else
      {
        setSuccessMessage('Password updated successfully! You can now sign in with your new password.');
        setIsPasswordReset(false);
        setNewPassword('');
        setConfirmPassword('');
        // Switch back to sign in form
        setIsLogin(true);
      }
    }
    catch (err)
    {
      setError('An unexpected error occurred');
    }
    finally
    {
      setPasswordResetLoading(false);
    }
  };

  // Render password reset form if in password reset mode
  if (isPasswordReset)
  {
    return (
      <div className='auth-container'>
        <div className='auth-theme-toggle'>
          <ThemeToggle />
        </div>
        <div className='auth-card'>
          <div className='auth-header'>
            <img src='/tactix-logo.png' alt='TACTIX' style={{ height: '120px' }} />
            <p>Reset Your Password</p>
          </div>

          {error && <div className='alert alert-error'>{error}</div>}
          {successMessage && <div className='alert alert-success'>{successMessage}</div>}

          <form onSubmit={handlePasswordResetSubmit} className='auth-form'>
            <div className='form-group'>
              <label htmlFor='newPassword' className='form-label'>New Password</label>
              <input
                type='password'
                id='newPassword'
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                placeholder='Enter your new password'
                minLength={6}
                className='form-input'
              />
            </div>

            <div className='form-group'>
              <label htmlFor='confirmPassword' className='form-label'>Confirm New Password</label>
              <input
                type='password'
                id='confirmPassword'
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder='Confirm your new password'
                minLength={6}
                className='form-input'
              />
            </div>

            <button
              type='submit'
              className='btn btn-primary btn-full'
              disabled={passwordResetLoading}
            >
              {passwordResetLoading ? 'Updating Password...' : 'Update Password'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: 'var(--space-lg)' }}>
            <button
              type='button'
              className='btn btn-link'
              onClick={() => setIsPasswordReset(false)}
            >
              Back to Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

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

        {isLogin && (
          <div style={{ textAlign: 'center', marginTop: 'var(--space-md)' }}>
            <button
              type='button'
              className='btn btn-link'
              onClick={() => setShowForgotPassword(true)}
              style={{ fontSize: '14px' }}
            >
              Forgot your password?
            </button>
          </div>
        )}

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

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div
          className='auth-container'
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div className='auth-card' style={{ width: '90%', maxWidth: '400px', margin: 0 }}>
            <div className='auth-header'>
              <h3 style={{ margin: 0, fontSize: '24px', fontWeight: '700' }}>Reset Password</h3>
              <p style={{ margin: 'var(--space-sm) 0 0 0', fontSize: '14px' }}>
                Enter your email address and we'll send you a link to reset your password.
              </p>
            </div>

            {error && <div className='alert alert-error'>{error}</div>}
            {successMessage && <div className='alert alert-success'>{successMessage}</div>}

            <form onSubmit={handleForgotPasswordSubmit} className='auth-form'>
              <div className='form-group'>
                <label htmlFor='forgotPasswordEmail' className='form-label'>Email</label>
                <input
                  type='email'
                  id='forgotPasswordEmail'
                  value={forgotPasswordEmail}
                  onChange={(e) => setForgotPasswordEmail(e.target.value)}
                  required
                  placeholder='Enter your email'
                  className='form-input'
                />
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                <button
                  type='button'
                  className='btn btn-secondary'
                  onClick={() =>
                  {
                    setShowForgotPassword(false);
                    setForgotPasswordEmail('');
                    setError('');
                    setSuccessMessage('');
                  }}
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  type='submit'
                  className='btn btn-primary'
                  disabled={forgotPasswordLoading}
                  style={{ flex: 1 }}
                >
                  {forgotPasswordLoading ? 'Sending...' : 'Send Reset Email'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
