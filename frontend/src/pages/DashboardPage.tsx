import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TeamsGrid } from '../components/TeamsGrid';
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
  const navigate = useNavigate();
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
            <TeamsGrid
              teams={teams}
              variant='full'
              onTeamClick={(teamId) => navigate(`/team/${teamId}`)}
              onEditTeam={handleEditTeam}
              onSaveTeamName={(teamId) => handleSaveTeamName(teamId)}
              onCancelEdit={handleCancelEdit}
              editingTeamId={editingTeamId}
              editingTeamName={editingTeamName}
              onEditingTeamNameChange={setEditingTeamName}
            />
          )}
      </div>
    </main>
  );
};
