import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreateTeamModal } from '../components/CreateTeamModal';
import { TeamsGrid } from '../components/TeamsGrid';
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

interface CoachingPointAnalytics
{
  id: string;
  title: string;
  timestamp: number | string | null;
  uniqueViewers: number;
  totalViews: number;
  avgCompletion: number;
  completedViews: number;
}

export const DashboardPage: React.FC = () =>
{
  const navigate = useNavigate();

  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [teamToEdit, setTeamToEdit] = useState<{ id: string; name: string; } | null>(null);

  // Team analytics (kept on Dashboard)
  const [analyticsByTeam, setAnalyticsByTeam] = useState<Record<string, CoachingPointAnalytics[]>>({});
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

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
      const { supabase } = await import('../lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      if (!accessToken)
      {
        throw new Error('No access token');
      }

      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/teams`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
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

  const fetchAnalyticsForCoachTeams = async () =>
  {
    const coachTeams = teams.filter(t => t.role === 'coach');
    if (coachTeams.length === 0) return;

    try
    {
      setAnalyticsLoading(true);
      setAnalyticsError(null);

      const { supabase } = await import('../lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      if (!accessToken)
      {
        throw new Error('No access token');
      }

      const apiUrl = getApiUrl();

      const results = await Promise.all(coachTeams.map(async (t) =>
      {
        const res = await fetch(`${apiUrl}/api/teams/${t.teams.id}/view-analytics`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (!res.ok)
        {
          const errText = await res.text();
          throw new Error(`Failed to fetch analytics for team ${t.teams.name}: ${errText}`);
        }

        const data = await res.json();
        return { teamId: t.teams.id, data: data as CoachingPointAnalytics[] };
      }));

      const byTeam: Record<string, CoachingPointAnalytics[]> = {};
      for (const r of results)
      {
        byTeam[r.teamId] = r.data;
      }
      setAnalyticsByTeam(byTeam);
    }
    catch (e)
    {
      console.error('Error fetching analytics:', e);
      setAnalyticsError('Failed to load coaching analytics');
    }
    finally
    {
      setAnalyticsLoading(false);
    }
  };

  const computeTotals = (arr: CoachingPointAnalytics[]) =>
  {
    const totalPoints = arr.length;
    const totalUniqueViewers = arr.reduce((sum, p) => sum + (p.uniqueViewers || 0), 0);
    const totalViews = arr.reduce((sum, p) => sum + (p.totalViews || 0), 0);
    const totalCompletedViews = arr.reduce((sum, p) => sum + (p.completedViews || 0), 0);
    const avgCompletion = totalViews > 0
      ? Math.round(arr.reduce((sum, p) => sum + ((p.avgCompletion || 0) * (p.totalViews || 0)), 0) / totalViews)
      : 0;

    return { totalPoints, totalUniqueViewers, totalViews, totalCompletedViews, avgCompletion };
  };

  useEffect(() =>
  {
    if (teams.length === 0) return;
    const coachTeams = teams.filter(t => t.role === 'coach');
    if (coachTeams.length === 0) return;
    // Only fetch team analytics here; Coach Overview was moved to CoachAnalyticsPage
    fetchAnalyticsForCoachTeams();
  }, [teams]);

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

  const coachTeams = teams.filter(t => t.role === 'coach');
  const allAnalytics = Object.values(analyticsByTeam).flat();
  const totals = computeTotals(allAnalytics);

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

      {/* Coach Team Analytics (Coach Overview moved to /analytics) */}
      {coachTeams.length > 0 ? (
        <div style={{ marginBottom: 'var(--space-2xl)' }}>
          <h2 style={{ marginBottom: 'var(--space-lg)' }}>Coaching Analytics</h2>

          {analyticsLoading && <div className='loading'>Loading coaching analytics...</div>}
          {analyticsError && <div className='alert alert-error'>{analyticsError}</div>}

          {!analyticsLoading && !analyticsError && (
            <>
              <div className='card'>
                <h3 className='mt-0 mb-md'>All Teams (Aggregate)</h3>
                <div className='grid grid-3'>
                  <div className='card card-compact'>
                    <div className='stat'>
                      <div className='stat-value'>{totals.totalPoints}</div>
                      <div className='stat-label'>Coaching Points</div>
                    </div>
                  </div>
                  <div className='card card-compact'>
                    <div className='stat'>
                      <div className='stat-value'>{totals.totalUniqueViewers}</div>
                      <div className='stat-label'>Unique Viewers</div>
                    </div>
                  </div>
                  <div className='card card-compact'>
                    <div className='stat'>
                      <div className='stat-value'>{totals.totalViews}</div>
                      <div className='stat-label'>Total Views</div>
                    </div>
                  </div>
                  <div className='card card-compact'>
                    <div className='stat'>
                      <div className='stat-value'>{totals.avgCompletion}%</div>
                      <div className='stat-label'>Avg Completion</div>
                    </div>
                  </div>
                  <div className='card card-compact'>
                    <div className='stat'>
                      <div className='stat-value'>{totals.totalCompletedViews}</div>
                      <div className='stat-label'>Completed Views</div>
                    </div>
                  </div>
                </div>
              </div>

              {coachTeams.map((t) =>
              {
                const teamAnalytics = analyticsByTeam[t.teams.id] || [];
                const teamTotals = computeTotals(teamAnalytics);

                return (
                  <div key={t.teams.id} className='card'>
                    <h3 className='mt-0 mb-md'>{t.teams.name}</h3>
                    <div className='grid grid-3'>
                      <div className='card card-compact'>
                        <div className='stat'>
                          <div className='stat-value'>{teamTotals.totalPoints}</div>
                          <div className='stat-label'>Coaching Points</div>
                        </div>
                      </div>
                      <div className='card card-compact'>
                        <div className='stat'>
                          <div className='stat-value'>{teamTotals.totalUniqueViewers}</div>
                          <div className='stat-label'>Unique Viewers</div>
                        </div>
                      </div>
                      <div className='card card-compact'>
                        <div className='stat'>
                          <div className='stat-value'>{teamTotals.totalViews}</div>
                          <div className='stat-label'>Total Views</div>
                        </div>
                      </div>
                      <div className='card card-compact'>
                        <div className='stat'>
                          <div className='stat-value'>{teamTotals.avgCompletion}%</div>
                          <div className='stat-label'>Avg Completion</div>
                        </div>
                      </div>
                      <div className='card card-compact'>
                        <div className='stat'>
                          <div className='stat-value'>{teamTotals.totalCompletedViews}</div>
                          <div className='stat-label'>Completed Views</div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      ) : (
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
      )}

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
