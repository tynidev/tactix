import React, { useEffect, useMemo, useState } from 'react';
import { getApiUrl } from '../utils/api';

interface CoachOverview
{
  totals: {
    totalPoints: number;
    totalViews: number;
    percentAcknowledged: number;
    avgCompletionPercent: number;
  };
  engagementOverTime: { date: string; views: number; }[];
  topPoints: {
    pointId: string;
    title: string;
    game: { id: string; opponent: string; date: string; } | null;
    views: number;
    avgCompletionPercent: number;
  }[];
  bottomPoints: {
    pointId: string;
    title: string;
    game: { id: string; opponent: string; date: string; } | null;
    views: number;
    avgCompletionPercent: number;
  }[];
  topEngagedPlayer: {
    player_profile_id: string;
    name: string;
    scorePercent: number;
    ackRatePercent: number;
    completionPercent: number;
  } | null;
  lowestEngagedPlayer: {
    player_profile_id: string;
    name: string;
    scorePercent: number;
    ackRatePercent: number;
    completionPercent: number;
  } | null;
}

type TeamInfo = { id: string; name: string; };

type TeamRoleBreakdown = {
  role: 'coach' | 'player' | 'guardian' | 'admin' | string;
  totalViews: number;
  avgCompletionPercent: number;
};

type TeamAnalytics = {
  totals: {
    totalPoints: number;
    totalViews: number;
    percentAcknowledged: number;
    avgCompletionPercent: number;
  };
  perRoleBreakdown: TeamRoleBreakdown[];
  engagementHeatmap: { dow: number; hour: number; views: number; }[];
  topPlayers: {
    player_profile_id: string;
    name: string;
    scorePercent: number;
    ackRatePercent: number;
    completionPercent: number;
  }[];
  gamesMostViewed: { id: string; opponent: string; date: string; views: number; }[];
  gamesLeastViewed: { id: string; opponent: string; date: string; views: number; }[];
};

type GameListItem = {
  id: string;
  team_id: string;
  opponent: string;
  date: string;
  team_name: string;
  user_role: string;
};

type GameAnalytics = {
  game: { id: string; opponent: string; date: string; };
  numberOfCoachingPoints: number;
  totalViews: number;
  uniqueViewers: number;
  percentPointsAcknowledged: number;
  avgCompletionPercent: number;
  perPointEngagement: {
    pointId: string;
    title: string;
    taggedPlayers: number;
    views: number;
    avgCompletionPercent: number;
    percentAckd: number;
    lastViewedAt: string | null;
  }[];
  viewTimeline: { pointId: string; created_at: string; daysSinceGame: number | null; }[];
  pointTypeBreakdown: { label: string; points: number; views: number; }[];
};

type PlayerAnalytics = {
  player: { id: string; name: string; };
  totalCoachingPointsTagged: number;
  percentViewed: number;
  percentAcknowledged: number;
  avgCompletionPercent: number;
  avgTimeToFirstViewHours: number | null;
  avgTimeToAcknowledgeHours: number | null;
  engagementOverTime: { date: string; views: number; }[];
  mostViewedTaggedPoints: {
    pointId: string;
    title: string;
    game: { id: string; opponent: string; date: string; } | null;
    views: number;
    avgCompletionPercent: number;
  }[];
  leastViewedTaggedPoints: {
    pointId: string;
    title: string;
    game: { id: string; opponent: string; date: string; } | null;
    views: number;
    avgCompletionPercent: number;
  }[];
};

type CoachingPointDetail = {
  coachingPoint: {
    id: string;
    title: string;
    feedback: string;
    timestamp: number;
    duration: number;
    created_at: string;
    author: string;
    game: {
      id: string;
      opponent: string;
      date: string;
      team_name: string;
    };
  };
  taggedPlayers: {
    player_id: string;
    name: string;
    view_count: number;
    first_viewed_at: string | null;
    last_viewed_at: string | null;
    latest_completion_percent: number;
    acknowledged: boolean;
    ack_at: string | null;
    ack_notes: string | null;
  }[];
  totalViews: number;
  uniqueViewers: number;
  completionDistribution: {
    '0-25%': number;
    '25-50%': number;
    '50-75%': number;
    '75-100%': number;
  };
  viewEventsTimeline: {
    event_type: string;
    timestamp: number;
    event_data: any;
    created_at: string;
  }[];
  acknowledgmentNotes: {
    player_name: string;
    notes: string;
    ack_at: string;
  }[];
};

const roleOrder = ['coach', 'player', 'guardian', 'admin'];

