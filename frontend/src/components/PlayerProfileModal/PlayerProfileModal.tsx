import React, { useEffect, useState } from 'react';
import { getApiUrl } from '../../utils/api';
import './PlayerProfileModal.css';

interface PlayerProfileModalProps
{
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentTeamId?: string;
  forceGuardianRole?: boolean;
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
  role: 'guardian' | 'staff';
  teamId: string;
}

type Step = 'role' | 'team' | 'profile' | 'confirmation';

export const PlayerProfileModal: React.FC<PlayerProfileModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  currentTeamId,
  forceGuardianRole = false,
}) =>
{
  const [currentStep, setCurrentStep] = useState<Step>('role');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [teams, setTeams] = useState<Team[]>([]);

  const [formData, setFormData] = useState<PlayerProfileFormData>({
    name: '',
    jerseyNumber: '',
    role: 'staff',
    teamId: currentTeamId || '',
  });

  useEffect(() =>
  {
    if (isOpen)
    {
      fetchUserTeams();
      // Reset form when modal opens
      const initialStep = forceGuardianRole ? (currentTeamId ? 'profile' : 'team') : 'role';
      const initialRole = forceGuardianRole ? 'guardian' : 'staff';

      setCurrentStep(initialStep);
      setFormData({
        name: '',
        jerseyNumber: '',
        role: initialRole,
        teamId: currentTeamId || '',
      });
      setError('');
      setSuccess('');
    }
  }, [isOpen, currentTeamId, forceGuardianRole]);

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

  const handleSubmit = async () =>
  {
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
          userRole: formData.role,
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
    setCurrentStep('role');
    setFormData({
      name: '',
      jerseyNumber: '',
      role: 'staff',
      teamId: currentTeamId || '',
    });
    setError('');
    setSuccess('');
    onClose();
  };

  const handleNext = () =>
  {
    if (currentStep === 'role')
    {
      setCurrentStep(currentTeamId ? 'profile' : 'team');
    }
    else if (currentStep === 'team')
    {
      setCurrentStep('profile');
    }
    else if (currentStep === 'profile')
    {
      if (formData.role === 'guardian')
      {
        setCurrentStep('confirmation');
      }
      else
      {
        handleSubmit();
      }
    }
    else if (currentStep === 'confirmation')
    {
      handleSubmit();
    }
  };

  const handleBack = () =>
  {
    if (currentStep === 'team')
    {
      if (!forceGuardianRole)
      {
        setCurrentStep('role');
      }
    }
    else if (currentStep === 'profile')
    {
      if (forceGuardianRole && !currentTeamId)
      {
        setCurrentStep('team');
      }
      else if (!forceGuardianRole)
      {
        setCurrentStep(currentTeamId ? 'role' : 'team');
      }
      // If forceGuardianRole && currentTeamId, there's no previous step
    }
    else if (currentStep === 'confirmation')
    {
      setCurrentStep('profile');
    }
  };

  const canProceed = () =>
  {
    if (currentStep === 'role')
    {
      return true; // Role is always selected since it has a default value
    }
    else if (currentStep === 'team')
    {
      return formData.teamId !== '';
    }
    else if (currentStep === 'profile')
    {
      return formData.name.trim() !== '';
    }
    return true;
  };

  const getSelectedTeam = () =>
  {
    return teams.find(team => team.id === formData.teamId);
  };

  const handleKeyDown = (e: React.KeyboardEvent) =>
  {
    if (e.key === 'Escape')
    {
      handleClose();
    }
    else if (e.key === 'Enter' && canProceed())
    {
      if (currentStep === 'confirmation')
      {
        handleSubmit();
      }
      else
      {
        handleNext();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className='modal-overlay' onClick={handleClose}>
      <div className='modal-content player-profile-modal' onClick={(e) => e.stopPropagation()}>
        <div className='modal-header'>
          <h2>Add Player Profile</h2>
          <button
            onClick={handleClose}
            className='btn btn-secondary btn-sm'
            style={{ padding: '4px 8px', fontSize: '12px' }}
          >
            ✕
          </button>
        </div>

        <div className='form'>
          {error && <div className='alert alert-error'>{error}</div>}
          {success && <div className='alert alert-success'>{success}</div>}

          {/* Progress indicator */}
          <div className='progress-indicator'>
            {!forceGuardianRole && (
              <div className={`progress-step ${currentStep === 'role' ? 'active' : ''}`}>
                <span>1</span>
                <label>Role</label>
              </div>
            )}
            {!currentTeamId && (
              <div className={`progress-step ${currentStep === 'team' ? 'active' : ''}`}>
                <span>{forceGuardianRole ? '1' : '2'}</span>
                <label>Team</label>
              </div>
            )}
            <div className={`progress-step ${currentStep === 'profile' ? 'active' : ''}`}>
              <span>{forceGuardianRole ? (currentTeamId ? '1' : '2') : (currentTeamId ? '2' : '3')}</span>
              <label>Profile</label>
            </div>
            {formData.role === 'guardian' && (
              <div className={`progress-step ${currentStep === 'confirmation' ? 'active' : ''}`}>
                <span>{forceGuardianRole ? (currentTeamId ? '2' : '3') : (currentTeamId ? '3' : '4')}</span>
                <label>Confirm</label>
              </div>
            )}
          </div>

          {/* Step 1: Role Selection */}
          {currentStep === 'role' && (
            <div className='step-content'>
              <div className='role-options'>
                <div
                  className={`role-option ${formData.role === 'guardian' ? 'selected' : ''}`}
                  onClick={() => setFormData({ ...formData, role: 'guardian' })}
                >
                  <div className='role-icon'>👨‍👩‍👧‍👦</div>
                  <div className='role-info'>
                    <h4>Guardian</h4>
                    <p>Create a player profile and establish a guardian relationship</p>
                  </div>
                </div>

                <div
                  className={`role-option ${formData.role === 'staff' ? 'selected' : ''}`}
                  onClick={() => setFormData({ ...formData, role: 'staff' })}
                >
                  <div className='role-icon'>⚙️</div>
                  <div className='role-info'>
                    <h4>Team Staff</h4>
                    <p>Create a player profile for team management (Coach/Admin)</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Team Selection */}
          {currentStep === 'team' && (
            <div className='step-content'>
              <h3>Select Team</h3>
              <p className='step-description'>
                Choose the team for this player profile:
              </p>

              <div className='form-group'>
                <label className='form-label'>Team</label>
                <select
                  value={formData.teamId}
                  onChange={(e) => setFormData({ ...formData, teamId: e.target.value })}
                  className='form-input'
                  autoFocus
                  onKeyDown={handleKeyDown}
                >
                  <option value=''>Select a team...</option>
                  {teams.map(team => (
                    <option key={team.id} value={team.id}>
                      {team.name} (as {team.role})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Step 3: Player Profile */}
          {currentStep === 'profile' && (
            <div className='step-content'>
              <h3>Player Profile Details</h3>
              {getSelectedTeam() && (
                <div className='selected-team-info'>
                  <p>
                    <strong>Team:</strong> {getSelectedTeam()?.name}
                  </p>
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
                  autoFocus
                  onKeyDown={handleKeyDown}
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
                  onKeyDown={handleKeyDown}
                />
                <div className='form-help'>
                  Jersey numbers are optional and can be updated later.
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Guardian Confirmation */}
          {currentStep === 'confirmation' && formData.role === 'guardian' && (
            <div className='step-content'>
              <h3>Confirm Guardian Relationship</h3>
              <div className='confirmation-details'>
                <p>
                  <strong>Team:</strong> {getSelectedTeam()?.name}
                </p>
                <p>
                  <strong>Player Name:</strong> {formData.name}
                </p>
                <p>
                  <strong>Jersey Number:</strong> {formData.jerseyNumber || 'Not specified'}
                </p>
                <p>
                  <strong>Your Role:</strong> <span className='role-badge'>{formData.role}</span>
                </p>
              </div>

              <div className='guardian-info'>
                <h4>Guardian Relationship</h4>
                <p>
                  By proceeding, you will be established as the guardian for this player profile. This will allow you to
                  view their coaching points and team information.
                </p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className='form-actions'>
            {currentStep !== 'role' && !(forceGuardianRole && currentTeamId && currentStep === 'profile') && (
              <button
                onClick={handleBack}
                className='btn btn-secondary'
                disabled={loading}
              >
                Back
              </button>
            )}

            <button
              onClick={handleClose}
              className='btn btn-secondary'
              disabled={loading}
            >
              Cancel
            </button>

            {currentStep === 'confirmation' ?
              (
                <button
                  onClick={handleSubmit}
                  className='btn btn-success'
                  disabled={loading || !canProceed()}
                >
                  {loading ? 'Creating...' : 'Create Profile'}
                </button>
              ) :
              (
                <button
                  onClick={handleNext}
                  className='btn btn-primary'
                  disabled={loading || !canProceed()}
                >
                  {currentStep === 'profile' && formData.role !== 'guardian' ?
                    (loading ? 'Creating...' : 'Create Profile') :
                    'Next'}
                </button>
              )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerProfileModal;
