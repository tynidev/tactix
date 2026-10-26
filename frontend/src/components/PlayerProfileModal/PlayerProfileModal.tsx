import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../utils/api';
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

interface TeamMembership
{
  role: string;
  teams: { id: string; name: string; };
}

interface LinkedPlayer
{
  id: string;
  name: string;
  relationship_type: 'guardian' | 'owner';
}

interface PlayerProfileFormData
{
  name: string;
  jerseyNumber: string;
  isGuardian: boolean;
  teamId: string;
  playerId: string;
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
  const [playerMode, setPlayerMode] = useState<'new' | 'existing'>('new');
  const [existingPlayers, setExistingPlayers] = useState<LinkedPlayer[]>([]);
  const [playersLoading, setPlayersLoading] = useState(false);
  const [playersError, setPlayersError] = useState('');
  const [playersRetry, setPlayersRetry] = useState(0);
  const [formData, setFormData] = useState<PlayerProfileFormData>({
    name: '',
    jerseyNumber: '',
    isGuardian: false,
    teamId: currentTeamId || '',
    playerId: '',
  });

  useEffect(() =>
  {
    if (isOpen)
    {
      setFormData({
        name: '',
        jerseyNumber: '',
        isGuardian: false,
        teamId: currentTeamId || '',
        playerId: '',
      });
      setPlayerMode('new');
      setExistingPlayers([]);
      setPlayersError('');
      setError('');
      setSuccess('');
    }
  }, [isOpen, currentTeamId]);

  useEffect(() =>
  {
    if (!isOpen || currentTeamId) return;
    const controller = new AbortController();
    const fetchUserTeams = async () =>
    {
      try
      {
        const response = await apiRequest('/api/teams', { signal: controller.signal });
        if (!response.ok)
        {
          throw new Error('Failed to fetch teams');
        }

        const data: TeamMembership[] = await response.json();
        if (controller.signal.aborted) return;
        setTeams(
          data
            .filter(team => ['coach', 'admin', 'guardian'].includes(team.role))
            .map(team => ({
              id: team.teams.id,
              name: team.teams.name,
              role: team.role,
            })),
        );
      }
      catch (err)
      {
        if (controller.signal.aborted) return;
        setError('Failed to load teams');
        console.error('Error fetching teams:', err);
      }
    };
    fetchUserTeams();
    return () => controller.abort();
  }, [isOpen, currentTeamId]);

  useEffect(() =>
  {
    if (!isOpen || playerMode !== 'existing' || !formData.teamId) return;
    const controller = new AbortController();
    const fetchExistingPlayers = async () =>
    {
      setPlayersLoading(true);
      setPlayersError('');
      setExistingPlayers([]);

      try
      {
        const responses = await Promise.all([
          apiRequest('/api/auth/guardian-players', { signal: controller.signal }),
          apiRequest(`/api/teams/${formData.teamId}/players`, { signal: controller.signal }),
        ]);
        for (const response of responses)
        {
          if (!response.ok)
          {
            const data = await response.json();
            throw new Error(data.error || 'Failed to load existing children');
          }
        }

        const linkedPlayers: LinkedPlayer[] = await responses[0].json();
        const teamPlayers: Array<{ id: string; }> = await responses[1].json();
        if (controller.signal.aborted) return;
        const teamPlayerIds = new Set(teamPlayers.map(player => player.id));
        setExistingPlayers(
          linkedPlayers.filter(player => player.relationship_type === 'guardian' && !teamPlayerIds.has(player.id)),
        );
      }
      catch (err)
      {
        if (controller.signal.aborted) return;
        setPlayersError(err instanceof Error ? err.message : 'Failed to load existing children');
      }
      finally
      {
        if (!controller.signal.aborted) setPlayersLoading(false);
      }
    };
    fetchExistingPlayers();
    return () => controller.abort();
  }, [isOpen, playerMode, formData.teamId, playersRetry]);

  useEffect(() =>
  {
    if (!isOpen || !success) return;
    const timeoutId = setTimeout(() =>
    {
      onSuccess();
      onClose();
    }, 1500);
    return () => clearTimeout(timeoutId);
  }, [isOpen, success, onSuccess, onClose]);

  const handleSubmit = async (e: React.FormEvent) =>
  {
    e.preventDefault();
    if (playerMode === 'new' && !formData.name.trim())
    {
      setError('Player name is required');
      return;
    }

    if (!formData.teamId)
    {
      setError('Please select a team');
      return;
    }

    if (playerMode === 'existing' && !existingPlayers.some(player => player.id === formData.playerId))
    {
      setError('Please select an existing child');
      return;
    }

    setLoading(true);
    setError('');

    try
    {
      const isExisting = playerMode === 'existing';
      const endpoint = isExisting ? 'players' : 'player-profiles';
      const response = await apiRequest(`/api/teams/${formData.teamId}/${endpoint}`, {
        method: 'POST',
        body: JSON.stringify(
          isExisting ?
            {
              playerId: formData.playerId,
              jerseyNumber: formData.jerseyNumber.trim() || null,
            } :
            {
              name: formData.name.trim(),
              jerseyNumber: formData.jerseyNumber.trim() || null,
              userRole: formData.isGuardian ? 'guardian' : 'staff',
            },
        ),
      });

      if (!response.ok)
      {
        const errorData = await response.json();
        throw new Error(
          errorData.error || (isExisting ? 'Failed to add child to team' : 'Failed to create player profile'),
        );
      }

      const data = await response.json();
      setSuccess(
        data.message || (isExisting ? 'Child added to team successfully' : 'Player profile created successfully'),
      );
    }
    catch (err)
    {
      setError(err instanceof Error ? err.message : 'Failed to save player');
    }
    finally
    {
      setLoading(false);
    }
  };

