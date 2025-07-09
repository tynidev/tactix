import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getApiUrl } from '../../utils/api';
import { JoinTeamModal } from '../JoinTeamModal/JoinTeamModal';
import { PlayerProfileModal } from '../PlayerProfileModal/PlayerProfileModal';

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

  useEffect(() =>
  {
    fetchUserProfile();
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
    // Optionally refresh stats here if needed
    fetchUserProfile();
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
        <div className='card' style={{ marginBottom: 'var(--space-xl)' }}>
          {/* Header with Action Buttons */}

          <div style={{ display: 'flex', gap: 'var(--space-xl)', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {/* Avatar and Basic Info */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '200px' }}>
              <div className='profile-avatar' style={{ marginBottom: 'var(--space-lg)' }}>
                {getInitials()}
              </div>

              {editing ?
                (
                  <div className='form-group' style={{ width: '100%', textAlign: 'center' }}>
                    <input
                      type='text'
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className='form-input'
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
                      style={{ textAlign: 'center', marginBottom: 'var(--space-sm)' }}
                    />
                    <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'center' }}>
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
                  <div style={{ textAlign: 'center', width: '100%' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 'var(--space-sm)',
                        marginBottom: 'var(--space-xs)',
                      }}
                    >
                      <h2 className='profile-name' style={{ margin: 0 }}>{profile?.name}</h2>
                      <button
                        onClick={() => setEditing(true)}
                        className='btn btn-secondary btn-sm'
                        style={{ padding: '4px 8px', fontSize: '12px' }}
                      >
                        ✏️
                      </button>
                    </div>
                    <p className='profile-email' style={{ margin: 0, marginBottom: 'var(--space-sm)' }}>
                      {profile?.email}
                    </p>
                    <div style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>
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
            <div style={{ flex: 1, minWidth: '300px' }}>
              <h3 style={{ marginBottom: 'var(--space-lg)', color: 'var(--color-text-primary)' }}>
                Activity Statistics
              </h3>

              {stats ?
                (
                  <div className='profile-stats' style={{ marginBottom: 'var(--space-lg)' }}>
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
                  <div className='loading' style={{ textAlign: 'left', padding: 'var(--space-lg) 0' }}>
                    Loading stats...
                  </div>
                )}

              {/* Join Team Button */}
              <div style={{ textAlign: 'center', marginTop: 'var(--space-lg)' }}>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-lg)' }}>
            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
              <button
                onClick={() => setShowPlayerProfileModal(true)}
                className='btn btn-secondary btn-md'
                style={{ minWidth: '150px' }}
              >
                Add My Player
              </button>
              <button
                onClick={() => setShowJoinTeamModal(true)}
                className='btn btn-secondary btn-md'
                style={{ minWidth: '150px' }}
              >
                Join Team
              </button>
            </div>
          </div>
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
    </div>
  );
};

export default UserProfilePage;
