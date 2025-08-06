import React, { useEffect, useState } from 'react';
import { getApiUrl } from '../../utils/api';
import { Modal } from '../Modal';
import './PlayerProfileModal.css';

interface PlayerProfileModalProps
{
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentTeamId?: string;
}

interface Team
{
  id: string;
  name: string;
  role: string;
}

interface PlayerProfileFormData
{
  name: string;
  jerseyNumber: string;
  isGuardian: boolean;
  teamId: string;
}

export const PlayerProfileModal: React.FC<PlayerProfileModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  currentTeamId,
}) =>
{
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [teams, setTeams] = useState<Team[]>([]);

  const [formData, setFormData] = useState<PlayerProfileFormData>({
    name: '',
    jerseyNumber: '',
    isGuardian: false,
    teamId: currentTeamId || '',
  });

  useEffect(() =>
  {
    if (isOpen)
    {
      if (!currentTeamId)
      {
        fetchUserTeams();
      }
      // Reset form when modal opens
      setFormData({
        name: '',
        jerseyNumber: '',
        isGuardian: false,
        teamId: currentTeamId || '',
      });
      setError('');
      setSuccess('');
    }
  }, [isOpen, currentTeamId]);

  const fetchUserTeams = async () =>
  {
    try
    {
      const token = (await import('../../lib/supabase')).supabase.auth.getSession();
      const session = await token;

      if (!session.data.session?.access_token)
      {
        throw new Error('No access token');
      }

      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/teams`, {
        headers: {
          'Authorization': `Bearer ${session.data.session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok)
      {
        throw new Error('Failed to fetch teams');
      }

      const data = await response.json();
      const eligibleTeams = data.filter((team: any) => ['coach', 'admin', 'guardian'].includes(team.role));

      setTeams(eligibleTeams.map((team: any) => ({
        id: team.teams.id,
        name: team.teams.name,
        role: team.role,
      })));
    }
    catch (err)
    {
      setError('Failed to load teams');
      console.error('Error fetching teams:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) =>
  {
    e.preventDefault();
    if (!formData.name.trim())
    {
      setError('Player name is required');
      return;
    }

    if (!formData.teamId)
    {
      setError('Please select a team');
      return;
    }

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
      const response = await fetch(`${apiUrl}/api/teams/${formData.teamId}/player-profiles`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.data.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          jerseyNumber: formData.jerseyNumber.trim() || null,
          userRole: formData.isGuardian ? 'guardian' : 'staff',
        }),
      });

      if (!response.ok)
      {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create player profile');
      }

      const data = await response.json();
      setSuccess(data.message || 'Player profile created successfully');

      // Call onSuccess after a short delay to show success message
      setTimeout(() =>
      {
        onSuccess();
        handleClose();
      }, 1500);
    }
    catch (err)
    {
      setError(err instanceof Error ? err.message : 'Failed to create player profile');
    }
    finally
    {
      setLoading(false);
    }
  };

  const handleClose = () =>
  {
    setFormData({
      name: '',
      jerseyNumber: '',
      isGuardian: false,
      teamId: currentTeamId || '',
    });
    setError('');
    setSuccess('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title='Add Player Profile'
      size='md'
      className='player-profile-modal'
    >
      <form onSubmit={handleSubmit} className='form'>
        {error && <div className='alert alert-error'>{error}</div>}
        {success && <div className='alert alert-success'>{success}</div>}

        {!currentTeamId && (
          <div className='form-group'>
            <label className='form-label'>Team</label>
            <select
              value={formData.teamId}
              onChange={(e) => setFormData({ ...formData, teamId: e.target.value })}
              className='form-input'
              autoFocus
            >
              <option value=''>Select a team...</option>
              {teams.map(team => (
                <option key={team.id} value={team.id}>
                  {team.name} (as {team.role})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className='form-group'>
          <label className='form-label'>Player Name *</label>
          <input
            type='text'
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className='form-input'
            placeholder="Enter player's full name"
            autoFocus={!!currentTeamId}
          />
        </div>

        <div className='form-group'>
          <label className='form-label'>Jersey Number</label>
          <input
            type='text'
            value={formData.jerseyNumber}
            onChange={(e) => setFormData({ ...formData, jerseyNumber: e.target.value })}
            className='form-input'
            placeholder='Optional jersey number'
          />
          <div className='form-help'>
            Jersey numbers are optional and can be updated later.
          </div>
        </div>

        <div className='form-group'>
          <label className={`form-checkbox ${formData.isGuardian ? 'checked' : ''}`}>
            <input
              type='checkbox'
              checked={formData.isGuardian}
              onChange={(e) => setFormData({ ...formData, isGuardian: e.target.checked })}
            />
            <div className='checkbox-custom'></div>
            <div className='checkbox-content'>
              <span>I am this player's guardian</span>
              <div className='form-help'>
                Select this if you are the parent or legal guardian. This will link your account to the player's
                profile.
              </div>
            </div>
          </label>
        </div>

        {/* Action Buttons */}
        <div className='form-actions'>
          <button
            type='button'
            onClick={handleClose}
            className='btn btn-secondary'
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type='submit'
            className='btn btn-primary'
            disabled={loading || !formData.name.trim() || !formData.teamId}
          >
            {loading ? 'Creating...' : 'Create Profile'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default PlayerProfileModal;