  const handleClose = () =>
  {
    setError('');
    setSuccess('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title='Add Player'
      size='md'
      className='player-profile-modal'
    >
      <form onSubmit={handleSubmit} className='form'>
        {error && <div className='alert alert-error' role='alert'>{error}</div>}
        {success && <div className='alert alert-success' role='status'>{success}</div>}

        {!currentTeamId && (
          <div className='form-group'>
            <label htmlFor='player-profile-team' className='form-label'>Team</label>
            <select
              id='player-profile-team'
              value={formData.teamId}
              onChange={(e) =>
              {
                setFormData({ ...formData, teamId: e.target.value, playerId: '' });
                setError('');
              }}
              className='form-input'
              autoFocus
              disabled={loading || !!success}
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
          <label htmlFor='player-profile-mode' className='form-label'>Player Profile</label>
          <select
            id='player-profile-mode'
            value={playerMode}
            onChange={(e) =>
            {
              setPlayerMode(e.target.value === 'existing' ? 'existing' : 'new');
              setFormData({ ...formData, playerId: '', jerseyNumber: '' });
              setError('');
            }}
            className='form-input'
            disabled={loading || !!success}
          >
            <option value='new'>Create new player</option>
            <option value='existing'>Add existing child</option>
          </select>
        </div>

        {playerMode === 'existing' ?
          (
            <div className='form-group'>
              <label htmlFor='player-profile-child' className='form-label'>Your Child *</label>
              <select
                id='player-profile-child'
                value={formData.playerId}
                onChange={(e) =>
                {
                  setFormData({ ...formData, playerId: e.target.value });
                  setError('');
                }}
                className='form-input'
                disabled={loading || !!success || playersLoading || !!playersError || !formData.teamId}
              >
                <option value=''>{playersLoading ? 'Loading children...' : 'Select your child...'}</option>
                {existingPlayers.map(player => <option key={player.id} value={player.id}>{player.name}</option>)}
              </select>
              {playersError ?
                (
                  <div className='alert alert-error' role='alert'>
                    {playersError}{' '}
                    <button
                      type='button'
                      className='btn btn-secondary btn-sm'
                      onClick={() => setPlayersRetry(value => value + 1)}
                    >
                      Retry
                    </button>
                  </div>
                ) :
                (
                  <div className='form-help'>
                    {!formData.teamId ?
                      'Select a team to see your available children.' :
                      !playersLoading && existingPlayers.length === 0 ?
                      'No linked children are available to add. They may already be on this team.' :
                      'Only children already linked to your account and not on this team are listed. Your team role will not change.'}
                  </div>
                )}
            </div>
          ) :
          (
            <div className='form-group'>
              <label htmlFor='player-profile-name' className='form-label'>Player Name *</label>
              <input
                id='player-profile-name'
                type='text'
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className='form-input'
                placeholder="Enter player's full name"
                autoFocus={!!currentTeamId}
                disabled={loading || !!success}
              />
            </div>
          )}

        <div className='form-group'>
          <label htmlFor='player-profile-jersey' className='form-label'>Jersey Number</label>
          <input
            id='player-profile-jersey'
            type='text'
            value={formData.jerseyNumber}
            onChange={(e) => setFormData({ ...formData, jerseyNumber: e.target.value })}
            className='form-input'
            placeholder='Optional jersey number'
            pattern={playerMode === 'existing' ? '\\d{1,2}' : undefined}
            disabled={loading || !!success}
          />
          <div className='form-help'>
            Jersey numbers are optional and can be updated later.
          </div>
        </div>

        {playerMode === 'new' && (
          <div className='form-group'>
            <label className={`form-checkbox ${formData.isGuardian ? 'checked' : ''}`}>
              <input
                type='checkbox'
                checked={formData.isGuardian}
                onChange={(e) => setFormData({ ...formData, isGuardian: e.target.checked })}
                disabled={loading || !!success}
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
        )}

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
            disabled={loading || !!success || !formData.teamId ||
              (playerMode === 'new' ?
                !formData.name.trim() :
                playersLoading || !!playersError || !existingPlayers.some(player => player.id === formData.playerId))}
          >
            {loading ?
              (playerMode === 'existing' ? 'Adding...' : 'Creating...') :
              (playerMode === 'existing' ? 'Add to Team' : 'Create Profile')}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default PlayerProfileModal;
