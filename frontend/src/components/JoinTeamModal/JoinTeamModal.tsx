import React, { useState } from 'react';
import { getApiUrl } from '../../utils/api';
import { ClaimPlayerProfile } from '../ClaimPlayerProfile';
import { Modal } from '../Modal';
import './JoinTeamModal.css';

interface JoinTeamModalProps
{
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialJoinCode?: string;
}

interface TeamValidationData
{
  team_name: string;
  team_role: string;
  team_id: string;
}

interface Player
{
  id: string;
  name: string;
  jerseyNumber?: string;
  team_name?: string;
  user_id?: string;
  is_claimed?: boolean;
  has_guardians?: boolean;
  guardian_count?: number;
  guardians?: Array<{ guardian_id: string; guardian_name: string; }>;
  current_user_is_guardian?: boolean;
  can_claim_as_guardian?: boolean;
}

export const JoinTeamModal: React.FC<JoinTeamModalProps> = ({ isOpen, onClose, onSuccess, initialJoinCode }) =>
{
  const [joinCode, setJoinCode] = useState('');
  const [validatedTeam, setValidatedTeam] = useState<TeamValidationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [currentStep, setCurrentStep] = useState<'code' | 'player' | 'confirm'>('code');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [isNewPlayer, setIsNewPlayer] = useState(false);
  const [autoValidated, setAutoValidated] = useState(false); // ensure we only auto-validate once per open

  // Auto-fill and validate join code when provided
  React.useEffect(() =>
  {
    if (initialJoinCode && initialJoinCode.trim() && isOpen)
    {
      setJoinCode(initialJoinCode.trim().toUpperCase());
      // Reset auto validation flag when a new code comes in (or modal reopened with a code)
      setAutoValidated(false);
    }
  }, [initialJoinCode, isOpen]);

  // Auto-validate (proceed to next step) once joinCode state reflects the provided initialJoinCode
  React.useEffect(() =>
  {
    if (!isOpen) return;
    if (!initialJoinCode || !initialJoinCode.trim()) return;
    const formatted = initialJoinCode.trim().toUpperCase();
    if (joinCode !== formatted) return; // wait until joinCode state updated
    if (validatedTeam || loading) return; // already validated or busy
    if (autoValidated) return; // already attempted

    setAutoValidated(true);
    // Trigger validation to move to next step automatically
    handleValidateCode();
  }, [isOpen, initialJoinCode, joinCode, validatedTeam, loading, autoValidated]);

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

      // If joining as player, check if user already has a player profile
      if (data.team_role === 'player')
      {
        await checkUserPlayerProfile();
      }
      else if (data.team_role === 'guardian')
      {
        // For guardian role, always go to player selection
        setCurrentStep('player');
      }
      else
      {
        // For coach/admin roles, skip to confirmation
        setCurrentStep('confirm');
      }
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

  const checkUserPlayerProfile = async () =>
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
      const response = await fetch(`${apiUrl}/api/auth/player-profile`, {
        headers: {
          'Authorization': `Bearer ${session.data.session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok)
      {
        throw new Error('Failed to fetch user player profile');
      }

      const playerProfile = await response.json();

      if (playerProfile)
      {
        // User has a player profile, auto-select it and skip to confirmation
        const selectedPlayerData: Player = {
          id: playerProfile.id,
          name: playerProfile.name,
          user_id: playerProfile.user_id,
          is_claimed: true,
        };

        setSelectedPlayer(selectedPlayerData);
        setIsNewPlayer(false);
        setCurrentStep('confirm');
      }
      else
      {
        // User has no player profile, go to player selection step
        // but we'll enhance ClaimPlayerProfile to auto-show create form for players
        setCurrentStep('player');
      }
    }
    catch (error)
    {
      console.error('Error checking user player profile:', error);
      // If there's an error, fall back to player selection step
      setCurrentStep('player');
    }
  };

  const handlePlayerSelected = (player: Player | null, isNew: boolean) =>
  {
    setSelectedPlayer(player);
    setIsNewPlayer(isNew);
    setCurrentStep('confirm');
  };

  const handleBackToTeamInfo = () =>
  {
    setCurrentStep('confirm');
    setSelectedPlayer(null);
    setIsNewPlayer(false);
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

      // Prepare request body
      const requestBody: any = {
        joinCode: joinCode.trim(),
      };

      // Add player data if we're joining as player or guardian
      if ((validatedTeam.team_role === 'player' || validatedTeam.team_role === 'guardian') && selectedPlayer)
      {
        requestBody.playerData = {
          id: selectedPlayer.id,
          name: selectedPlayer.name,
          jerseyNumber: selectedPlayer.jerseyNumber,
          user_id: selectedPlayer.user_id,
          isNewPlayer: isNewPlayer,
        };
      }

      const response = await fetch(`${apiUrl}/api/teams/join`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.data.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
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
    setCurrentStep('code');
    setSelectedPlayer(null);
    setIsNewPlayer(false);
    setAutoValidated(false);
    setError('');
    setSuccess('');
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) =>
  {
    if (e.key === 'Enter' && currentStep === 'code')
    {
      if (validatedTeam)
      {
        if (validatedTeam.team_role === 'player' || validatedTeam.team_role === 'guardian')
        {
          setCurrentStep('player');
        }
        else
        {
          setCurrentStep('confirm');
        }
      }
      else
      {
        handleValidateCode();
      }
    }
  };

  // Determine modal size based on current step
  const modalSize = currentStep === 'player' ? 'md' : 'sm';

  // Dynamic modal title: after successful validation show team + role
  const modalTitle = validatedTeam ?
    (() =>
    {
      const role = validatedTeam.team_role.charAt(0).toUpperCase() + validatedTeam.team_role.slice(1);
      const name = validatedTeam.team_name;
      const truncated = name.length > 28 ? name.slice(0, 27) + '…' : name; // 36 total incl ellipsis
      return `Join ${truncated} (${role})`;
    })() :
    'Join Team';

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={modalTitle}
      size={modalSize}
      className='join-team-modal'
    >
      <div className='form'>
        {error && <div className='alert alert-error'>{error}</div>}
        {success && <div className='alert alert-success'>{success}</div>}

        {currentStep === 'code' && (
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
        )}

        {currentStep === 'player' && validatedTeam && (
          // Step 2: Player selection (for player and guardian roles)
          <ClaimPlayerProfile
            teamId={validatedTeam.team_id}
            teamName={validatedTeam.team_name}
            userRole={validatedTeam.team_role as 'player' | 'guardian'}
            joinCode={joinCode}
            onPlayerSelected={handlePlayerSelected}
            onBack={handleBackToTeamInfo}
            onSkipPlayerSelection={validatedTeam.team_role === 'guardian' ?
              () =>
              {
                setSelectedPlayer(null);
                setIsNewPlayer(false);
                setCurrentStep('confirm');
              } :
              undefined}
            skipToCreate={validatedTeam.team_role === 'player'}
          />
        )}

        {currentStep === 'confirm' && validatedTeam && (
          // Step 3: Confirm team join
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

            {selectedPlayer && (
              <div className='player-confirmation'>
                <h4>Player Profile</h4>
                <div className='selected-player-summary'>
                  <div className='player-name'>
                    {selectedPlayer.name}
                    {selectedPlayer.jerseyNumber && (
                      <span className='player-jersey'>#{selectedPlayer.jerseyNumber}</span>
                    )}
                  </div>
                  <div className='player-status'>
                    {isNewPlayer ? 'New player profile' : 'Existing player profile'}
                  </div>
                  <div className='player-action'>
                    {validatedTeam.team_role === 'player' ?
                      (selectedPlayer.user_id ?
                        'Your existing player profile' :
                        'Will be linked to your account') :
                      'You will be added as guardian'}
                  </div>
                </div>
              </div>
            )}

            <div className='form-actions'>
              {(validatedTeam.team_role === 'player' || validatedTeam.team_role === 'guardian') && (
                <button
                  onClick={() => setCurrentStep('player')}
                  className='btn btn-secondary'
                  disabled={loading}
                >
                  {selectedPlayer ? 'Change Player' : 'Select Player'}
                </button>
              )}
              <button
                onClick={() =>
                {
                  setValidatedTeam(null);
                  setCurrentStep('code');
                  setSelectedPlayer(null);
                  setIsNewPlayer(false);
                  setError('');
                }}
                className='btn btn-secondary'
                disabled={loading}
              >
                Back to Code
              </button>
              <button
                onClick={handleJoinTeam}
                className='btn btn-success'
                disabled={loading ||
                  (validatedTeam.team_role === 'player' && !selectedPlayer)}
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
