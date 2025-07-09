import React, { useState } from 'react';
import { Modal } from '../Modal';
import { getApiUrl } from '../../utils/api';
import './JoinTeamModal.css';

interface JoinTeamModalProps
{
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface TeamValidationData
{
  team_name: string;
  team_role: string;
  team_id: string;
}

export const JoinTeamModal: React.FC<JoinTeamModalProps> = ({ isOpen, onClose, onSuccess }) =>
{
  const [joinCode, setJoinCode] = useState('');
  const [validatedTeam, setValidatedTeam] = useState<TeamValidationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleValidateCode = async () =>
  {
    if (!joinCode.trim())
    {
      setError('Please enter a join code');
      return;
    }

    setLoading(true);
    setError('');

    try
    {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/teams/join-codes/${joinCode.trim()}/validate`);

      if (!response.ok)
      {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Invalid join code');
      }

      const data = await response.json();
      setValidatedTeam(data);
    }
    catch (err)
    {
      setError(err instanceof Error ? err.message : 'Failed to validate join code');
    }
    finally
    {
      setLoading(false);
    }
  };

  const handleJoinTeam = async () =>
  {
    if (!validatedTeam) return;

    setLoading(true);
    setError('');

    try
    {
      const token = (await import('../../lib/supabase')).supabase.auth.getSession();
      const session = await token;

      if (!session.data.session?.access_token)
      {
        throw new Error('No access token');
      }

      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/teams/join`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.data.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          joinCode: joinCode.trim(),
        }),
      });

      if (!response.ok)
      {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to join team');
      }

      const data = await response.json();
      setSuccess(data.message);

      // Call onSuccess after a short delay to show success message
      setTimeout(() =>
      {
        onSuccess();
        handleClose();
      }, 1500);
    }
    catch (err)
    {
      setError(err instanceof Error ? err.message : 'Failed to join team');
    }
    finally
    {
      setLoading(false);
    }
  };

  const handleClose = () =>
  {
    setJoinCode('');
    setValidatedTeam(null);
    setError('');
    setSuccess('');
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) =>
  {
    if (e.key === 'Enter')
    {
      if (validatedTeam)
      {
        handleJoinTeam();
      }
      else
      {
        handleValidateCode();
      }
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Join Team"
      size="sm"
      className="join-team-modal"
    >
      <div className='form'>
          {error && <div className='alert alert-error'>{error}</div>}
          {success && <div className='alert alert-success'>{success}</div>}

          {!validatedTeam ?
            (
              // Step 1: Enter join code
              <>
                <div className='form-group'>
                  <label className='form-label'>Join Code</label>
                  <input
                    type='text'
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    className='form-input'
                    placeholder='Enter 4-character join code'
                    maxLength={4}
                    onKeyDown={handleKeyDown}
                    autoFocus
                    disabled={loading}
                  />
                  <div className='form-help'>
                    Enter the 4-character join code provided by your team coach or admin.
                  </div>
                </div>

                <div className='form-actions'>
                  <button
                    onClick={handleClose}
                    className='btn btn-secondary'
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleValidateCode}
                    className='btn btn-primary'
                    disabled={loading || !joinCode.trim()}
                  >
                    {loading ? 'Validating...' : 'Validate Code'}
                  </button>
                </div>
              </>
            ) :
            (
              // Step 2: Confirm team join
              <>
                <div className='team-info'>
                  <h3>Team Information</h3>
                  <div className='team-details'>
                    <p>
                      <strong>Team Name:</strong> {validatedTeam.team_name}
                    </p>
                    <p>
                      <strong>You will join as:</strong> <span className='role-badge'>{validatedTeam.team_role}</span>
                    </p>
                  </div>
                </div>

                <div className='form-actions'>
                  <button
                    onClick={() =>
                    {
                      setValidatedTeam(null);
                      setError('');
                    }}
                    className='btn btn-secondary'
                    disabled={loading}
                  >
                    Back
                  </button>
                  <button
                    onClick={handleJoinTeam}
                    className='btn btn-success'
                    disabled={loading}
                  >
                    {loading ? 'Joining...' : 'Join Team'}
                  </button>
                </div>
              </>
            )}
      </div>
    </Modal>
  );
};

export default JoinTeamModal;
