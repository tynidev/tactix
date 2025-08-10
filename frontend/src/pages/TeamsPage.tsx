import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ConfirmationDialog } from '../components/ConfirmationDialog';
import { CreateTeamModal } from '../components/CreateTeamModal';
import { JoinTeamModal } from '../components/JoinTeamModal';
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
    player_count: number;
    game_count: number;
    reviewed_games_count: number;
    coaches: Array<{ name: string; }>;
  };
}

export const TeamsPage: React.FC = () =>
{
  const {} = useAuth();
  const navigate = useNavigate();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [teamToEdit, setTeamToEdit] = useState<{ id: string; name: string; } | null>(null);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    teamId: string | null;
    teamName: string;
    loading: boolean;
  }>({
    isOpen: false,
    teamId: null,
    teamName: '',
    loading: false,
  });

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

  const handleOpenJoinTeam = () =>
  {
    setIsJoinModalOpen(true);
  };

  const handleJoinModalClose = () =>
  {
    setIsJoinModalOpen(false);
  };

  const handleJoinModalSuccess = () =>
  {
    fetchTeams();
    setIsJoinModalOpen(false);
  };

  const handleEditTeam = (teamId: string, currentName: string) =>
  {
    setTeamToEdit({ id: teamId, name: currentName });
    setIsCreateModalOpen(true);
  };

  const handleDeleteTeam = (teamId: string) =>
  {
    const team = teams.find(t => t.teams.id === teamId);
    const teamName = team?.teams.name || 'this team';

    setDeleteConfirmation({
      isOpen: true,
      teamId,
      teamName,
      loading: false,
    });
  };

  const handleDeleteConfirmationClose = () =>
  {
    setDeleteConfirmation({
      isOpen: false,
      teamId: null,
      teamName: '',
      loading: false,
    });
  };

  const handleDeleteConfirmationConfirm = async () =>
  {
    if (!deleteConfirmation.teamId) return;

    setDeleteConfirmation(prev => ({ ...prev, loading: true }));

    try
    {
      const token = (await import('../lib/supabase')).supabase.auth.getSession();
      const session = await token;

      if (!session.data.session?.access_token)
      {
        throw new Error('No access token');
      }

      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/teams/${deleteConfirmation.teamId}`, {
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

      // Close confirmation dialog
      handleDeleteConfirmationClose();

      // Refresh teams list
      fetchTeams();
    }
    catch (err)
    {
      setDeleteConfirmation(prev => ({ ...prev, loading: false }));
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
        <div className='header-actions' style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          <button onClick={handleCreateTeam} className='btn btn-secondary'>
            Create Team
          </button>
          <button onClick={handleOpenJoinTeam} className='btn btn-secondary'>
            Join Team
          </button>
        </div>
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
          <TeamsGrid
            teams={teams}
            variant='full'
            onTeamClick={(teamId) => navigate(`/team/${teamId}`)}
            onEditTeam={handleEditTeam}
            onDeleteTeam={handleDeleteTeam}
          />
        )}

      <CreateTeamModal
        isOpen={isCreateModalOpen}
        onClose={handleCreateModalClose}
        onSuccess={handleCreateModalSuccess}
        teamToEdit={teamToEdit}
      />

      <JoinTeamModal
        isOpen={isJoinModalOpen}
        onClose={handleJoinModalClose}
        onSuccess={handleJoinModalSuccess}
      />

      <ConfirmationDialog
        isOpen={deleteConfirmation.isOpen}
        onClose={handleDeleteConfirmationClose}
        onConfirm={handleDeleteConfirmationConfirm}
        title='Delete Team'
        message={`Are you sure you want to delete "${deleteConfirmation.teamName}"? This will also delete all games, coaching points, and join codes. This action cannot be undone.`}
        confirmButtonText='Delete Team'
        variant='danger'
        loading={deleteConfirmation.loading}
      />
    </main>
  );
};
