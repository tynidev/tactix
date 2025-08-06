import React, { useEffect, useState } from 'react';
import { FaPencilAlt, FaTrash } from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';
import { getApiUrl } from '../../utils/api';
import { ConfirmationDialog } from '../ConfirmationDialog';
import { JoinTeamModal } from '../JoinTeamModal/JoinTeamModal';
import { PlayerProfileModal } from '../PlayerProfileModal/PlayerProfileModal';
import './UserProfile.css';

interface UserProfile
{
  id: string;
  name: string;
  email: string;
  created_at: string;
}

interface UserStats
{
  teamsCount: number;
  games: number;
  totalMarkups: number;
  lastActivity: string;
}

interface GuardianPlayer
{
  id: string;
  name: string;
  user_id: string | null;
  created_at: string;
  relationship_type: 'guardian' | 'owner';
  relationship_created: string;
}

export const UserProfilePage: React.FC = () =>
{
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [showJoinTeamModal, setShowJoinTeamModal] = useState(false);
  const [showPlayerProfileModal, setShowPlayerProfileModal] = useState(false);

  // Guardian players state
  const [guardianPlayers, setGuardianPlayers] = useState<GuardianPlayer[]>([]);
  const [playersLoading, setPlayersLoading] = useState(false);
  const [deletePlayerDialog, setDeletePlayerDialog] = useState<{
    isOpen: boolean;
    player: GuardianPlayer | null;
  }>({ isOpen: false, player: null });
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() =>
  {
    fetchUserProfile();
    fetchGuardianPlayers();
  }, []);

  const fetchUserProfile = async () =>
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

      // Fetch user profile
      const profileResponse = await fetch(`${apiUrl}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${session.data.session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!profileResponse.ok)
      {
        throw new Error('Failed to fetch profile');
      }

      const profileData = await profileResponse.json();
      setProfile(profileData);
      setEditName(profileData.name);

      // Fetch user teams for stats
      const teamsResponse = await fetch(`${apiUrl}/api/teams`, {
        headers: {
          'Authorization': `Bearer ${session.data.session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (teamsResponse.ok)
      {
        const teamsData = await teamsResponse.json();
        setStats({
          teamsCount: teamsData.length,
          games: 0, // Placeholder - would come from games API
          totalMarkups: 0, // Placeholder - would come from markups API
          lastActivity: new Date().toISOString(),
        });
      }
    }
    catch (err)
    {
      setError('Failed to load profile');
      console.error('Error fetching profile:', err);
    }
    finally
    {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async () =>
  {
    if (!editName.trim())
    {
      alert('Name cannot be empty');
      return;
    }

    try
    {
      const token = (await import('../../lib/supabase')).supabase.auth.getSession();
      const session = await token;

      if (!session.data.session?.access_token)
      {
        throw new Error('No access token');
      }

      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/auth/profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.data.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: editName.trim() }),
      });

      if (!response.ok)
      {
        throw new Error('Failed to update profile');
      }

      // Update local state
      setProfile(prev => prev ? { ...prev, name: editName.trim() } : null);
      setEditing(false);
    }
    catch (err)
    {
      alert('Failed to update profile');
      console.error('Error updating profile:', err);
    }
  };

  const handleJoinTeamSuccess = () =>
  {
    // Refresh the user profile to update team count
    fetchUserProfile();
  };

  const handlePlayerProfileSuccess = () =>
  {
    setShowPlayerProfileModal(false);
    // Refresh both profile and guardian players
    fetchUserProfile();
    fetchGuardianPlayers();
  };

  const fetchGuardianPlayers = async () =>
  {
    setPlayersLoading(true);
    try
    {
      const token = (await import('../../lib/supabase')).supabase.auth.getSession();
      const session = await token;

      if (!session.data.session?.access_token)
      {
        throw new Error('No access token');
      }

      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/auth/guardian-players`, {
        headers: {
          'Authorization': `Bearer ${session.data.session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok)
      {
        throw new Error('Failed to fetch guardian players');
      }

      const data = await response.json();
      setGuardianPlayers(data);
    }
    catch (err)
    {
      console.error('Error fetching guardian players:', err);
      // Don't show error for this since it's not critical
    }
    finally
    {
      setPlayersLoading(false);
    }
  };

  const handleDeletePlayer = (player: GuardianPlayer) =>
  {
    setDeletePlayerDialog({ isOpen: true, player });
  };

  const confirmDeletePlayer = async () =>
  {
    if (!deletePlayerDialog.player) return;

    setDeleteLoading(true);
    try
    {
      const token = (await import('../../lib/supabase')).supabase.auth.getSession();
      const session = await token;

      if (!session.data.session?.access_token)
      {
        throw new Error('No access token');
      }

      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/auth/players/${deletePlayerDialog.player.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.data.session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok)
      {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete player');
      }

      const data = await response.json();
      alert(data.message || 'Player deleted successfully');

      // Refresh guardian players list
      await fetchGuardianPlayers();

      // Close dialog
      setDeletePlayerDialog({ isOpen: false, player: null });
    }
    catch (err)
    {
      console.error('Error deleting player:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete player');
    }
    finally
    {
      setDeleteLoading(false);
    }
  };

  const cancelDeletePlayer = () =>
  {
    setDeletePlayerDialog({ isOpen: false, player: null });
  };

  const getInitials = () =>
  {
    if (profile?.name)
    {
      return profile.name
        .split(' ')
        .map(n => n.charAt(0))
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return user?.email?.charAt(0).toUpperCase() || 'U';
  };

  if (loading)
  {
    return (
      <div className='dashboard-container'>
        <div className='loading'>Loading profile...</div>
      </div>
    );
  }

  if (error)
  {
    return (
      <div className='dashboard-container'>
        <div className='dashboard-main'>
          <div className='alert alert-error'>{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className='dashboard-container'>
      <div className='dashboard-main'>
        <div className='section-header'>
          <h1 className='section-title'>User Profile</h1>
        </div>

        {/* Main Profile Section */}
        <div className='card user-profile-main-card'>
          <div className='user-profile-layout'>
            {/* Avatar and Basic Info */}
            <div className='user-profile-avatar-section'>
              {/* Floating Edit Button - only show when not editing */}
              {!editing && (
                <div className='floating-actions'>
                  <button
                    className='floating-action-btn edit-btn'
                    onClick={() => setEditing(true)}
                    title='Edit profile'
                    aria-label='Edit profile'
                  >
                    <FaPencilAlt />
                  </button>
                </div>
              )}

              <div className='profile-avatar user-profile-avatar-container'>
                {getInitials()}
              </div>

              {editing ?
                (
                  <div className='form-group user-profile-edit-form'>
                    <input
                      type='text'
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className='form-input user-profile-edit-input'
                      placeholder='Enter your name'
                      onKeyDown={(e) =>
                      {
                        if (e.key === 'Enter')
                        {
                          handleUpdateProfile();
                        }
                        else if (e.key === 'Escape')
                        {
                          setEditName(profile?.name || '');
                          setEditing(false);
                        }
                      }}
                      autoFocus
                    />
                    <div className='user-profile-edit-actions'>
                      <button
                        onClick={handleUpdateProfile}
                        className='btn btn-success btn-sm'
                      >
                        Save
                      </button>
                      <button
                        onClick={() =>
                        {
                          setEditName(profile?.name || '');
                          setEditing(false);
                        }}
                        className='btn btn-secondary btn-sm'
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) :
                (
                  <div className='user-profile-display'>
                    <div className='user-profile-name-container'>
                      <h2 className='profile-name user-profile-name-title'>{profile?.name}</h2>
                    </div>
                    <p className='profile-email user-profile-email'>
                      {profile?.email}
                    </p>
                    <div className='user-profile-member-since'>
                      <strong>Member Since</strong>
                      <br />
                      {profile?.created_at ?
                        new Date(profile.created_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        }) :
                        'Unknown'}
                    </div>
                  </div>
                )}
            </div>

            {/* Activity Statistics */}
            <div className='user-profile-stats-section'>
              <h3 className='user-profile-stats-title'>
                Activity Statistics
              </h3>

              {stats ?
                (
                  <div className='profile-stats user-profile-stats-container'>
                    <div className='profile-stat'>
                      <div className='profile-stat-value'>{stats.teamsCount}</div>
                      <div className='profile-stat-label'>Teams</div>
                    </div>

                    <div className='profile-stat'>
                      <div className='profile-stat-value'>{stats.games}</div>
                      <div className='profile-stat-label'>Games</div>
                    </div>

                    <div className='profile-stat'>
                      <div className='profile-stat-value'>{stats.totalMarkups}</div>
                      <div className='profile-stat-label'>Total Markups</div>
                    </div>
                  </div>
                ) :
                (
                  <div className='loading user-profile-stats-loading'>
                    Loading stats...
                  </div>
                )}

              <div className='user-profile-join-team-container'>
              </div>
            </div>
          </div>

          <div className='user-profile-actions-container'>
            <div className='user-profile-actions'>
              <button
                onClick={() => setShowPlayerProfileModal(true)}
                className='btn btn-secondary btn-md user-profile-action-button'
              >
                Add My Player
              </button>
              <button
                onClick={() => setShowJoinTeamModal(true)}
                className='btn btn-secondary btn-md user-profile-action-button'
              >
                Join Team
              </button>
            </div>
          </div>
        </div>

        {/* My Players Section */}
        <div className='card user-profile-players-card'>
          <h3 className='user-profile-players-title'>
            My Players
          </h3>

          {playersLoading ?
            (
              <div className='loading user-profile-players-loading'>
                Loading players...
              </div>
            ) :
            guardianPlayers.length === 0 ?
            (
              <div className='user-profile-players-empty'>
                No players found. Use "Add My Player" to create player profiles you can manage.
              </div>
            ) :
            (
              <div className='user-profile-players-grid'>
                {guardianPlayers.map((player) => (
                  <div
                    key={player.id}
                    className='user-profile-player-item'
                  >
                    <div className='user-profile-player-info'>
                      <div className='user-profile-player-name'>
                        {player.name}
                      </div>
                      <div className='user-profile-player-relationship'>
                        {player.relationship_type === 'owner' ? 'Your player profile' : 'Guardian of'}
                      </div>
                      <div className='user-profile-player-date'>
                        Added: {new Date(player.relationship_created).toLocaleDateString()}
                      </div>
                    </div>
                    <div className='user-profile-player-actions'>
                      {/* <button
                        onClick={() => handleDeletePlayer(player)}
                        className='btn btn-danger user-profile-delete-button'
                        title='Delete player permanently'
                      >
                        <FaTrash />
                      </button> */}
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div>
      </div>

      {/* Join Team Modal */}
      <JoinTeamModal
        isOpen={showJoinTeamModal}
        onClose={() => setShowJoinTeamModal(false)}
        onSuccess={handleJoinTeamSuccess}
      />

      {/* Player Profile Modal */}
      <PlayerProfileModal
        isOpen={showPlayerProfileModal}
        onClose={() => setShowPlayerProfileModal(false)}
        onSuccess={handlePlayerProfileSuccess}
        forceGuardianRole={true}
      />

      {/* Delete Player Confirmation Dialog */}
      {/* <ConfirmationDialog
        isOpen={deletePlayerDialog.isOpen}
        onClose={cancelDeletePlayer}
        onConfirm={confirmDeletePlayer}
        title='Delete Player'
        message={deletePlayerDialog.player ?
          `Are you sure you want to permanently delete ${deletePlayerDialog.player.name}? This action cannot be undone and will remove all associated data including team memberships, coaching points, and views.` :
          ''}
        confirmButtonText='Delete Player'
        cancelButtonText='Cancel'
        variant='danger'
        loading={deleteLoading}
      /> */}
    </div>
  );
};

export default UserProfilePage;