function Heatmap({ data }: { data: { dow: number; hour: number; views: number; }[]; })
{
  // Build 7x24 matrix of views
  const matrix = useMemo(() =>
  {
    const m: number[][] = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
    data.forEach(d =>
    {
      if (d.dow >= 0 && d.dow <= 6 && d.hour >= 0 && d.hour <= 23)
      {
        m[d.dow][d.hour] = d.views || 0;
      }
    });
    return m;
  }, [data]);

  const maxVal = useMemo(() =>
  {
    let max = 0;
    matrix.forEach(row => row.forEach(v => { if (v > max) max = v; }));
    return max || 1;
  }, [matrix]);

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div>
      <div className='stat-label' style={{ marginBottom: 8 }}>Engagement Heatmap (UTC)</div>
      <div style={{ display: 'grid', gridTemplateColumns: '40px repeat(24, 1fr)', gap: 2, alignItems: 'center' }}>
        {/* Header row */}
        <div></div>
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} className='stat-label' style={{ textAlign: 'center', fontSize: 10 }}>{h}</div>
        ))}
        {matrix.map((row, dow) => (
          <React.Fragment key={dow}>
            <div className='stat-label' style={{ fontSize: 12 }}>{dayNames[dow]}</div>
            {row.map((v, h) =>
            {
              const intensity = Math.min(1, v / maxVal);
              const bg = `rgba(30, 136, 229, ${0.08 + intensity * 0.4})`;
              const border = `rgba(0,0,0,0.05)`;
              return (
                <div
                  key={`${dow}-${h}`}
                  title={`${dayNames[dow]} @ ${h}:00 — ${v} views`}
                  style={{
                    height: 16,
                    border: `1px solid ${border}`,
                    backgroundColor: v > 0 ? bg : 'transparent',
                  }}
                />
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function TimelineBars({ points }: { points: { day: number; views: number; }[]; })
{
  const maxViews = points.reduce((m, p) => Math.max(m, p.views), 0) || 1;
  return (
    <div>
      <div className='stat-label' style={{ marginBottom: 8 }}>Views after game date (days since game)</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(40px, 1fr))', gap: 6 }}>
        {points.map(p => (
          <div key={p.day} className='card card-compact' title={`${p.day}d: ${p.views} views`}>
            <div className='stat' style={{ alignItems: 'stretch' }}>
              <div className='stat-label' style={{ textAlign: 'center' }}>{p.day}</div>
              <div style={{ height: 40, background: 'var(--surface-2)', position: 'relative' }}>
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: `${(p.views / maxViews) * 100}%`,
                  background: 'rgba(30,136,229,0.6)',
                }} />
              </div>
              <div className='stat-label' style={{ textAlign: 'center' }}>{p.views}</div>
            </div>
          </div>
        ))}
        {points.length === 0 && <div className='stat-label'>No timeline data</div>}
      </div>
    </div>
  );
}

export const CoachAnalyticsPage: React.FC = () =>
{
  const [selectedTab, setSelectedTab] = useState<'overview' | 'teams' | 'games' | 'players' | 'points'>('overview');

  // Coach overview states
  const [coachOverview, setCoachOverview] = useState<CoachOverview | null>(null);
  const [coachOverviewLoading, setCoachOverviewLoading] = useState(false);
  const [coachOverviewError, setCoachOverviewError] = useState<string | null>(null);

  // Team-level analytics states
  const [coachTeams, setCoachTeams] = useState<TeamInfo[]>([]);
  const [teamAnalytics, setTeamAnalytics] = useState<Record<string, TeamAnalytics>>({});
  const [teamAnalyticsLoading, setTeamAnalyticsLoading] = useState(false);
  const [teamAnalyticsError, setTeamAnalyticsError] = useState<string | null>(null);

  // Game-level states
  const [coachGames, setCoachGames] = useState<GameListItem[]>([]);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [gamesError, setGamesError] = useState<string | null>(null);
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>('all');
  const [selectedGameId, setSelectedGameId] = useState<string>('');
  const [gameAnalytics, setGameAnalytics] = useState<GameAnalytics | null>(null);
  const [gameAnalyticsLoading, setGameAnalyticsLoading] = useState(false);
  const [gameAnalyticsError, setGameAnalyticsError] = useState<string | null>(null);

  // Player-level states
  const [coachPlayers, setCoachPlayers] = useState<{ id: string; name: string; team_name: string; }[]>([]);
  const [playersLoading, setPlayersLoading] = useState(false);
  const [playersError, setPlayersError] = useState<string | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');
  const [playerAnalytics, setPlayerAnalytics] = useState<PlayerAnalytics | null>(null);
  const [playerAnalyticsLoading, setPlayerAnalyticsLoading] = useState(false);
  const [playerAnalyticsError, setPlayerAnalyticsError] = useState<string | null>(null);

  // Coaching Point Detail states
  const [coachingPoints, setCoachingPoints] = useState<{ id: string; title: string; game_opponent: string; game_date: string; team_name: string; }[]>([]);
  const [pointsLoading, setPointsLoading] = useState(false);
  const [pointsError, setPointsError] = useState<string | null>(null);
  const [selectedPointId, setSelectedPointId] = useState<string>('');
  const [pointDetail, setPointDetail] = useState<CoachingPointDetail | null>(null);
  const [pointDetailLoading, setPointDetailLoading] = useState(false);
  const [pointDetailError, setPointDetailError] = useState<string | null>(null);

  useEffect(() =>
  {
    document.body.className = 'dashboard-mode';
    fetchCoachOverview();
    fetchTeamsAndAnalytics();
    fetchCoachGames();
    fetchCoachPlayers();
    fetchCoachingPoints();

    return () =>
    {
      document.body.className = '';
    };
  }, []);

  const fetchCoachOverview = async () =>
  {
    try
    {
      setCoachOverviewLoading(true);
      setCoachOverviewError(null);

      const { supabase } = await import('../lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) { throw new Error('No access token'); }

      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/api/analytics/coach-overview`, {
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      });

      if (!res.ok)
      {
        const txt = await res.text();
        throw new Error(txt || 'Failed to fetch coach overview');
      }

      const data = await res.json();
      setCoachOverview(data as CoachOverview);
    }
    catch (e)
    {
      console.error('Error fetching coach overview:', e);
      setCoachOverviewError('Failed to load coach overview');
    }
    finally
    {
      setCoachOverviewLoading(false);
    }
  };

  const fetchTeamsAndAnalytics = async () =>
  {
    try
    {
      setTeamAnalyticsLoading(true);
      setTeamAnalyticsError(null);

      const { supabase } = await import('../lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('No access token');

      const apiUrl = getApiUrl();

      // Get teams where user is coach/admin
      const teamsResp = await fetch(`${apiUrl}/api/teams`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (!teamsResp.ok)
      {
        const t = await teamsResp.text();
        throw new Error(t || 'Failed to load teams');
      }
      const memberships = await teamsResp.json();
      const coachTeamsList: TeamInfo[] = (memberships || [])
        .filter((m: any) => m.role === 'coach' || m.role === 'admin')
        .map((m: any) => ({ id: m.teams.id as string, name: m.teams.name as string }));

      setCoachTeams(coachTeamsList);

      if (coachTeamsList.length === 0)
      {
        setTeamAnalytics({});
        return;
      }

      // Fetch analytics per team concurrently
      const pairs = await Promise.all(coachTeamsList.map(async (t) =>
      {
        const r = await fetch(`${apiUrl}/api/analytics/team/${t.id}`, {
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
        if (!r.ok)
        {
          const text = await r.text();
          throw new Error(text || `Failed to load analytics for ${t.name}`);
        }
        const data = await r.json() as TeamAnalytics;
        return [t.id, data] as const;
      }));

      setTeamAnalytics(Object.fromEntries(pairs));
    }
    catch (e)
    {
      console.error('Error fetching team analytics:', e);
      setTeamAnalyticsError('Failed to load team analytics');
    }
    finally
    {
      setTeamAnalyticsLoading(false);
    }
  };

  const fetchCoachGames = async () =>
  {
    try
    {
      setGamesLoading(true);
      setGamesError(null);

      const { supabase } = await import('../lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('No access token');

      const apiUrl = getApiUrl();
      const r = await fetch(`${apiUrl}/api/games`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (!r.ok)
      {
        const t = await r.text();
        throw new Error(t || 'Failed to load games');
      }
      const data = await r.json();

      // Filter to games where user role is coach/admin
      const list: GameListItem[] = (data || [])
        .filter((g: any) => g.user_role === 'coach' || g.user_role === 'admin')
        .map((g: any) => ({
          id: g.id as string,
          team_id: g.team_id as string,
          opponent: g.opponent as string,
          date: g.date as string,
          team_name: g.teams?.name as string,
          user_role: g.user_role as string,
        }))
        .sort((a: GameListItem, b: GameListItem) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setCoachGames(list);

      // Preselect the most recent game
      if (list.length > 0)
      {
        setSelectedGameId(list[0].id);
        setSelectedTeamFilter('all');
        // Fetch analytics for preselected game
        fetchGameAnalytics(list[0].id).catch(() => { /* handled in inner function */ });
      }
    }
    catch (e)
    {
      console.error('Error fetching games:', e);
      setGamesError('Failed to load games');
    }
    finally
    {
      setGamesLoading(false);
    }
  };

  const fetchGameAnalytics = async (gameId: string) =>
  {
    try
    {
      setGameAnalyticsLoading(true);
      setGameAnalyticsError(null);

      const { supabase } = await import('../lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('No access token');

      const apiUrl = getApiUrl();
      const r = await fetch(`${apiUrl}/api/analytics/game/${gameId}`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });

      if (!r.ok)
      {
        const t = await r.text();
        throw new Error(t || 'Failed to load game analytics');
      }

      const data = await r.json() as GameAnalytics;
      setGameAnalytics(data);
    }
    catch (e)
    {
      console.error('Error fetching game analytics:', e);
      setGameAnalyticsError('Failed to load game analytics');
    }
    finally
    {
      setGameAnalyticsLoading(false);
    }
  };

  const teamsFromGames = useMemo(() =>
  {
    const map = new Map<string, string>();
    coachGames.forEach(g => map.set(g.team_id, g.team_name));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [coachGames]);

  const filteredGames = useMemo(() =>
  {
    return coachGames.filter(g => selectedTeamFilter === 'all' || g.team_id === selectedTeamFilter);
  }, [coachGames, selectedTeamFilter]);

  const fetchCoachPlayers = async () =>
  {
    try
    {
      setPlayersLoading(true);
      setPlayersError(null);

      const { supabase } = await import('../lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('No access token');

      const apiUrl = getApiUrl();
      const r = await fetch(`${apiUrl}/api/analytics/coach-players`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });

      if (!r.ok)
      {
        const t = await r.text();
        throw new Error(t || 'Failed to load players');
      }

      const data = await r.json();
      setCoachPlayers(data || []);

      // Preselect the first player if available
      if (data && data.length > 0)
      {
        setSelectedPlayerId(data[0].id);
        // Fetch analytics for preselected player
        fetchPlayerAnalytics(data[0].id).catch(() => { /* handled in inner function */ });
      }
    }
    catch (e)
    {
      console.error('Error fetching players:', e);
      setPlayersError('Failed to load players');
    }
    finally
    {
      setPlayersLoading(false);
    }
  };

  const fetchPlayerAnalytics = async (playerId: string) =>
  {
    try
    {
      setPlayerAnalyticsLoading(true);
      setPlayerAnalyticsError(null);

      const { supabase } = await import('../lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('No access token');

      const apiUrl = getApiUrl();
      const r = await fetch(`${apiUrl}/api/analytics/player/${playerId}`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });

      if (!r.ok)
      {
        const t = await r.text();
        throw new Error(t || 'Failed to load player analytics');
      }

      const data = await r.json() as PlayerAnalytics;
      setPlayerAnalytics(data);
    }
    catch (e)
    {
      console.error('Error fetching player analytics:', e);
      setPlayerAnalyticsError('Failed to load player analytics');
    }
    finally
    {
      setPlayerAnalyticsLoading(false);
    }
  };

  const fetchCoachingPoints = async () =>
  {
    try
    {
      setPointsLoading(true);
      setPointsError(null);

      const { supabase } = await import('../lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('No access token');

      const apiUrl = getApiUrl();
      const r = await fetch(`${apiUrl}/api/analytics/coaching-points`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });

      if (!r.ok)
      {
        const t = await r.text();
        throw new Error(t || 'Failed to load coaching points');
      }

      const data = await r.json();
      setCoachingPoints(data || []);

      // Preselect the first coaching point if available
      if (data && data.length > 0)
      {
        setSelectedPointId(data[0].id);
        // Fetch details for preselected point
        fetchPointDetail(data[0].id).catch(() => { /* handled in inner function */ });
      }
    }
    catch (e)
    {
      console.error('Error fetching coaching points:', e);
      setPointsError('Failed to load coaching points');
    }
    finally
    {
      setPointsLoading(false);
    }
  };

  const fetchPointDetail = async (pointId: string) =>
  {
    try
    {
      setPointDetailLoading(true);
      setPointDetailError(null);

      const { supabase } = await import('../lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('No access token');

      const apiUrl = getApiUrl();
      const r = await fetch(`${apiUrl}/api/analytics/coaching-point/${pointId}`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });

      if (!r.ok)
      {
        const t = await r.text();
        throw new Error(t || 'Failed to load coaching point details');
      }

      const data = await r.json() as CoachingPointDetail;
      setPointDetail(data);
    }
    catch (e)
    {
      console.error('Error fetching coaching point details:', e);
      setPointDetailError('Failed to load coaching point details');
    }
    finally
    {
      setPointDetailLoading(false);
    }
  };

  const timelineDayCounts = useMemo(() =>
  {
    if (!gameAnalytics?.viewTimeline) return [];
    const counter = new Map<number, number>();
    gameAnalytics.viewTimeline.forEach(ev =>
    {
      if (typeof ev.daysSinceGame === 'number' && !Number.isNaN(ev.daysSinceGame))
      {
        counter.set(ev.daysSinceGame, (counter.get(ev.daysSinceGame) || 0) + 1);
      }
    });
    const arr = Array.from(counter.entries()).map(([day, views]) => ({ day, views })) as { day: number; views: number; }[];
    return arr.sort((a, b) => a.day - b.day);
  }, [gameAnalytics]);

  return (
    <main className='dashboard-main'>
      <div className='section-header' style={{ alignItems: 'center', gap: 'var(--space-sm)' }}>
        <h1 className='section-title' style={{ marginBottom: 0 }}>Coach Analytics</h1>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button
            className={`btn ${selectedTab === 'overview' ? 'btn-primary' : ''}`}
            onClick={() => setSelectedTab('overview')}
          >
            Overview
          </button>
          <button
            className={`btn ${selectedTab === 'teams' ? 'btn-primary' : ''}`}
            onClick={() => setSelectedTab('teams')}
          >
            Teams
          </button>
          <button
            className={`btn ${selectedTab === 'games' ? 'btn-primary' : ''}`}
            onClick={() => setSelectedTab('games')}
          >
            Games
          </button>
          <button
            className={`btn ${selectedTab === 'players' ? 'btn-primary' : ''}`}
            onClick={() => setSelectedTab('players')}
          >
            Players
          </button>
          <button
            className={`btn ${selectedTab === 'points' ? 'btn-primary' : ''}`}
            onClick={() => setSelectedTab('points')}
          >
            Coaching Points
          </button>
        </div>
      </div>

      {/* Overview Tab */}
      {selectedTab === 'overview' && (
        <>
          <div className='card' style={{ marginBottom: 'var(--space-lg)' }}>
            <div className='stat-label'>
              Compare engagement across everything you manage and see trend summaries.
            </div>
          </div>

          {coachOverviewLoading && <div className='loading'>Loading coach overview...</div>}
          {coachOverviewError && <div className='alert alert-error'>{coachOverviewError}</div>}

          {coachOverview && (
            <>
              <div className='card'>
                <h3 className='mt-0 mb-md'>Coach Overview (Last 30 days)</h3>
                <div className='grid grid-3'>
                  <div className='card card-compact'>
                    <div className='stat'>
                      <div className='stat-value'>{coachOverview.totals.totalPoints}</div>
                      <div className='stat-label'>Coaching Points</div>
                    </div>
                  </div>
                  <div className='card card-compact'>
                    <div className='stat'>
                      <div className='stat-value'>{coachOverview.totals.totalViews}</div>
                      <div className='stat-label'>Total Views</div>
                    </div>
                  </div>
                  <div className='card card-compact'>
                    <div className='stat'>
                      <div className='stat-value'>{coachOverview.totals.percentAcknowledged}%</div>
                      <div className='stat-label'>% Acknowledged</div>
                    </div>
                  </div>
                  <div className='card card-compact'>
                    <div className='stat'>
                      <div className='stat-value'>{coachOverview.totals.avgCompletionPercent}%</div>
                      <div className='stat-label'>Avg Completion</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className='grid grid-2' style={{ gap: 'var(--space-lg)', marginBottom: 'var(--space-lg)' }}>
                <div className='card'>
                  <h4 className='mt-0'>Top 5 Most Viewed Points</h4>
                  <ul className='list'>
                    {coachOverview.topPoints.map(tp => (
                      <li key={tp.pointId} className='list-item'>
                        <div className='list-item-title'>{tp.title}</div>
                        <div className='list-item-subtitle'>
                          {tp.game ? `${tp.game.opponent} (${new Date(tp.game.date).toLocaleDateString()})` : '—'} · {tp.views} views · {tp.avgCompletionPercent}%
                        </div>
                      </li>
                    ))}
                    {coachOverview.topPoints.length === 0 && <li className='list-item'>No data</li>}
                  </ul>
                </div>
                <div className='card'>
                  <h4 className='mt-0'>Bottom 5 Least Viewed Points</h4>
                  <ul className='list'>
                    {coachOverview.bottomPoints.map(tp => (
                      <li key={tp.pointId} className='list-item'>
                        <div className='list-item-title'>{tp.title}</div>
                        <div className='list-item-subtitle'>
                          {tp.game ? `${tp.game.opponent} (${new Date(tp.game.date).toLocaleDateString()})` : '—'} · {tp.views} views · {tp.avgCompletionPercent}%
                        </div>
                      </li>
                    ))}
                    {coachOverview.bottomPoints.length === 0 && <li className='list-item'>No data</li>}
                  </ul>
                </div>
              </div>

              <div className='grid grid-2' style={{ gap: 'var(--space-lg)', marginBottom: 'var(--space-lg)' }}>
                <div className='card'>
                  <h4 className='mt-0'>Top Engaged Player</h4>
                  {coachOverview.topEngagedPlayer ? (
                    <div>
                      <div className='stat-value'>{coachOverview.topEngagedPlayer.name}</div>
                      <div className='stat-label'>Score {coachOverview.topEngagedPlayer.scorePercent}% · Ack {coachOverview.topEngagedPlayer.ackRatePercent}% · Completion {coachOverview.topEngagedPlayer.completionPercent}%</div>
                    </div>
                  ) : <div>No data</div>}
                </div>
                <div className='card'>
                  <h4 className='mt-0'>Lowest Engaged Player</h4>
                  {coachOverview.lowestEngagedPlayer ? (
                    <div>
                      <div className='stat-value'>{coachOverview.lowestEngagedPlayer.name}</div>
                      <div className='stat-label'>Score {coachOverview.lowestEngagedPlayer.scorePercent}% · Ack {coachOverview.lowestEngagedPlayer.ackRatePercent}% · Completion {coachOverview.lowestEngagedPlayer.completionPercent}%</div>
                    </div>
                  ) : <div>No data</div>}
                </div>
              </div>

              <div className='card'>
                <h4 className='mt-0'>Engagement Over Time</h4>
                <div className='table'>
                  <div className='table-row table-header'>
                    <div className='table-cell'>Date</div>
                    <div className='table-cell'>Views</div>
                  </div>
                  {coachOverview.engagementOverTime.map((d) => (
                    <div key={d.date} className='table-row'>
                      <div className='table-cell'>{d.date}</div>
                      <div className='table-cell'>{d.views}</div>
                    </div>
                  ))}
                  {coachOverview.engagementOverTime.length === 0 && (
                    <div className='table-row'><div className='table-cell'>No data</div><div className='table-cell'></div></div>
                  )}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* Teams Tab */}
      {selectedTab === 'teams' && (
        <>
          <div className='card' style={{ marginBottom: 'var(--space-lg)' }}>
            <div className='stat-label'>
              Compare team engagement side-by-side: totals, heatmap, role breakdown, top players, and games by viewership.
            </div>
          </div>

          {teamAnalyticsLoading && <div className='loading'>Loading team analytics...</div>}
          {teamAnalyticsError && <div className='alert alert-error'>{teamAnalyticsError}</div>}

          {!teamAnalyticsLoading && !teamAnalyticsError && coachTeams.length === 0 && (
            <div className='card'>No coach/admin teams found.</div>
          )}

          {coachTeams.map(team =>
          {
            const a = teamAnalytics[team.id];
            return (
              <div key={team.id} className='card' style={{ marginBottom: 'var(--space-xl)' }}>
                <h3 className='mt-0 mb-md'>{team.name}</h3>

                {/* Totals */}
                <div className='grid grid-3' style={{ marginBottom: 'var(--space-lg)' }}>
                  <div className='card card-compact'>
                    <div className='stat'>
                      <div className='stat-value'>{a?.totals.totalPoints ?? 0}</div>
                      <div className='stat-label'>Total Coaching Points</div>
                    </div>
                  </div>
                  <div className='card card-compact'>
                    <div className='stat'>
                      <div className='stat-value'>{a?.totals.totalViews ?? 0}</div>
                      <div className='stat-label'>Total Views</div>
                    </div>
                  </div>
                  <div className='card card-compact'>
                    <div className='stat'>
                      <div className='stat-value'>{a?.totals.percentAcknowledged ?? 0}%</div>
                      <div className='stat-label'>% Acknowledged</div>
                    </div>
                  </div>
                  <div className='card card-compact'>
                    <div className='stat'>
                      <div className='stat-value'>{a?.totals.avgCompletionPercent ?? 0}%</div>
                      <div className='stat-label'>Avg Completion %</div>
                    </div>
                  </div>
                </div>

                <div className='grid grid-2' style={{ gap: 'var(--space-lg)', marginBottom: 'var(--space-lg)' }}>
                  {/* Per-Role Breakdown */}
                  <div className='card'>
                    <h4 className='mt-0'>Per-Role Breakdown</h4>
                    <div className='table'>
                      <div className='table-row table-header'>
                        <div className='table-cell'>Role</div>
                        <div className='table-cell'>Total Views</div>
                        <div className='table-cell'>Avg % Viewed</div>
                      </div>
                      {a?.perRoleBreakdown && a.perRoleBreakdown
                        .slice()
                        .sort((x: TeamRoleBreakdown, y: TeamRoleBreakdown) => roleOrder.indexOf(x.role) - roleOrder.indexOf(y.role))
                        .map(rb => (
                          <div key={rb.role} className='table-row'>
                            <div className='table-cell'>{rb.role}</div>
                            <div className='table-cell'>{rb.totalViews}</div>
                            <div className='table-cell'>{rb.avgCompletionPercent}%</div>
                          </div>
                        ))}
                      {(!a?.perRoleBreakdown || a.perRoleBreakdown.length === 0) && (
                        <div className='table-row'><div className='table-cell'>No data</div><div className='table-cell'></div><div className='table-cell'></div></div>
                      )}
                    </div>
                  </div>

                  {/* Engagement Heatmap */}
                  <div className='card'>
                    <h4 className='mt-0'>Engagement Heatmap</h4>
                    {a?.engagementHeatmap && a.engagementHeatmap.length > 0 ? (
                      <Heatmap data={a.engagementHeatmap} />
                    ) : (
                      <div className='stat-label'>No data</div>
                    )}
                  </div>
                </div>

                <div className='grid grid-2' style={{ gap: 'var(--space-lg)' }}>
                  {/* Top Players by Engagement */}
                  <div className='card'>
                    <h4 className='mt-0'>Top Players by Engagement</h4>
                    <ul className='list'>
                      {a?.topPlayers?.map(p => (
                        <li key={p.player_profile_id} className='list-item'>
                          <div className='list-item-title'>{p.name}</div>
                          <div className='list-item-subtitle'>
                            Score {p.scorePercent}% · Ack {p.ackRatePercent}% · Completion {p.completionPercent}%
                          </div>
                        </li>
                      ))}
                      {(!a?.topPlayers || a.topPlayers.length === 0) && <li className='list-item'>No data</li>}
                    </ul>
                  </div>

                  {/* Games with Highest/Lowest Viewership */}
                  <div className='card'>
                    <h4 className='mt-0'>Games by Viewership</h4>
                    <div className='grid grid-2' style={{ gap: 'var(--space-lg)' }}>
                      <div>
                        <div className='stat-label' style={{ marginBottom: 8 }}>Highest</div>
                        <ul className='list'>
                          {a?.gamesMostViewed?.map(g => (
                            <li key={g.id} className='list-item'>
                              <div className='list-item-title'>{g.opponent}</div>
                              <div className='list-item-subtitle'>
                                {new Date(g.date).toLocaleDateString()} · {g.views} views
                              </div>
                            </li>
                          ))}
                          {(!a?.gamesMostViewed || a.gamesMostViewed.length === 0) && <li className='list-item'>No data</li>}
                        </ul>
                      </div>
                      <div>
                        <div className='stat-label' style={{ marginBottom: 8 }}>Lowest</div>
                        <ul className='list'>
                          {a?.gamesLeastViewed?.map(g => (
                            <li key={g.id} className='list-item'>
                              <div className='list-item-title'>{g.opponent}</div>
                              <div className='list-item-subtitle'>
                                {new Date(g.date).toLocaleDateString()} · {g.views} views
                              </div>
                            </li>
                          ))}
                          {(!a?.gamesLeastViewed || a.gamesLeastViewed.length === 0) && <li className='list-item'>No data</li>}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* Games Tab */}
      {selectedTab === 'games' && (
        <>
          <div className='card' style={{ marginBottom: 'var(--space-lg)' }}>
            <div className='stat-label'>
              Drill into a single game: points, viewers, acknowledgments, per-point engagement, timeline, and labels.
            </div>
          </div>

          {gamesLoading && <div className='loading'>Loading games...</div>}
          {gamesError && <div className='alert alert-error'>{gamesError}</div>}

          {!gamesLoading && !gamesError && (
            <div className='card' style={{ marginBottom: 'var(--space-lg)' }}>
              <div className='grid grid-3' style={{ alignItems: 'center', gap: 'var(--space-md)' }}>
                <div>
                  <div className='stat-label'>Team</div>
                  <select
                    className='input'
                    value={selectedTeamFilter}
                    onChange={(e) => { setSelectedTeamFilter(e.target.value); }}
                  >
                    <option value='all'>All</option>
                    {teamsFromGames.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className='stat-label'>Game</div>
                  <select
                    className='input'
                    value={selectedGameId}
                    onChange={(e) =>
                    {
                      const id = e.target.value;
                      setSelectedGameId(id);
                      if (id) fetchGameAnalytics(id);
                    }}
                  >
                    <option value=''>Select a game</option>
                    {filteredGames.map(g => (
                      <option key={g.id} value={g.id}>
                        {g.team_name} vs {g.opponent} — {new Date(g.date).toLocaleDateString()}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className='stat-label'>&nbsp;</div>
                  <button
                    className='btn'
                    onClick={() => { if (selectedGameId) fetchGameAnalytics(selectedGameId); }}
                    disabled={!selectedGameId}
                  >
                    Refresh
                  </button>
                </div>
              </div>
            </div>
          )}

          {gameAnalyticsLoading && <div className='loading'>Loading game analytics...</div>}
          {gameAnalyticsError && <div className='alert alert-error'>{gameAnalyticsError}</div>}

          {gameAnalytics && (
            <div className='card' style={{ marginBottom: 'var(--space-xl)' }}>
              <h3 className='mt-0 mb-md'>
                {gameAnalytics.game ? (
                  <>
                    {gameAnalytics.game.opponent} — {new Date(gameAnalytics.game.date).toLocaleDateString()}
                  </>
                ) : 'Selected Game'}
              </h3>

              {/* Totals */}
              <div className='grid grid-3' style={{ marginBottom: 'var(--space-lg)' }}>
                <div className='card card-compact'>
                  <div className='stat'>
                    <div className='stat-value'>{gameAnalytics.numberOfCoachingPoints}</div>
                    <div className='stat-label'># Coaching Points</div>
                  </div>
                </div>
                <div className='card card-compact'>
                  <div className='stat'>
                    <div className='stat-value'>{gameAnalytics.totalViews}</div>
                    <div className='stat-label'>Total Views</div>
                  </div>
                </div>
                <div className='card card-compact'>
                  <div className='stat'>
                    <div className='stat-value'>{gameAnalytics.uniqueViewers}</div>
                    <div className='stat-label'>Unique Viewers</div>
                  </div>
                </div>
                <div className='card card-compact'>
                  <div className='stat'>
                    <div className='stat-value'>{gameAnalytics.percentPointsAcknowledged}%</div>
                    <div className='stat-label'>% of Points Ack’d</div>
                  </div>
                </div>
                <div className='card card-compact'>
                  <div className='stat'>
                    <div className='stat-value'>{gameAnalytics.avgCompletionPercent}%</div>
                    <div className='stat-label'>Avg Completion</div>
                  </div>
                </div>
              </div>

              {/* Per-Point Engagement Table */}
              <div className='card' style={{ marginBottom: 'var(--space-lg)' }}>
                <h4 className='mt-0'>Per-Point Engagement</h4>
                <div className='table'>
                  <div className='table-row table-header'>
                    <div className='table-cell'>Point Title</div>
                    <div className='table-cell'>Tagged Players</div>
                    <div className='table-cell'>Views</div>
                    <div className='table-cell'>Avg % Viewed</div>
                    <div className='table-cell'>% Ack’d</div>
                    <div className='table-cell'>Last Viewed</div>
                  </div>
                  {gameAnalytics.perPointEngagement.map(row => (
                    <div key={row.pointId} className='table-row'>
                      <div className='table-cell'>{row.title}</div>
                      <div className='table-cell'>{row.taggedPlayers}</div>
                      <div className='table-cell'>{row.views}</div>
                      <div className='table-cell'>{row.avgCompletionPercent}%</div>
                      <div className='table-cell'>{row.percentAckd}%</div>
                      <div className='table-cell'>
                        {row.lastViewedAt ? new Date(row.lastViewedAt).toLocaleString() : '—'}
                      </div>
                    </div>
                  ))}
                  {gameAnalytics.perPointEngagement.length === 0 && (
                    <div className='table-row'><div className='table-cell'>No data</div></div>
                  )}
                </div>
              </div>

              {/* View Timeline */}
              <div className='card' style={{ marginBottom: 'var(--space-lg)' }}>
                <h4 className='mt-0'>View Timeline</h4>
                <TimelineBars points={timelineDayCounts} />
              </div>

              {/* Point Type Breakdown */}
              <div className='card'>
                <h4 className='mt-0'>Point Type Breakdown</h4>
                <div className='table'>
                  <div className='table-row table-header'>
                    <div className='table-cell'>Label</div>
                    <div className='table-cell'>Points</div>
                    <div className='table-cell'>Views</div>
                  </div>
                  {gameAnalytics.pointTypeBreakdown.map((b, i) => (
                    <div key={`${b.label}-${i}`} className='table-row'>
                      <div className='table-cell'>{b.label}</div>
                      <div className='table-cell'>{b.points}</div>
                      <div className='table-cell'>{b.views}</div>
                    </div>
                  ))}
                  {gameAnalytics.pointTypeBreakdown.length === 0 && (
                    <div className='table-row'><div className='table-cell'>No data</div></div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Players Tab */}
      {selectedTab === 'players' && (
        <>
          <div className='card' style={{ marginBottom: 'var(--space-lg)' }}>
            <div className='stat-label'>
              Track individual player engagement across all games & teams they're in: tagged points, viewing patterns, acknowledgment rates, and timing metrics.
            </div>
          </div>

          {playersLoading && <div className='loading'>Loading players...</div>}
          {playersError && <div className='alert alert-error'>{playersError}</div>}

          {!playersLoading && !playersError && (
            <div className='card' style={{ marginBottom: 'var(--space-lg)' }}>
              <div className='grid grid-2' style={{ alignItems: 'center', gap: 'var(--space-md)' }}>
                <div>
                  <div className='stat-label'>Player</div>
                  <select
                    className='input'
                    value={selectedPlayerId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedPlayerId(id);
                      if (id) fetchPlayerAnalytics(id);
                    }}
                  >
                    <option value=''>Select a player</option>
                    {coachPlayers.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.team_name})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className='stat-label'>&nbsp;</div>
                  <button
                    className='btn'
                    onClick={() => { if (selectedPlayerId) fetchPlayerAnalytics(selectedPlayerId); }}
                    disabled={!selectedPlayerId}
                  >
                    Refresh
                  </button>
                </div>
              </div>
            </div>
          )}

          {playerAnalyticsLoading && <div className='loading'>Loading player analytics...</div>}
          {playerAnalyticsError && <div className='alert alert-error'>{playerAnalyticsError}</div>}

          {playerAnalytics && (
            <div className='card' style={{ marginBottom: 'var(--space-xl)' }}>
              <h3 className='mt-0 mb-md'>{playerAnalytics.player.name}</h3>

              {/* Key Metrics */}
              <div className='grid grid-3' style={{ marginBottom: 'var(--space-lg)' }}>
                <div className='card card-compact'>
                  <div className='stat'>
                    <div className='stat-value'>{playerAnalytics.totalCoachingPointsTagged}</div>
                    <div className='stat-label'>Total Coaching Points Tagged</div>
                  </div>
                </div>
                <div className='card card-compact'>
                  <div className='stat'>
                    <div className='stat-value'>{playerAnalytics.percentViewed}%</div>
                    <div className='stat-label'>% Viewed</div>
                  </div>
                </div>
                <div className='card card-compact'>
                  <div className='stat'>
                    <div className='stat-value'>{playerAnalytics.percentAcknowledged}%</div>
                    <div className='stat-label'>% Acknowledged</div>
                  </div>
                </div>
                <div className='card card-compact'>
                  <div className='stat'>
                    <div className='stat-value'>{playerAnalytics.avgCompletionPercent}%</div>
                    <div className='stat-label'>Avg Completion %</div>
                  </div>
                </div>
                <div className='card card-compact'>
                  <div className='stat'>
                    <div className='stat-value'>
                      {playerAnalytics.avgTimeToFirstViewHours !== null 
                        ? `${Math.round(playerAnalytics.avgTimeToFirstViewHours)}h`
                        : '—'}
                    </div>
                    <div className='stat-label'>Time to First View (avg)</div>
                  </div>
                </div>
                <div className='card card-compact'>
                  <div className='stat'>
                    <div className='stat-value'>
                      {playerAnalytics.avgTimeToAcknowledgeHours !== null 
                        ? `${Math.round(playerAnalytics.avgTimeToAcknowledgeHours)}h`
                        : '—'}
                    </div>
                    <div className='stat-label'>Time to Acknowledge (avg)</div>
                  </div>
                </div>
              </div>

              {/* Engagement Over Time */}
              <div className='card' style={{ marginBottom: 'var(--space-lg)' }}>
                <h4 className='mt-0'>Engagement Over Time</h4>
                <div className='table'>
                  <div className='table-row table-header'>
                    <div className='table-cell'>Date</div>
                    <div className='table-cell'>Views</div>
                  </div>
                  {playerAnalytics.engagementOverTime.map((d) => (
                    <div key={d.date} className='table-row'>
                      <div className='table-cell'>{d.date}</div>
                      <div className='table-cell'>{d.views}</div>
                    </div>
                  ))}
                  {playerAnalytics.engagementOverTime.length === 0 && (
                    <div className='table-row'><div className='table-cell'>No data</div><div className='table-cell'></div></div>
                  )}
                </div>
              </div>

              {/* Most/Least Viewed Tagged Points */}
              <div className='grid grid-2' style={{ gap: 'var(--space-lg)' }}>
                <div className='card'>
                  <h4 className='mt-0'>Most Viewed Tagged Points</h4>
                  <ul className='list'>
                    {playerAnalytics.mostViewedTaggedPoints.map(tp => (
                      <li key={tp.pointId} className='list-item'>
                        <div className='list-item-title'>{tp.title}</div>
                        <div className='list-item-subtitle'>
                          {tp.game ? `${tp.game.opponent} (${new Date(tp.game.date).toLocaleDateString()})` : '—'} · {tp.views} views · {tp.avgCompletionPercent}% completion
                        </div>
                      </li>
                    ))}
                    {playerAnalytics.mostViewedTaggedPoints.length === 0 && <li className='list-item'>No data</li>}
                  </ul>
                </div>
                <div className='card'>
                  <h4 className='mt-0'>Least Viewed Tagged Points</h4>
                  <ul className='list'>
                    {playerAnalytics.leastViewedTaggedPoints.map(tp => (
                      <li key={tp.pointId} className='list-item'>
                        <div className='list-item-title'>{tp.title}</div>
                        <div className='list-item-subtitle'>
                          {tp.game ? `${tp.game.opponent} (${new Date(tp.game.date).toLocaleDateString()})` : '—'} · {tp.views} views · {tp.avgCompletionPercent}% completion
                        </div>
                      </li>
                    ))}
                    {playerAnalytics.leastViewedTaggedPoints.length === 0 && <li className='list-item'>No data</li>}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Coaching Points Tab */}
      {selectedTab === 'points' && (
        <>
          <div className='card' style={{ marginBottom: 'var(--space-lg)' }}>
            <div className='stat-label'>
              Deep dive into individual coaching point engagement: tagged players, view/acknowledgment status, completion distribution, view events timeline, and notes.
            </div>
          </div>

          {pointsLoading && <div className='loading'>Loading coaching points...</div>}
          {pointsError && <div className='alert alert-error'>{pointsError}</div>}

          {!pointsLoading && !pointsError && (
            <div className='card' style={{ marginBottom: 'var(--space-lg)' }}>
              <div className='grid grid-2' style={{ alignItems: 'center', gap: 'var(--space-md)' }}>
                <div>
                  <div className='stat-label'>Coaching Point</div>
                  <select
                    className='input'
                    value={selectedPointId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedPointId(id);
                      if (id) fetchPointDetail(id);
                    }}
                  >
                    <option value=''>Select a coaching point</option>
                    {coachingPoints.map(cp => (
                      <option key={cp.id} value={cp.id}>
                        {cp.title} — {cp.team_name} vs {cp.game_opponent} ({new Date(cp.game_date).toLocaleDateString()})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className='stat-label'>&nbsp;</div>
                  <button
                    className='btn'
                    onClick={() => { if (selectedPointId) fetchPointDetail(selectedPointId); }}
                    disabled={!selectedPointId}
                  >
                    Refresh
                  </button>
                </div>
              </div>
            </div>
          )}

          {pointDetailLoading && <div className='loading'>Loading coaching point details...</div>}
          {pointDetailError && <div className='alert alert-error'>{pointDetailError}</div>}

          {pointDetail && (
            <div className='card' style={{ marginBottom: 'var(--space-xl)' }}>
              <h3 className='mt-0 mb-md'>{pointDetail.coachingPoint.title}</h3>
              
              {/* Coaching Point Info */}
              <div className='card' style={{ marginBottom: 'var(--space-lg)' }}>
                <div className='grid grid-2' style={{ gap: 'var(--space-lg)' }}>
                  <div>
                    <div className='stat-label'>Game</div>
                    <div>{pointDetail.coachingPoint.game.team_name} vs {pointDetail.coachingPoint.game.opponent}</div>
                    <div className='stat-label' style={{ marginTop: 8 }}>Date</div>
                    <div>{new Date(pointDetail.coachingPoint.game.date).toLocaleDateString()}</div>
                    <div className='stat-label' style={{ marginTop: 8 }}>Author</div>
                    <div>{pointDetail.coachingPoint.author}</div>
                  </div>
                  <div>
                    <div className='stat-label'>Video Timestamp</div>
                    <div>{Math.floor(pointDetail.coachingPoint.timestamp / 60000)}:{String(Math.floor((pointDetail.coachingPoint.timestamp % 60000) / 1000)).padStart(2, '0')}</div>
                    <div className='stat-label' style={{ marginTop: 8 }}>Duration</div>
                    <div>{Math.floor(pointDetail.coachingPoint.duration / 1000)}s</div>
                    <div className='stat-label' style={{ marginTop: 8 }}>Created</div>
                    <div>{new Date(pointDetail.coachingPoint.created_at).toLocaleString()}</div>
                  </div>
                </div>
                {pointDetail.coachingPoint.feedback && (
                  <div style={{ marginTop: 'var(--space-md)' }}>
                    <div className='stat-label'>Feedback</div>
                    <div>{pointDetail.coachingPoint.feedback}</div>
                  </div>
                )}
              </div>

              {/* Key Metrics */}
              <div className='grid grid-4' style={{ marginBottom: 'var(--space-lg)' }}>
                <div className='card card-compact'>
                  <div className='stat'>
                    <div className='stat-value'>{pointDetail.totalViews}</div>
                    <div className='stat-label'>Total Views</div>
                  </div>
                </div>
                <div className='card card-compact'>
                  <div className='stat'>
                    <div className='stat-value'>{pointDetail.uniqueViewers}</div>
                    <div className='stat-label'>Unique Viewers</div>
                  </div>
                </div>
                <div className='card card-compact'>
                  <div className='stat'>
                    <div className='stat-value'>{pointDetail.taggedPlayers.length}</div>
                    <div className='stat-label'>Tagged Players</div>
                  </div>
                </div>
                <div className='card card-compact'>
                  <div className='stat'>
                    <div className='stat-value'>
                      {pointDetail.taggedPlayers.length > 0 
                        ? Math.round((pointDetail.taggedPlayers.filter(tp => tp.acknowledged).length / pointDetail.taggedPlayers.length) * 100)
                        : 0}%
                    </div>
                    <div className='stat-label'>% Acknowledged</div>
                  </div>
                </div>
              </div>

              {/* Tagged Players & their View/Ack Status */}
              <div className='card' style={{ marginBottom: 'var(--space-lg)' }}>
                <h4 className='mt-0'>Tagged Players & View/Acknowledgment Status</h4>
                <div className='table'>
                  <div className='table-row table-header'>
                    <div className='table-cell'>Player</div>
                    <div className='table-cell'>View Count</div>
                    <div className='table-cell'>Latest Completion %</div>
                    <div className='table-cell'>First Viewed</div>
                    <div className='table-cell'>Last Viewed</div>
                    <div className='table-cell'>Acknowledged</div>
                    <div className='table-cell'>Ack Date</div>
                  </div>
                  {pointDetail.taggedPlayers.map(tp => (
                    <div key={tp.player_id} className='table-row'>
                      <div className='table-cell'>{tp.name}</div>
                      <div className='table-cell'>{tp.view_count}</div>
                      <div className='table-cell'>{tp.latest_completion_percent}%</div>
                      <div className='table-cell'>
                        {tp.first_viewed_at ? new Date(tp.first_viewed_at).toLocaleString() : '—'}
                      </div>
                      <div className='table-cell'>
                        {tp.last_viewed_at ? new Date(tp.last_viewed_at).toLocaleString() : '—'}
                      </div>
                      <div className='table-cell'>
                        <span style={{ 
                          color: tp.acknowledged ? 'var(--success)' : 'var(--text-muted)',
                          fontWeight: tp.acknowledged ? 'bold' : 'normal'
                        }}>
                          {tp.acknowledged ? '✓' : '—'}
                        </span>
                      </div>
                      <div className='table-cell'>
                        {tp.ack_at ? new Date(tp.ack_at).toLocaleString() : '—'}
                      </div>
                    </div>
                  ))}
                  {pointDetail.taggedPlayers.length === 0 && (
                    <div className='table-row'><div className='table-cell'>No tagged players</div></div>
                  )}
                </div>
              </div>

              {/* View Completion Distribution */}
              <div className='card' style={{ marginBottom: 'var(--space-lg)' }}>
                <h4 className='mt-0'>View Completion Distribution</h4>
                <div className='grid grid-4'>
                  <div className='card card-compact'>
                    <div className='stat'>
                      <div className='stat-value'>{pointDetail.completionDistribution['0-25%']}</div>
                      <div className='stat-label'>0-25% Viewed</div>
                    </div>
                  </div>
                  <div className='card card-compact'>
                    <div className='stat'>
                      <div className='stat-value'>{pointDetail.completionDistribution['25-50%']}</div>
                      <div className='stat-label'>25-50% Viewed</div>
                    </div>
                  </div>
                  <div className='card card-compact'>
                    <div className='stat'>
                      <div className='stat-value'>{pointDetail.completionDistribution['50-75%']}</div>
                      <div className='stat-label'>50-75% Viewed</div>
                    </div>
                  </div>
                  <div className='card card-compact'>
                    <div className='stat'>
                      <div className='stat-value'>{pointDetail.completionDistribution['75-100%']}</div>
                      <div className='stat-label'>75-100% Viewed</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* View Events Timeline */}
              <div className='card' style={{ marginBottom: 'var(--space-lg)' }}>
                <h4 className='mt-0'>View Events Timeline</h4>
                <div className='table' style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  <div className='table-row table-header'>
                    <div className='table-cell'>Event Type</div>
                    <div className='table-cell'>Timestamp (video)</div>
                    <div className='table-cell'>Occurred At</div>
                    <div className='table-cell'>Data</div>
                  </div>
                  {pointDetail.viewEventsTimeline.map((event, i) => (
                    <div key={i} className='table-row'>
                      <div className='table-cell'>{event.event_type}</div>
                      <div className='table-cell'>
                        {Math.floor(event.timestamp / 60000)}:{String(Math.floor((event.timestamp % 60000) / 1000)).padStart(2, '0')}
                      </div>
                      <div className='table-cell'>{new Date(event.created_at).toLocaleString()}</div>
                      <div className='table-cell'>
                        {event.event_data ? JSON.stringify(event.event_data).slice(0, 50) + (JSON.stringify(event.event_data).length > 50 ? '...' : '') : '—'}
                      </div>
                    </div>
                  ))}
                  {pointDetail.viewEventsTimeline.length === 0 && (
                    <div className='table-row'><div className='table-cell'>No events recorded</div></div>
                  )}
                </div>
              </div>

              {/* Acknowledgment Notes */}
              <div className='card'>
                <h4 className='mt-0'>Acknowledgment Notes</h4>
                {pointDetail.acknowledgmentNotes.length > 0 ? (
                  <ul className='list'>
                    {pointDetail.acknowledgmentNotes.map((note, i) => (
                      <li key={i} className='list-item'>
                        <div className='list-item-title'>{note.player_name}</div>
                        <div className='list-item-subtitle'>
                          {new Date(note.ack_at).toLocaleString()}
                        </div>
                        <div style={{ marginTop: 8, fontStyle: 'italic' }}>
                          "{note.notes}"
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className='stat-label'>No acknowledgment notes</div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
};

export default CoachAnalyticsPage;
