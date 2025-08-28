import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getApiUrl } from '../utils/api';
import '../styles/coach-analytics.css';

interface LookupData
{
  teams: Array<{ id: string; name: string; }>;
  games: Array<{ id: string; opponent: string; date: string; team_name: string; }>;
  players: Array<{ id: string; name: string; team_name: string; }>;
  coachingPoints: Array<{ id: string; title: string; game_opponent: string; team_name: string; }>;
  coaches: Array<{ id: string; name: string; }>;
}

interface TestResult
{
  player_profile_id: string;
  player_name: string;
  point_id: string;
  point_title: string;
  game_id: string;
  team_id: string;
  team_name?: string;
  completion_percentage: number | null;
  created_at: string;
  view_source: 'direct' | 'guardian';
  guardian_id?: string;
}

interface TestSummary
{
  totalViews: number;
  directViews: number;
  guardianViews: number;
  uniquePlayers: number;
  uniquePoints: number;
  averageCompletion: number;
}

export const PlayerViewsTestPage: React.FC = () =>
{
  const [lookupData, setLookupData] = useState<LookupData | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<TestResult[] | null>(null);
  const [summary, setSummary] = useState<TestSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  // Form state
  const [teamId, setTeamId] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [coachingPointId, setCoachingPointId] = useState('');
  const [gameId, setGameId] = useState('');
  const [coachId, setCoachId] = useState('');

  // Load lookup data on component mount
  useEffect(() =>
  {
    const loadLookupData = async () =>
    {
      try
      {
        setLoadingData(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session)
        {
          setError('Please log in to access the test page');
          setLoadingData(false);
          return;
        }

        const apiUrl = getApiUrl();
        console.log('Fetching lookup data from:', `${apiUrl}/api/test/lookup-data`);

        const response = await fetch(`${apiUrl}/api/test/lookup-data`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });

        console.log('Response status:', response.status);

        if (!response.ok)
        {
          const errorText = await response.text();
          console.error('Error response:', errorText);
          throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log('Loaded lookup data:', data);

        // Sort all lists alphabetically
        const sortedData = {
          teams: (data.teams || []).sort((a: any, b: any) => a.name.localeCompare(b.name)),
          games: (data.games || []).sort((a: any, b: any) => a.opponent.localeCompare(b.opponent)),
          players: (data.players || []).sort((a: any, b: any) => a.name.localeCompare(b.name)),
          coachingPoints: (data.coachingPoints || []).sort((a: any, b: any) => a.title.localeCompare(b.title)),
          coaches: (data.coaches || []).sort((a: any, b: any) => a.name.localeCompare(b.name)),
        };

        setLookupData(sortedData);
      }
      catch (err)
      {
        console.error('Failed to load lookup data:', err);
        setError(`Failed to load lookup data: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
      finally
      {
        setLoadingData(false);
      }
    };

    loadLookupData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) =>
  {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResults(null);
    setSummary(null);

    try
    {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session)
      {
        throw new Error('Please log in to test the function');
      }

      const requestBody: any = {};
      if (teamId) requestBody.teamId = teamId;
      if (playerId) requestBody.playerId = playerId;
      if (startDate) requestBody.startDate = startDate;
      if (endDate) requestBody.endDate = endDate;
      if (coachingPointId) requestBody.coachingPointId = coachingPointId;
      if (gameId) requestBody.gameId = gameId;
      if (coachId) requestBody.coachId = coachId;

      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/players/views`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok)
      {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setResults(data.results);
      setSummary(data.summary);
    }
    catch (err)
    {
      console.error('Test failed:', err);
      setError(err instanceof Error ? err.message : 'Test failed');
    }
    finally
    {
      setLoading(false);
    }
  };

  // Helper function to get team name from team ID
  const getTeamName = (teamId: string): string =>
  {
    if (!lookupData?.teams) return 'Unknown Team';
    const team = lookupData.teams.find(t => t.id === teamId);
    return team?.name || 'Unknown Team';
  };

  const clearForm = () =>
  {
    setTeamId('');
    setPlayerId('');
    setStartDate('');
    setEndDate('');
    setCoachingPointId('');
    setGameId('');
    setCoachId('');
    setResults(null);
    setSummary(null);
    setError(null);
  };

  if (loadingData && !error)
  {
    return (
      <main className='dashboard-main'>
        <div className='section-header'>
          <h1 className='section-title'>Player Views Test Page</h1>
        </div>
        <div className='loading'>Loading test data...</div>
      </main>
    );
  }

  if (error && !lookupData)
  {
    return (
      <main className='dashboard-main'>
        <div className='section-header'>
          <h1 className='section-title'>Player Views Test Page</h1>
        </div>
        <div className='alert alert-error'>
          <h3>Error Loading Test Page</h3>
          <p>{error}</p>
          <button
            onClick={() => window.location.reload()}
            className='btn btn-error'
          >
            Retry
          </button>
        </div>
      </main>
    );
  }

  if (!lookupData)
  {
    return (
      <main className='dashboard-main'>
        <div className='section-header'>
          <h1 className='section-title'>Player Views Test Page</h1>
        </div>
        <div className='card'>
          <h3>No Test Data Available</h3>
          <p>Unable to load test data. Please check the console for more details.</p>
        </div>
      </main>
    );
  }

  return (
    <main className='dashboard-main'>
      <div className='section-header'>
        <h1 className='section-title'>Player Views Test Page</h1>
      </div>

      <div className='card intro-card'>
        <div className='stat-label'>
          Test the guardian view support function with various filter parameters. This function includes views by
          guardians for players without user accounts in engagement calculations.
        </div>
      </div>

      <div className='subcard filters-bar'>
        <form onSubmit={handleSubmit}>
          <div className='filters-grid'>
            <div className='filter-item'>
              <label className='filter-label'>Team</label>
              <select
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
              >
                <option value=''>All Teams</option>
                {lookupData.teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
              </select>
            </div>

            <div className='filter-item'>
              <label className='filter-label'>Player</label>
              <select
                value={playerId}
                onChange={(e) => setPlayerId(e.target.value)}
              >
                <option value=''>All Players</option>
                {lookupData.players.map(player => (
                  <option key={player.id} value={player.id}>
                    {player.name}
                  </option>
                ))}
              </select>
            </div>

            <div className='filter-item'>
              <label className='filter-label'>Game</label>
              <select
                value={gameId}
                onChange={(e) => setGameId(e.target.value)}
              >
                <option value=''>All Games</option>
                {lookupData.games.map(game => (
                  <option key={game.id} value={game.id}>
                    {game.team_name} vs {game.opponent} ({new Date(game.date).toLocaleDateString()})
                  </option>
                ))}
              </select>
            </div>

            <div className='filter-item'>
              <label className='filter-label'>Coaching Point</label>
              <select
                value={coachingPointId}
                onChange={(e) => setCoachingPointId(e.target.value)}
              >
                <option value=''>All Coaching Points</option>
                {lookupData.coachingPoints.map(point => (
                  <option key={point.id} value={point.id}>
                    {point.title} (vs {point.game_opponent}) - {point.team_name}
                  </option>
                ))}
              </select>
            </div>

            <div className='filter-item'>
              <label className='filter-label'>Coach</label>
              <select
                value={coachId}
                onChange={(e) => setCoachId(e.target.value)}
              >
                <option value=''>All Coaches</option>
                {lookupData.coaches.map(coach => <option key={coach.id} value={coach.id}>{coach.name}</option>)}
              </select>
            </div>

            <div className='filter-item'>
              <label className='filter-label'>Start Date</label>
              <input
                type='date'
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className='filter-item'>
              <label className='filter-label'>End Date</label>
              <input
                type='date'
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div className='filter-actions'>
              <button
                type='submit'
                disabled={loading}
                className='btn btn-primary'
              >
                {loading ? 'Testing...' : 'Test Function'}
              </button>
              <button
                type='button'
                onClick={clearForm}
                className='btn btn-secondary'
              >
                Clear Form
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Error Display */}
      {error && (
        <div className='alert alert-error'>
          <h3>Error</h3>
          <p>{error}</p>
        </div>
      )}

      {/* Summary Display */}
      {summary && (
        <div className='card'>
          <div className='subcard-header'>Test Results Summary</div>
          <div className='kpi-grid'>
            <div className='kpi-card'>
              <div className='kpi-label'>Total Views</div>
              <div className='kpi-value'>{summary.totalViews}</div>
            </div>
            <div className='kpi-card'>
              <div className='kpi-label'>Direct Views</div>
              <div className='kpi-value'>{summary.directViews}</div>
            </div>
            <div className='kpi-card'>
              <div className='kpi-label'>Guardian Views</div>
              <div className='kpi-value'>{summary.guardianViews}</div>
            </div>
            <div className='kpi-card'>
              <div className='kpi-label'>Unique Players</div>
              <div className='kpi-value'>{summary.uniquePlayers}</div>
            </div>
            <div className='kpi-card'>
              <div className='kpi-label'>Unique Points</div>
              <div className='kpi-value'>{summary.uniquePoints}</div>
            </div>
            <div className='kpi-card'>
              <div className='kpi-label'>Avg Completion</div>
              <div className='kpi-value'>{summary.averageCompletion}%</div>
            </div>
          </div>
        </div>
      )}

      {/* Results Display */}
      {results && results.length > 0 && (
        <div className='subcard'>
          <div className='subcard-header'>Detailed Results ({results.length} records)</div>
          <div className='engagement-table'>
            <div className='engagement-head'>
              <div>Player</div>
              <div>Team</div>
              <div>Coaching Point</div>
              <div className='text-right'>Completion %</div>
              <div className='text-right'>View Source</div>
              <div className='text-right'>Date</div>
            </div>
            <div className='engagement-body'>
              {results.map((result, index) => (
                <div key={index} className='engagement-row'>
                  <div className='clamp-1'>{result.player_name}</div>
                  <div className='clamp-1'>{getTeamName(result.team_id)}</div>
                  <div className='clamp-1'>{result.point_title}</div>
                  <div className='text-right'>
                    {result.completion_percentage !== null ? `${result.completion_percentage}%` : 'N/A'}
                  </div>
                  <div className='text-right'>
                    <span className={`mini-badge ${result.view_source === 'direct' ? 'direct' : 'guardian'}`}>
                      {result.view_source}
                    </span>
                  </div>
                  <div className='text-right'>
                    {new Date(result.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {results && results.length === 0 && (
        <div className='card'>
          <div className='empty-block'>No view data found for the specified criteria.</div>
        </div>
      )}
    </main>
  );
};

export default PlayerViewsTestPage;
