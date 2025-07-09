import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreateTeamModal } from '../components/CreateTeamModal';
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
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [teamToEdit, setTeamToEdit] = useState<{ id: string; name: string; } | null>(null);

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

  const handleCreateTeam = () =>
  {
    setTeamToEdit(null);
    setIsCreateModalOpen(true);
  };

  const handleCreateModalClose = () =>
  {
    setIsCreateModalOpen(false);
    setTeamToEdit(null);
  };

  const handleCreateModalSuccess = () =>
  {
    fetchTeams();
  };

  const handleEditTeam = (teamId: string, currentName: string) =>
  {
    setTeamToEdit({ id: teamId, name: currentName });
    setIsCreateModalOpen(true);
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
            />
          )}
      </div>

      <CreateTeamModal
        isOpen={isCreateModalOpen}
        onClose={handleCreateModalClose}
        onSuccess={handleCreateModalSuccess}
        teamToEdit={teamToEdit}
      />
    </main>
  );
};
