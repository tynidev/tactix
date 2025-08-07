import React, { useEffect, useState } from 'react';
import { getApiUrl } from '../../utils/api';
import './ClaimPlayerProfile.css';

interface Player
{
  id: string;
  name: string;
  jerseyNumber?: string;
  team_name?: string;
  user_id?: string;
  is_claimed?: boolean;
}

interface UserProfile
{
  id: string;
  name: string;
  email: string;
}

interface ClaimPlayerProfileProps
{
  teamId: string;
  teamName: string;
  userRole: 'player' | 'guardian';
  joinCode?: string;
  onPlayerSelected: (player: Player | null, isNewPlayer: boolean) => void;
  onBack: () => void;
  skipToCreate?: boolean; // For players without existing profiles
}

export const ClaimPlayerProfile: React.FC<ClaimPlayerProfileProps> = ({
  teamId,
  teamName,
  userRole,
  joinCode,
  onPlayerSelected,
  onBack,
  skipToCreate = false,
}) =>
{
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerJersey, setNewPlayerJersey] = useState('');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  // Search for existing players
  const handleSearch = async () =>
  {
    if (!searchTerm.trim())
    {
      setSearchResults([]);
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
      const searchUrl = `${apiUrl}/api/players/search?q=${encodeURIComponent(searchTerm)}&teamId=${teamId}${
        joinCode ? `&joinCode=${joinCode}` : ''
      }`;
      const response = await fetch(searchUrl, {
        headers: {
          'Authorization': `Bearer ${session.data.session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok)
      {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to search players');
      }

      const data = await response.json();
      setSearchResults(data);
    }
    catch (err)
    {
      setError(err instanceof Error ? err.message : 'Failed to search players');
    }
    finally
    {
      setLoading(false);
    }
  };

  // Handle player selection
  const handlePlayerSelect = (player: Player) =>
  {
    setSelectedPlayer(player);
  };

  // Fetch user profile for player role
  const fetchUserProfile = async () =>
  {
    if (userRole !== 'player') return;

    setLoadingProfile(true);
    try
    {
      const token = (await import('../../lib/supabase')).supabase.auth.getSession();
      const session = await token;

      if (!session.data.session?.access_token)
      {
        throw new Error('No access token');
      }

      const { data: { user } } = await (await import('../../lib/supabase')).supabase.auth.getUser();
      if (user?.user_metadata)
      {
        setUserProfile({
          id: user.id,
          name: user.user_metadata.full_name || user.user_metadata.name || user.email?.split('@')[0] || 'Player',
          email: user.email || '',
        });
      }
    }
    catch (err)
    {
      console.error('Error fetching user profile:', err);
      setError('Failed to load user profile');
    }
    finally
    {
      setLoadingProfile(false);
    }
  };

  // Handle creating new player
  const handleCreatePlayer = () =>
  {
    const playerName = isPlayer && userProfile ? userProfile.name : newPlayerName.trim();

    if (!playerName)
    {
      setError('Player name is required');
      return;
    }

    const newPlayer: Player = {
      id: 'new',
      name: playerName,
      jerseyNumber: newPlayerJersey.trim() || undefined,
    };

    onPlayerSelected(newPlayer, true);
  };

  // Handle confirming player selection
  const handleConfirmSelection = () =>
  {
    if (selectedPlayer)
    {
      onPlayerSelected(selectedPlayer, false);
    }
  };

  const isPlayer = userRole === 'player';

  // Fetch user profile on mount for player role
  useEffect(() =>
  {
    fetchUserProfile();
  }, [userRole]);

  // Search when search term changes
  useEffect(() =>
  {
    const timeoutId = setTimeout(() =>
    {
      if (searchTerm.trim())
      {
        handleSearch();
      }
      else
      {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  // Auto-populate name when user profile is loaded for player role
  useEffect(() =>
  {
    if (isPlayer && userProfile && showCreateForm)
    {
      setNewPlayerName(userProfile.name);
    }
  }, [userProfile, showCreateForm, isPlayer]);

  // Auto-show create form for players when skipToCreate is true
  useEffect(() =>
  {
    if (skipToCreate && isPlayer && userProfile && !showCreateForm && !selectedPlayer)
    {
      setShowCreateForm(true);
    }
  }, [skipToCreate, isPlayer, userProfile, showCreateForm, selectedPlayer]);

  return (
    <div className='claim-player-profile'>
      <div className='claim-player-header'>
        <h3>
          {isPlayer ? 'Link Your Player Profile' : "Link Child's Player Profile"}
        </h3>
        <p className='claim-player-description'>
          {isPlayer ?
            `Search for your existing player profile in ${teamName} or create a new one.` :
            `Search for your child's existing player profile in ${teamName} or create a new one.`}
        </p>
      </div>

      {error && <div className='alert alert-error'>{error}</div>}

      {!showCreateForm && !selectedPlayer && (
        <div className='player-search-section'>
          <div className='form-group'>
            <label className='form-label'>Search for Player</label>
            <input
              type='text'
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className='form-input'
              placeholder={isPlayer ? 'Enter your name...' : "Enter your child's name..."}
              autoFocus
            />
            <div className='form-help'>
              Search by player name to find existing profiles in {teamName}
            </div>
          </div>

          {loading && (
            <div className='search-loading'>
              <div className='loading'>Searching players...</div>
            </div>
          )}

          {searchResults.length > 0 && (
            <div className='search-results'>
              <h4>Found Players</h4>
              <div className='player-list'>
                {searchResults.map((player) => (
                  <div
                    key={player.id}
                    className={`player-item ${player.is_claimed ? 'player-claimed' : ''}`}
                    onClick={() => !player.is_claimed && handlePlayerSelect(player)}
                  >
                    <div className='player-info'>
                      <div className='player-name'>
                        {player.name}
                        {player.jerseyNumber && <span className='player-jersey'>#{player.jerseyNumber}</span>}
                      </div>
                      {player.team_name && <div className='player-team'>{player.team_name}</div>}
                    </div>
                    <div className='player-status'>
                      {player.is_claimed ?
                        <span className='status-claimed'>Already Claimed</span> :
                        <span className='status-available'>Available</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {searchTerm && !loading && searchResults.length === 0 && (
            <div className='no-results'>
              <div className='no-results-content'>
                <h4>No players found</h4>
                <p>
                  {isPlayer ?
                    "We couldn't find a player profile matching your search." :
                    "We couldn't find a player profile matching your search."}
                </p>
                <button
                  onClick={() => setShowCreateForm(true)}
                  className='btn btn-primary'
                >
                  Create New Player Profile
                </button>
              </div>
            </div>
          )}

          <div className='create-player-option'>
            <div className='divider'>
              <span>OR</span>
            </div>
            <button
              onClick={() => setShowCreateForm(true)}
              className='btn btn-secondary btn-block'
            >
              Create New Player Profile
            </button>
          </div>
        </div>
      )}

      {selectedPlayer && !showCreateForm && (
        <div className='player-selected'>
          <div className='selected-player-info'>
            <h4>Selected Player</h4>
            <div className='player-card'>
              <div className='player-details'>
                <div className='player-name'>
                  {selectedPlayer.name}
                  {selectedPlayer.jerseyNumber && <span className='player-jersey'>#{selectedPlayer.jerseyNumber}</span>}
                </div>
                {selectedPlayer.team_name && <div className='player-team'>{selectedPlayer.team_name}</div>}
              </div>
            </div>
            <div className='linking-info'>
              <p>
                {isPlayer ?
                  'This player profile will be linked to your account.' :
                  'You will be added as a guardian for this player.'}
              </p>
            </div>
          </div>

          <div className='form-actions'>
            <button
              onClick={() => setSelectedPlayer(null)}
              className='btn btn-secondary'
            >
              Back to Search
            </button>
            <button
              onClick={handleConfirmSelection}
              className='btn btn-primary'
            >
              {isPlayer ? 'Link This Profile' : 'Claim as Guardian'}
            </button>
          </div>
        </div>
      )}

      {showCreateForm && (
        <div className='create-player-form'>
          <h4>Create New Player Profile</h4>

          {loadingProfile && isPlayer && (
            <div className='loading-profile'>
              <div className='loading'>Loading your profile information...</div>
            </div>
          )}

          <div className='form-group'>
            <label className='form-label'>Player Name *</label>
            <input
              type='text'
              value={newPlayerName}
              onChange={(e) => !isPlayer && setNewPlayerName(e.target.value)}
              className={`form-input ${isPlayer ? 'form-input-readonly' : ''}`}
              placeholder={isPlayer ? 'Loading your name...' : "Enter your child's full name"}
              readOnly={isPlayer}
              disabled={isPlayer && loadingProfile}
              autoFocus={!isPlayer}
            />
            {isPlayer && (
              <div className='form-help'>
                Your player name is automatically taken from your account profile.
              </div>
            )}
          </div>

          <div className='form-group'>
            <label className='form-label'>Jersey Number</label>
            <input
              type='text'
              value={newPlayerJersey}
              onChange={(e) => setNewPlayerJersey(e.target.value)}
              className='form-input'
              placeholder='Optional jersey number'
              autoFocus={isPlayer}
            />
            <div className='form-help'>
              Jersey numbers are optional and can be updated later.
            </div>
          </div>

          <div className='form-actions'>
            <button
              onClick={() =>
              {
                setShowCreateForm(false);
                setNewPlayerName('');
                setNewPlayerJersey('');
                setError('');
              }}
              className='btn btn-secondary'
            >
              Back to Search
            </button>
            <button
              onClick={handleCreatePlayer}
              className='btn btn-primary'
              disabled={isPlayer ? (!userProfile || loadingProfile) : !newPlayerName.trim()}
            >
              Create Profile
            </button>
          </div>
        </div>
      )}

      <div className='claim-player-back'>
        <button
          onClick={onBack}
          className='btn btn-secondary'
        >
          Back to Team Info
        </button>
      </div>
    </div>
  );
};

export default ClaimPlayerProfile;
