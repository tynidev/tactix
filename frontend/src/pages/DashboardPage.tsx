import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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

export const DashboardPage: React.FC = () =>
{
  const {} = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editingTeamName, setEditingTeamName] = useState('');

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

  // Show loading state
  if (loading)
  {
    return <div className='loading'>Loading...</div>;
  }

  return (
    <main className='dashboard-main'>
      <div className='section-header'>
        <h1 className='section-title'>Dashboard</h1>
        <button onClick={handleCreateTeam} className='btn btn-primary'>
          Create Team
        </button>
      </div>

      {error && <div className='alert alert-error'>{error}</div>}

      {/* Quick Stats */}
      <div className='grid grid-3' style={{ marginBottom: 'var(--space-2xl)' }}>
        <div className='card card-compact'>
          <div className='stat'>
            <div className='stat-value'>{teams.length}</div>
            <div className='stat-label'>Teams</div>
          </div>
        </div>
        <div className='card card-compact'>
          <div className='stat'>
            <div className='stat-value'>0</div>
            <div className='stat-label'>Games Analyzed</div>
          </div>
        </div>
        <div className='card card-compact'>
          <div className='stat'>
            <div className='stat-value'>0</div>
            <div className='stat-label'>Active Sessions</div>
          </div>
        </div>
      </div>

      {/* Recent Teams */}
      <div style={{ marginBottom: 'var(--space-2xl)' }}>
        <h2 style={{ marginBottom: 'var(--space-lg)' }}>My Teams</h2>

        {teams.length === 0 ?
          (
            <div className='empty-state'>
              <p>No teams found. Create your first team to get started!</p>
              <button onClick={handleCreateTeam} className='btn btn-primary' style={{ marginTop: 'var(--space-md)' }}>
                Create Your First Team
              </button>
            </div>
          ) :
          (
            <div className='teams-grid'>
              {teams.map((teamMembership) => (
                <div key={teamMembership.teams.id} className='team-card'>
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
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <h3 className='team-name'>{teamMembership.teams.name}</h3>
                          {(teamMembership.role === 'coach' || teamMembership.role === 'admin') && (
                            <button
                              onClick={() => handleEditTeam(teamMembership.teams.id, teamMembership.teams.name)}
                              className='btn btn-secondary btn-sm'
                              title='Edit team name'
                              style={{ padding: '4px 8px' }}
                            >
                              ✏️
                            </button>
                          )}
                        </div>
                      )}
                  </div>

                  <p className='team-role'>Role: {teamMembership.role}</p>
                  <p className='team-created'>
                    Created: {new Date(teamMembership.teams.created_at).toLocaleDateString()}
                  </p>

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
      </div>
    </main>
  );
};
