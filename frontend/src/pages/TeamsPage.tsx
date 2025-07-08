import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FaPencilAlt, FaTrash } from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';
import { getApiUrl } from '../utils/api';

interface Team
{
  role: string;
  teams: {
    id: string;
    name: string;
    created_at: string;
  };
}

interface JoinCode
{
  id: string;
  code: string;
  team_role: string | null;
  created_at: string;
  expires_at: string | null;
  is_active: boolean;
  created_by: string;
  user_profiles: {
    name: string;
  };
}

export const TeamsPage: React.FC = () =>
{
  const {} = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editingTeamName, setEditingTeamName] = useState('');
  const [joinCodes, setJoinCodes] = useState<Record<string, JoinCode[]>>({});
  const [showJoinCodes, setShowJoinCodes] = useState<Record<string, boolean>>({});
  const [loadingJoinCodes, setLoadingJoinCodes] = useState<Record<string, boolean>>({});
  const [showCreateJoinCode, setShowCreateJoinCode] = useState<string | null>(null);
  const [newJoinCodeRole, setNewJoinCodeRole] = useState('');
  const [newJoinCodeExpires, setNewJoinCodeExpires] = useState('');

  useEffect(() =>
  {
    // Set body class for dashboard mode
    document.body.className = 'dashboard-mode';
    fetchTeams();

    // Cleanup function to reset body class
    return () =>
    {
      document.body.className = '';
    };
  }, []);

  const fetchTeams = async () =>
  {
    try
    {
      const token = (await import('../lib/supabase')).supabase.auth.getSession();
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
      setTeams(data);

      // Fetch join codes for each team to display guardian codes immediately
      for (const teamMembership of data) {
        try {
          const joinCodesResponse = await fetch(`${apiUrl}/api/teams/${teamMembership.teams.id}/join-codes`, {
            headers: {
              'Authorization': `Bearer ${session.data.session.access_token}`,
              'Content-Type': 'application/json',
            },
          });

          if (joinCodesResponse.ok) {
            const joinCodesData = await joinCodesResponse.json();
            setJoinCodes(prev => ({ ...prev, [teamMembership.teams.id]: joinCodesData }));
          }
        } catch (err) {
          console.error(`Failed to fetch join codes for team ${teamMembership.teams.id}:`, err);
          // Don't fail the whole page if join codes fail to load
        }
      }
    }
    catch (err)
    {
      setError('Failed to load teams');
      console.error('Error fetching teams:', err);
    }
    finally
    {
      setLoading(false);
    }
  };

  const handleCreateTeam = async () =>
  {
    const teamName = prompt('Enter team name:');
    if (!teamName) return;

    try
    {
      const token = (await import('../lib/supabase')).supabase.auth.getSession();
      const session = await token;

      if (!session.data.session?.access_token)
      {
        throw new Error('No access token');
      }

      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/teams`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.data.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: teamName }),
      });

      if (!response.ok)
      {
        throw new Error('Failed to create team');
      }

      // Refresh teams list
      fetchTeams();
    }
    catch (err)
    {
      alert('Failed to create team');
      console.error('Error creating team:', err);
    }
  };

  const handleEditTeam = (teamId: string, currentName: string) =>
  {
    setEditingTeamId(teamId);
    setEditingTeamName(currentName);
  };

  const handleCancelEdit = () =>
  {
    setEditingTeamId(null);
    setEditingTeamName('');
  };

  const handleSaveTeamName = async (teamId: string) =>
  {
    if (!editingTeamName.trim())
    {
      alert('Team name cannot be empty');
      return;
    }

    try
    {
      const token = (await import('../lib/supabase')).supabase.auth.getSession();
      const session = await token;

      if (!session.data.session?.access_token)
      {
        throw new Error('No access token');
      }

      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/teams/${teamId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.data.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: editingTeamName.trim() }),
      });

      if (!response.ok)
      {
        throw new Error('Failed to update team name');
      }

      // Update the local state
      setTeams(teams.map(team =>
        team.teams.id === teamId ?
          { ...team, teams: { ...team.teams, name: editingTeamName.trim() } } :
          team
      ));

      // Reset editing state
      setEditingTeamId(null);
      setEditingTeamName('');
    }
    catch (err)
    {
      alert('Failed to update team name');
      console.error('Error updating team name:', err);
    }
  };

  const fetchJoinCodes = async (teamId: string) =>
  {
    if (loadingJoinCodes[teamId]) return;

    setLoadingJoinCodes(prev => ({ ...prev, [teamId]: true }));

    try
    {
      const token = (await import('../lib/supabase')).supabase.auth.getSession();
      const session = await token;

      if (!session.data.session?.access_token)
      {
        throw new Error('No access token');
      }

      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/teams/${teamId}/join-codes`, {
        headers: {
          'Authorization': `Bearer ${session.data.session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok)
      {
        throw new Error('Failed to fetch join codes');
      }

      const data = await response.json();
      setJoinCodes(prev => ({ ...prev, [teamId]: data }));
    }
    catch (err)
    {
      console.error('Error fetching join codes:', err);
      alert('Failed to load join codes');
    }
    finally
    {
      setLoadingJoinCodes(prev => ({ ...prev, [teamId]: false }));
    }
  };

  const toggleJoinCodes = async (teamId: string) =>
  {
    const isShowing = showJoinCodes[teamId];
    
    if (!isShowing)
    {
      // Fetch join codes if not already loaded
      if (!joinCodes[teamId])
      {
        await fetchJoinCodes(teamId);
      }
    }

    setShowJoinCodes(prev => ({ ...prev, [teamId]: !isShowing }));
  };

  const copyToClipboard = async (text: string) =>
  {
    try
    {
      await navigator.clipboard.writeText(text);
      // Could show a temporary toast message here
      alert('Join code copied to clipboard!');
    }
    catch (err)
    {
      console.error('Failed to copy to clipboard:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('Join code copied to clipboard!');
    }
  };

  const handleCreateJoinCode = async (teamId: string) =>
  {
    if (!newJoinCodeRole.trim())
    {
      alert('Please select a role');
      return;
    }

    try
    {
      const token = (await import('../lib/supabase')).supabase.auth.getSession();
      const session = await token;

      if (!session.data.session?.access_token)
      {
        throw new Error('No access token');
      }

      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/teams/${teamId}/join-codes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.data.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          team_role: newJoinCodeRole,
          expires_at: newJoinCodeExpires || null,
        }),
      });

      if (!response.ok)
      {
        throw new Error('Failed to create join code');
      }

      // Refresh join codes
      await fetchJoinCodes(teamId);
      
      // Reset form
      setShowCreateJoinCode(null);
      setNewJoinCodeRole('');
      setNewJoinCodeExpires('');
      
      alert('Join code created successfully!');
    }
    catch (err)
    {
      alert('Failed to create join code');
      console.error('Error creating join code:', err);
    }
  };

  const getGuardianJoinCode = (teamCodes: JoinCode[]) =>
  {
    return teamCodes.find(code => code.team_role === 'guardian' && !code.expires_at);
  };

  const getNonGuardianJoinCodes = (teamCodes: JoinCode[]) =>
  {
    return teamCodes.filter(code => code.team_role !== 'guardian');
  };

  const handleDeleteTeam = async (teamId: string) =>
  {
    if (!confirm('Are you sure you want to delete this team? This will also delete all games, coaching points, and join codes.'))
    {
      return;
    }

    try
    {
      const token = (await import('../lib/supabase')).supabase.auth.getSession();
      const session = await token;

      if (!session.data.session?.access_token)
      {
        throw new Error('No access token');
      }

      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/teams/${teamId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.data.session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok)
      {
        throw new Error('Failed to delete team');
      }

      // Refresh teams list
      fetchTeams();
    }
    catch (err)
    {
      alert('Failed to delete team');
      console.error('Error deleting team:', err);
    }
  };

  // Show loading state
  if (loading)
  {
    return <div className='loading'>Loading...</div>;
  }

  return (
    <main className='dashboard-main'>
      <div className='section-header'>
        <h1 className='section-title'>My Teams</h1>
        <button onClick={handleCreateTeam} className='btn btn-primary'>
          Create Team
        </button>
      </div>

      {error && <div className='alert alert-error'>{error}</div>}

      {teams.length === 0 ?
        (
          <div className='empty-state'>
            <h3>No Teams Yet</h3>
            <p>Create your first team to get started!</p>
            <button onClick={handleCreateTeam} className='btn btn-primary' style={{ marginTop: 'var(--space-md)' }}>
              Create Your First Team
            </button>
          </div>
        ) :
        (
          <div className='teams-grid'>
            {teams.map((teamMembership) => (
              <div key={teamMembership.teams.id} className='team-card' style={{ position: 'relative' }}>
                {/* Floating Action Icons */}
                {(teamMembership.role === 'coach' || teamMembership.role === 'admin') && (
                  <div className='floating-actions team'>
                    <button
                      className='floating-action-btn edit-btn'
                      onClick={(e) =>
                      {
                        e.stopPropagation();
                        handleEditTeam(teamMembership.teams.id, teamMembership.teams.name);
                      }}
                      title='Edit team'
                      aria-label='Edit team'
                    >
                      <FaPencilAlt />
                    </button>
                    <button
                      className='floating-action-btn delete-btn'
                      onClick={(e) =>
                      {
                        e.stopPropagation();
                        handleDeleteTeam(teamMembership.teams.id);
                      }}
                      title='Delete team'
                      aria-label='Delete team'
                    >
                      <FaTrash />
                    </button>
                  </div>
                )}

                <div className='team-header'>
                  {editingTeamId === teamMembership.teams.id ?
                    (
                      <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
                        <input
                          type='text'
                          value={editingTeamName}
                          onChange={(e) => setEditingTeamName(e.target.value)}
                          className='form-input'
                          onKeyDown={(e) =>
                          {
                            if (e.key === 'Enter')
                            {
                              handleSaveTeamName(teamMembership.teams.id);
                            }
                            else if (e.key === 'Escape')
                            {
                              handleCancelEdit();
                            }
                          }}
                          autoFocus
                          style={{ flex: 1 }}
                        />
                        <button
                          onClick={() => handleSaveTeamName(teamMembership.teams.id)}
                          className='btn btn-success btn-sm'
                          title='Save'
                        >
                          ✓
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className='btn btn-error btn-sm'
                          title='Cancel'
                        >
                          ✕
                        </button>
                      </div>
                    ) :
                    (
                      <h3 className='team-name'>{teamMembership.teams.name}</h3>
                    )}
                </div>

                <p className='team-role'>Role: {teamMembership.role}</p>
                <p className='team-created'>
                  Created: {new Date(teamMembership.teams.created_at).toLocaleDateString()}
                </p>

                {/* Guardian Join Code - Always visible */}
                {joinCodes[teamMembership.teams.id] && (() => {
                  const guardianCode = getGuardianJoinCode(joinCodes[teamMembership.teams.id]);
                  return guardianCode ? (
                    <div style={{ 
                      marginTop: 'var(--space-md)', 
                      padding: 'var(--space-sm)', 
                      backgroundColor: 'var(--color-bg-secondary)', 
                      borderRadius: 'var(--border-radius)',
                      border: '1px solid var(--color-border)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <strong>Guardian Join Code:</strong>
                          <div style={{ 
                            fontFamily: 'monospace', 
                            fontSize: '1.2em', 
                            fontWeight: 'bold',
                            color: 'var(--color-primary)'
                          }}>
                            {guardianCode.code}
                          </div>
                          <small style={{ color: 'var(--color-text-secondary)' }}>
                            Never expires
                          </small>
                        </div>
                        <button
                          onClick={() => copyToClipboard(guardianCode.code)}
                          className='btn btn-secondary btn-sm'
                          title='Copy join code'
                        >
                          📋
                        </button>
                      </div>
                    </div>
                  ) : null;
                })()}

                {/* Join Code Management Button */}
                <div style={{ marginTop: 'var(--space-md)' }}>
                  <button
                    onClick={() => toggleJoinCodes(teamMembership.teams.id)}
                    className='btn btn-secondary btn-sm'
                    disabled={loadingJoinCodes[teamMembership.teams.id]}
                  >
                    {loadingJoinCodes[teamMembership.teams.id] 
                      ? 'Loading...' 
                      : showJoinCodes[teamMembership.teams.id] 
                        ? 'Hide Join Codes' 
                        : 'Show Join Codes'
                    }
                  </button>
                </div>

                {/* Join Codes Section */}
                {showJoinCodes[teamMembership.teams.id] && joinCodes[teamMembership.teams.id] && (
                  <div style={{ 
                    marginTop: 'var(--space-md)', 
                    padding: 'var(--space-sm)', 
                    backgroundColor: 'var(--color-bg-secondary)', 
                    borderRadius: 'var(--border-radius)',
                    border: '1px solid var(--color-border)'
                  }}>
                    <h4>Join Codes</h4>
                    
                    {/* Guardian Code */}
                    {(() => {
                      const guardianCode = getGuardianJoinCode(joinCodes[teamMembership.teams.id]);
                      return guardianCode ? (
                        <div style={{ 
                          marginBottom: 'var(--space-sm)', 
                          padding: 'var(--space-xs)', 
                          backgroundColor: 'var(--color-success-bg)', 
                          borderRadius: 'var(--border-radius-sm)',
                          border: '1px solid var(--color-success)'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                              <strong>{guardianCode.code}</strong> - Guardian (Permanent)
                              <br />
                              <small>Created by: {guardianCode.user_profiles.name}</small>
                            </div>
                            <button
                              onClick={() => copyToClipboard(guardianCode.code)}
                              className='btn btn-secondary btn-sm'
                            >
                              📋
                            </button>
                          </div>
                        </div>
                      ) : null;
                    })()}

                    {/* Other Join Codes */}
                    {getNonGuardianJoinCodes(joinCodes[teamMembership.teams.id]).map((code) => (
                      <div key={code.id} style={{ 
                        marginBottom: 'var(--space-sm)', 
                        padding: 'var(--space-xs)', 
                        backgroundColor: 'var(--color-bg)', 
                        borderRadius: 'var(--border-radius-sm)',
                        border: '1px solid var(--color-border)'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div>
                            <strong>{code.code}</strong> - {code.team_role || 'Any Role'}
                            <br />
                            <small>
                              Created by: {code.user_profiles.name}
                              {code.expires_at && (
                                <> | Expires: {new Date(code.expires_at).toLocaleDateString()}</>
                              )}
                            </small>
                          </div>
                          <button
                            onClick={() => copyToClipboard(code.code)}
                            className='btn btn-secondary btn-sm'
                          >
                            📋
                          </button>
                        </div>
                      </div>
                    ))}

                    {/* Create New Join Code */}
                    {(teamMembership.role === 'coach' || teamMembership.role === 'admin') && (
                      <div style={{ marginTop: 'var(--space-md)' }}>
                        {showCreateJoinCode === teamMembership.teams.id ? (
                          <div style={{ 
                            padding: 'var(--space-sm)', 
                            backgroundColor: 'var(--color-bg)', 
                            borderRadius: 'var(--border-radius-sm)',
                            border: '1px solid var(--color-border)'
                          }}>
                            <h5>Create New Join Code</h5>
                            <div style={{ marginBottom: 'var(--space-sm)' }}>
                              <label>Role:</label>
                              <select
                                value={newJoinCodeRole}
                                onChange={(e) => setNewJoinCodeRole(e.target.value)}
                                className='form-input'
                                style={{ marginTop: 'var(--space-xs)' }}
                              >
                                <option value=''>Select Role</option>
                                <option value='player'>Player</option>
                                <option value='coach'>Coach</option>
                                <option value='admin'>Admin</option>
                                <option value='guardian'>Guardian</option>
                              </select>
                            </div>
                            <div style={{ marginBottom: 'var(--space-sm)' }}>
                              <label>Expiration Date (optional):</label>
                              <input
                                type='datetime-local'
                                value={newJoinCodeExpires}
                                onChange={(e) => setNewJoinCodeExpires(e.target.value)}
                                className='form-input'
                                style={{ marginTop: 'var(--space-xs)' }}
                              />
                            </div>
                            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                              <button
                                onClick={() => handleCreateJoinCode(teamMembership.teams.id)}
                                className='btn btn-primary btn-sm'
                              >
                                Create Code
                              </button>
                              <button
                                onClick={() => setShowCreateJoinCode(null)}
                                className='btn btn-secondary btn-sm'
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setShowCreateJoinCode(teamMembership.teams.id)}
                            className='btn btn-success btn-sm'
                          >
                            + Create Join Code
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className='team-actions'>
                  <Link
                    to={`/games/${teamMembership.teams.id}`}
                    className='btn btn-primary'
                  >
                    View Games
                  </Link>
                  {(teamMembership.role === 'coach' || teamMembership.role === 'admin') && (
                    <button className='btn btn-secondary'>Manage</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
    </main>
  );
};
