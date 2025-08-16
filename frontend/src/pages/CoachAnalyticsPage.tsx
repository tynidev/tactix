import React, { useEffect, useMemo, useState } from 'react';
import { getApiUrl } from '../utils/api';
import '../styles/coach-analytics.css';

interface CoachOverview
{
  totals: {
    totalPoints: number;          // Total coaching points across all games
    totalViews: number;           // Total views across all games
    percentAcknowledged: number;  // Percentage of points acknowledged
    avgCompletionPercent: number; // Average completion percentage across all points and players
  };
  engagementOverTime: { date: string; views: number; }[];
  engagementHourlyOverTime?: { date: string; hour: number; views: number; }[]; // UTC hour buckets
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
    // Enhanced: Tagged-specific metrics
    taggedAckRatePercent?: number;
    taggedCompletionPercent?: number;
    taggedScorePercent?: number;
  } | null;
  lowestEngagedPlayer: {
    player_profile_id: string;
    name: string;
    scorePercent: number;
    ackRatePercent: number;
    completionPercent: number;
    // Enhanced: Tagged-specific metrics
    taggedAckRatePercent?: number;
    taggedCompletionPercent?: number;
    taggedScorePercent?: number;
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
    // Enhanced: Tagged-specific metrics
    taggedAckRatePercent?: number;
    taggedCompletionPercent?: number;
    taggedScorePercent?: number;
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
  notViewedTaggedPoints?: {
    pointId: string;
    title: string;
    game: { id: string; opponent: string; date: string; } | null;
    created_at?: string;
  }[];
  unacknowledgedTaggedPoints?: {
    pointId: string;
    title: string;
    game: { id: string; opponent: string; date: string; } | null;
    created_at?: string;
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
  const tzOffsetHours = -new Date().getTimezoneOffset() / 60; // shift from UTC to local
  // Build local matrix by shifting hours then rolling over days
  const matrix = useMemo(() =>
  {
    const local: number[][] = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
    data.forEach(d =>
    {
      if (d.dow < 0 || d.dow > 6 || d.hour < 0 || d.hour > 23) return;
      const raw = d.hour + tzOffsetHours;
      const dayShift = Math.floor(raw / 24) + (raw < 0 && raw % 24 !== 0 ? -1 : 0);
      let localHour = ((raw % 24) + 24) % 24;
      let localDow = (d.dow + dayShift + 7) % 7;
      local[localDow][localHour] += d.views || 0;
    });
    return local;
  }, [data, tzOffsetHours]);

  const maxVal = useMemo(() =>
  {
    let m = 0;
    matrix.forEach(r =>
      r.forEach(v =>
      {
        if (v > m) m = v;
      })
    );
    return m || 1;
  }, [matrix]);
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return (
    <div>
      <div className='stat-label' style={{ marginBottom: 8 }}>Engagement Heatmap</div>
      <div style={{ display: 'grid', gridTemplateColumns: '40px repeat(24, 1fr)', gap: 2, alignItems: 'center' }}>
        {/* Header row */}
        <div></div>
        {Array.from({ length: 24 }, (_, h) =>
        {
          const twelve = ((h + 11) % 12) + 1; // 0->12, 13->1 etc.
          return <div key={h} className='stat-label' style={{ textAlign: 'center', fontSize: 10 }}>{twelve}</div>;
        })}
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

// (Legacy TimelineBars removed in favor of GameTimelineHeatmap)

// Lightweight spark bar chart for daily engagement
function EngagementSpark({ data }: { data: { date: string; views: number; }[]; })
{
  const max = useMemo(() => data.reduce((m, d) => Math.max(m, d.views), 0) || 1, [data]);
  return (
    <div className='spark-wrapper'>
      <div className='spark-bars'>
        {data.map(d => (
          <div
            key={d.date}
            className='spark-bar'
            style={{ height: `${(d.views / max) * 100}%` }}
            title={`${d.date}: ${d.views} views`}
          />
        ))}
      </div>
      <div className='spark-footer'>
        <span>{data[0]?.date}</span>
        <span>{data[data.length - 1]?.date}</span>
      </div>
    </div>
  );
}

// Hourly heatmap for first 7 days after game (7x24)
function GameTimelineHeatmap({ data }: { data: { dow: number; hour: number; views: number; }[]; })
{
  const tzOffsetHours = -new Date().getTimezoneOffset() / 60;
  const matrix = useMemo(() =>
  {
    const local = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
    data.forEach(d =>
    {
      if (d.dow < 0 || d.dow > 6 || d.hour < 0 || d.hour > 23) return;
      const raw = d.hour + tzOffsetHours;
      const dayShift = Math.floor(raw / 24) + (raw < 0 && raw % 24 !== 0 ? -1 : 0);
      const localHour = ((raw % 24) + 24) % 24;
      const localDow = (d.dow + dayShift + 7) % 7;
      local[localDow][localHour] += d.views;
    });
    return local;
  }, [data, tzOffsetHours]);
  const max = useMemo(() =>
  {
    let mv = 0;
    matrix.forEach(r =>
      r.forEach(v =>
      {
        if (v > mv) mv = v;
      })
    );
    return mv || 1;
  }, [matrix]);
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return (
    <div className='timeline-heatmap'>
      <div className='stat-label' style={{ marginBottom: 8 }}>Hourly Views irst 7 Days</div>
      <div className='timeline-hourly-grid'>
        <div></div>
        {Array.from({ length: 24 }, (_, h) =>
        {
          const twelve = ((h + 11) % 12) + 1;
          return <div key={h} className='hour-hdr'>{twelve}</div>;
        })}
        {matrix.map((row, dow) => (
          <React.Fragment key={dow}>
            <div className='dow-label'>{dayNames[dow]}</div>
            {row.map((v, h) =>
            {
              const intensity = v === 0 ? 0 : 0.15 + 0.85 * (v / max);
              return (
                <div
                  key={h}
                  className='hour-cell'
                  title={`${dayNames[dow]} ${h}:00 — ${v} views`}
                  style={{ backgroundColor: v ? `rgba(64,132,255,${intensity})` : 'transparent' }}
                />
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// 30-day engagement heatmap: columns = days, rows = 24 hours (using daily total placed at 12:00 if only daily granularity)
function Overview30DayHourlyHeatmap(
  { data, hourly }: {
    data: { date: string; views: number; }[];
    hourly?: { date: string; hour: number; views: number; }[];
  },
)
{
  const prepared = useMemo(() =>
  {
    // Build last 30 calendar days inclusive of today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dates: Date[] = [];
    for (let i = 29; i >= 0; i--)
    {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      dates.push(d);
    }
    // Map of date -> Map<hour,views> (local hours after conversion)
    const map = new Map<string, Map<number, number>>();
    dates.forEach(d => map.set(d.toISOString().slice(0, 10), new Map()));

    const tzOffsetMinutes = new Date().getTimezoneOffset(); // minutes to add to UTC to get local? Actually date.getTimezoneOffset is minutes behind UTC, so local = UTC - offset. We'll shift from UTC hour buckets to local.

    if (hourly && hourly.length)
    {
      hourly.forEach(h =>
      {
        // h.date is YYYY-MM-DD in UTC; create a UTC Date then shift to local
        const utc = new Date(`${h.date}T${String(h.hour).padStart(2, '0')}:00:00Z`);
        const localMs = utc.getTime() - tzOffsetMinutes * 60 * 1000;
        const local = new Date(localMs);
        const localDayKey = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${
          String(local.getDate()).padStart(2, '0')
        }`;
        const hourLocal = local.getHours();
        if (!map.has(localDayKey)) return; // outside 30-day window
        const hoursMap = map.get(localDayKey)!;
        hoursMap.set(hourLocal, (hoursMap.get(hourLocal) || 0) + h.views);
      });
    }
    else
    {
      // Fallback: daily totals placed at noon
      const daily = new Map<string, number>();
      (data || []).forEach(d =>
      {
        const dt = new Date(d.date);
        dt.setHours(0, 0, 0, 0);
        daily.set(dt.toISOString().slice(0, 10), d.views || 0);
      });
      daily.forEach((v, key) =>
      {
        const hoursMap = map.get(key) || new Map<number, number>();
        if (v) hoursMap.set(12, v);
        map.set(key, hoursMap);
      });
    }

    // Compute max per-hour value for reference (not currently used directly but could be for legend)
    let max = 1;
    map.forEach(m =>
      m.forEach(v =>
      {
        if (v > max) max = v;
      })
    );
    return { dates, map, max };
  }, [data, hourly]);

  if (!prepared.dates.length) return <div className='empty-block'>No data</div>;

  // 4-hour buckets: [0-3],[4-7],[8-11],[12-15],[16-19],[20-23]
  const buckets = [
    { start: 0, end: 3, label: '12a-3a' },
    { start: 4, end: 7, label: '4a-7a' },
    { start: 8, end: 11, label: '8a-11a' },
    { start: 12, end: 15, label: '12p-3p' },
    { start: 16, end: 19, label: '4p-7p' },
    { start: 20, end: 23, label: '8p-11p' },
  ];

  // Pre-aggregate bucket sums per day
  const bucketSumsPerDay: Record<string, number[]> = {};
  let bucketMax = 1;
  prepared.dates.forEach(d =>
  {
    const dayKey = d.toISOString().slice(0, 10);
    const hoursMap = prepared.map.get(dayKey) || new Map();
    const sums: number[] = buckets.map(b =>
    {
      let sum = 0;
      for (let h = b.start; h <= b.end; h++)
      {
        sum += hoursMap.get(h) || 0;
      }
      if (sum > bucketMax) bucketMax = sum;
      return sum;
    });
    bucketSumsPerDay[dayKey] = sums;
  });

  return (
    <div className='overview-hourly-30d'>
      <div
        className='daily-hourly-grid'
        style={{
          display: 'grid',
          gridTemplateColumns: `50px repeat(${prepared.dates.length}, minmax(0, 1fr))`,
          gridAutoRows: '24px',
          gap: 2,
          width: '100%',
        }}
      >
        {/* Date headers */}
        <div></div>
        {prepared.dates.map(d => (
          <div
            key={d.toISOString()}
            className='date-hdr'
            style={{ textAlign: 'center', fontSize: 11, fontWeight: 500 }}
          >
            {d.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}
          </div>
        ))}
        {buckets.map((b, bIdx) => (
          <React.Fragment key={b.label}>
            <div className='hour-label' style={{ fontSize: 11, textAlign: 'right', paddingRight: 4 }}>{b.label}</div>
            {prepared.dates.map(d =>
            {
              const key = d.toISOString().slice(0, 10);
              const val = bucketSumsPerDay[key][bIdx];
              const intensity = Math.min(1, val / bucketMax);
              const bg = `rgba(30, 136, 229, ${0.08 + intensity * 0.4})`;
              const border = `rgba(0,0,0,0.05)`;
              return (
                <div
                  key={key + '-' + bIdx}
                  title={`${val} views ${b.label} on ${d.toLocaleDateString()}`}
                  style={{
                    height: 16,
                    border: `1px solid ${border}`,
                    backgroundColor: val > 0 ? bg : 'transparent',
                  }}
                />
              );
            })}
          </React.Fragment>
        ))}
      </div>
      <div className='subtle-muted' style={{ marginTop: 8, fontSize: 12 }}>
        Past 30 days {hourly && hourly.length ? '' : '(daily aggregate fallback)'}
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
  const [coachPlayers, setCoachPlayers] = useState<{ id: string; name: string; team_id: string; team_name: string; }[]>(
    [],
  );
  const [playersLoading, setPlayersLoading] = useState(false);
  const [playersError, setPlayersError] = useState<string | null>(null);
  const [selectedPlayerTeamId, setSelectedPlayerTeamId] = useState<string>('all');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');
  const [playerAnalytics, setPlayerAnalytics] = useState<PlayerAnalytics | null>(null);
  const [playerAnalyticsLoading, setPlayerAnalyticsLoading] = useState(false);
  const [playerAnalyticsError, setPlayerAnalyticsError] = useState<string | null>(null);

  // Coaching Point Detail states
  const [coachingPoints, setCoachingPoints] = useState<
    {
      id: string;
      title: string;
      game_id: string;
      game_opponent: string;
      game_date: string;
      team_id: string | null;
      team_name: string;
      timestamp: number;
    }[]
  >([]);
  const [selectedPointTeamId, setSelectedPointTeamId] = useState<string>('all');
  const [selectedPointGameId, setSelectedPointGameId] = useState<string>(''); // empty means must choose
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
      if (!accessToken) throw new Error('No access token');

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
        fetchGameAnalytics(list[0].id).catch(() =>
        {/* handled in inner function */});
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

      const raw = await r.json();
      // Normalize backend structure (raw.totals.*) to PlayerAnalytics shape used in UI
      const mapped: PlayerAnalytics = {
        player: { id: raw.player.id, name: raw.player.name },
        totalCoachingPointsTagged: raw.totals.totalTaggedPoints || 0,
        percentViewed: raw.totals.percentViewed || 0,
        percentAcknowledged: raw.totals.percentAcknowledged || 0,
        avgCompletionPercent: raw.totals.avgCompletionPercent || 0,
        avgTimeToFirstViewHours: raw.totals.avgTimeToFirstViewMs != null ?
          raw.totals.avgTimeToFirstViewMs / 3600000 :
          null,
        avgTimeToAcknowledgeHours: raw.totals.avgTimeToAcknowledgeMs != null ?
          raw.totals.avgTimeToAcknowledgeMs / 3600000 :
          null,
        engagementOverTime: raw.engagementOverTime || [],
        mostViewedTaggedPoints: (raw.mostViewedTaggedPoints || []).map((p: any) => ({
          pointId: p.pointId,
          title: p.title,
          game: p.game || null,
          views: p.viewsByPlayer ?? p.views ?? 0,
          avgCompletionPercent: p.avgCompletionPercent ?? 0,
        })),
        leastViewedTaggedPoints: (raw.leastViewedTaggedPoints || []).map((p: any) => ({
          pointId: p.pointId,
          title: p.title,
          game: p.game || null,
          views: p.viewsByPlayer ?? p.views ?? 0,
          avgCompletionPercent: p.avgCompletionPercent ?? 0,
        })),
        notViewedTaggedPoints: (raw.notViewedTaggedPoints || []).map((p: any) => ({
          pointId: p.pointId,
          title: p.title,
          game: p.game || null,
          created_at: p.created_at,
        })),
        unacknowledgedTaggedPoints: (raw.unacknowledgedTaggedPoints || []).map((p: any) => ({
          pointId: p.pointId,
          title: p.title,
          game: p.game || null,
          created_at: p.created_at,
        })),
      };
      setPlayerAnalytics(mapped);
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
      const mapped = (data || []).map((cp: any) => ({
        id: cp.id,
        title: cp.title,
        game_id: cp.game_id,
        game_opponent: cp.game_opponent,
        game_date: cp.game_date,
        team_id: cp.team_id,
        team_name: cp.team_name,
        timestamp: cp.timestamp || 0,
      }));
      setCoachingPoints(mapped);

      // Default select latest game (by date) if any
      if (mapped.length > 0)
      {
        const latestGame = mapped.reduce((acc: (typeof mapped)[number] | null, cp: (typeof mapped)[number]) =>
        {
          if (!acc) return cp;
          return new Date(cp.game_date).getTime() > new Date(acc.game_date).getTime() ? cp : acc;
        }, null as (typeof mapped)[number] | null);
        if (latestGame)
        {
          setSelectedPointTeamId(latestGame.team_id || 'all');
          setSelectedPointGameId(latestGame.game_id);
        }
      }
      else
      {
        setSelectedPointTeamId('all');
        setSelectedPointGameId('');
      }
      // Require explicit point selection
      setSelectedPointId('');
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

  const timelineHourly = useMemo(() =>
  {
    if (!gameAnalytics?.viewTimeline || !gameAnalytics.game?.date) return [];
    const base = new Date(gameAnalytics.game.date).getTime();
    const bucket = new Map<string, number>();
    gameAnalytics.viewTimeline.forEach(ev =>
    {
      const ts = new Date(ev.created_at).getTime();
      if (Number.isNaN(ts) || ts < base) return;
      const hrs = Math.floor((ts - base) / 3600000);
      if (hrs < 0) return;
      const dow = Math.floor(hrs / 24);
      if (dow > 6) return; // limit to first 7 days
      const hour = hrs % 24;
      const key = `${dow}-${hour}`;
      bucket.set(key, (bucket.get(key) || 0) + 1);
    });
    return Array.from(bucket.entries()).map(([k, views]) =>
    {
      const [dow, hour] = k.split('-').map(Number);
      return { dow, hour, views };
    });
  }, [gameAnalytics]);

  // (Removed overviewHourly; using 30-day component instead)

  // Coaching point filter derivations
  const pointTeams = useMemo(() =>
  {
    const map = new Map<string, string>();
    coachingPoints.forEach(cp =>
    {
      if (cp.team_id) map.set(cp.team_id, cp.team_name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [coachingPoints]);

  const pointGames = useMemo(() =>
  {
    return coachingPoints
      .filter(cp => selectedPointTeamId === 'all' || cp.team_id === selectedPointTeamId)
      .reduce<{ id: string; opponent: string; date: string; team_id: string | null; team_name: string; }[]>((acc, cp) =>
      {
        if (!acc.find(g => g.id === cp.game_id))
        {
          acc.push({
            id: cp.game_id,
            opponent: cp.game_opponent,
            date: cp.game_date,
            team_id: cp.team_id,
            team_name: cp.team_name,
          });
        }
        return acc;
      }, [])
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [coachingPoints, selectedPointTeamId]);

  const filteredCoachingPoints = useMemo(() =>
  {
    if (!selectedPointGameId) return [];
    return coachingPoints
      .filter(cp =>
        (selectedPointTeamId === 'all' || cp.team_id === selectedPointTeamId) && cp.game_id === selectedPointGameId
      )
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [coachingPoints, selectedPointTeamId, selectedPointGameId]);

  const pointAckPercent = useMemo(() =>
  {
    if (!pointDetail) return 0;
    const total = pointDetail.taggedPlayers.length;
    if (!total) return 0;
    return Math.round(pointDetail.taggedPlayers.filter(tp => tp.acknowledged).length / total * 100);
  }, [pointDetail]);

  // Player tab derived lists for team filtering
  const playerTeams = useMemo(() =>
  {
    const map = new Map<string, string>();
    coachPlayers.forEach(p =>
    {
      if (p.team_id) map.set(p.team_id, p.team_name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [coachPlayers]);
  const filteredPlayers = useMemo(() =>
  {
    return coachPlayers.filter(p => selectedPlayerTeamId === 'all' || p.team_id === selectedPlayerTeamId);
  }, [coachPlayers, selectedPlayerTeamId]);

  // Helper to format ms -> h:mm:ss (h no pad, mm & ss pad 2)
  const formatHMS = (ms: number) =>
  {
    if (!ms || ms < 0) ms = 0;
    const totalSeconds = Math.floor(ms / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Generic safe formatters for player tab KPIs
  const formatPercent = (value: number | null | undefined, disable?: boolean) =>
  {
    if (disable) return '—';
    if (value === null || value === undefined || isNaN(value)) return '—';
    return `${Math.round(value)}%`;
  };
  const formatHours = (value: number | null | undefined) =>
  {
    if (value === null || value === undefined || isNaN(value) || !isFinite(value)) return '—';
    if (value < 0) return '—';
    return `${Math.round(value)}h`;
  };

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
          <div className='card intro-card'>
            <div className='stat-label'>
              High-level engagement snapshot across all teams & games you manage (last 30 days).
            </div>
          </div>
          {coachOverviewLoading && <div className='loading'>Loading coach overview...</div>}
          {coachOverviewError && <div className='alert alert-error'>{coachOverviewError}</div>}
          {coachOverview && (
            <div className='analytics-overview'>
              {/* KPI Row */}
              <div className='kpi-grid'>
                <div className='kpi-card'>
                  <div className='kpi-label'>Coaching Points</div>
                  <div className='kpi-value'>{coachOverview.totals.totalPoints}</div>
                </div>
                <div className='kpi-card'>
                  <div className='kpi-label'>Total Views</div>
                  <div className='kpi-value'>{coachOverview.totals.totalViews}</div>
                </div>
                <div className='kpi-card'>
                  <div className='kpi-label'>% Acknowledged</div>
                  <div className='kpi-value'>{coachOverview.totals.percentAcknowledged}%</div>
                </div>
                <div className='kpi-card'>
                  <div className='kpi-label'>Avg Completion</div>
                  <div className='kpi-value'>{coachOverview.totals.avgCompletionPercent}%</div>
                </div>
              </div>

              <div className='section-grid'>
                {/* Top Points */}
                <div className='subcard'>
                  <div className='subcard-header'>Top 5 Most Viewed Points</div>
                  <ul className='simple-list scrollable'>
                    {coachOverview.topPoints.map(tp => (
                      <li key={tp.pointId}>
                        <span className='list-primary clamp-1'>{tp.title}</span>
                        <span className='list-secondary'>
                          {tp.game ? `${tp.game.opponent} (${new Date(tp.game.date).toLocaleDateString()})` : '—'} ·
                          {' '}
                          {tp.views} views · {tp.avgCompletionPercent}%
                        </span>
                      </li>
                    ))}
                    {coachOverview.topPoints.length === 0 && <li className='empty-block'>No data</li>}
                  </ul>
                </div>
                {/* Bottom Points */}
                <div className='subcard'>
                  <div className='subcard-header'>Bottom 5 Least Viewed Points</div>
                  <ul className='simple-list scrollable'>
                    {coachOverview.bottomPoints.map(tp => (
                      <li key={tp.pointId}>
                        <span className='list-primary clamp-1'>{tp.title}</span>
                        <span className='list-secondary'>
                          {tp.game ? `${tp.game.opponent} (${new Date(tp.game.date).toLocaleDateString()})` : '—'} ·
                          {' '}
                          {tp.views} views · {tp.avgCompletionPercent}%
                        </span>
                      </li>
                    ))}
                    {coachOverview.bottomPoints.length === 0 && <li className='empty-block'>No data</li>}
                  </ul>
                </div>
                {/* Players */}
                <div className='subcard'>
                  <div className='subcard-header'>Top Engaged Player</div>
                  {coachOverview.topEngagedPlayer ?
                    (
                      <div className='player-engagement-card'>
                        <div className='player-name'>{coachOverview.topEngagedPlayer.name}</div>
                        <div className='player-metrics'>
                          Overall: Score {coachOverview.topEngagedPlayer.scorePercent}%
                        </div>
                        <div className='player-metrics'>
                          All Points: Ack {coachOverview.topEngagedPlayer.ackRatePercent}% · Completion{' '}
                          {coachOverview.topEngagedPlayer.completionPercent}%
                        </div>
                        {(coachOverview.topEngagedPlayer.taggedAckRatePercent !== undefined || 
                          coachOverview.topEngagedPlayer.taggedCompletionPercent !== undefined) && (
                          <div className='player-metrics'>
                            Tagged: Ack {coachOverview.topEngagedPlayer.taggedAckRatePercent || 0}% · Completion{' '}
                            {coachOverview.topEngagedPlayer.taggedCompletionPercent || 0}%
                          </div>
                        )}
                      </div>
                    ) :
                    <div className='empty-block'>No data</div>}
                  <div className='divider' />
                  <div className='subcard-header'>Lowest Engaged Player</div>
                  {coachOverview.lowestEngagedPlayer ?
                    (
                      <div className='player-engagement-card low'>
                        <div className='player-name'>{coachOverview.lowestEngagedPlayer.name}</div>
                        <div className='player-metrics'>
                          Overall: Score {coachOverview.lowestEngagedPlayer.scorePercent}%
                        </div>
                        <div className='player-metrics'>
                          All Points: Ack{' '}
                          {coachOverview.lowestEngagedPlayer.ackRatePercent}% · Completion{' '}
                          {coachOverview.lowestEngagedPlayer.completionPercent}%
                        </div>
                        {(coachOverview.lowestEngagedPlayer.taggedAckRatePercent !== undefined || 
                          coachOverview.lowestEngagedPlayer.taggedCompletionPercent !== undefined) && (
                          <div className='player-metrics'>
                            Tagged: Ack {coachOverview.lowestEngagedPlayer.taggedAckRatePercent || 0}% · Completion{' '}
                            {coachOverview.lowestEngagedPlayer.taggedCompletionPercent || 0}%
                          </div>
                        )}
                      </div>
                    ) :
                    <div className='empty-block'>No data</div>}
                </div>
                {/* 30-Day Engagement Heatmap full width (days x hours) */}
                <div className='subcard engagement-full'>
                  <div className='subcard-header with-help'>
                    <span>30-Day Engagement Heatmap</span>
                    <span className='subtle-muted'>Local Time</span>
                  </div>
                  <Overview30DayHourlyHeatmap
                    data={coachOverview.engagementOverTime}
                    hourly={coachOverview.engagementHourlyOverTime}
                  />
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Teams Tab */}
      {selectedTab === 'teams' && (
        <>
          <div className='card' style={{ marginBottom: 'var(--space-lg)' }}>
            <div className='stat-label'>
              Compare team engagement side-by-side: totals, heatmap, role breakdown, top players, and games by
              viewership.
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
            const formatPct = (v?: number) => (v === null || v === undefined) ? '—' : `${Math.round(v)}%`;
            return (
              <div key={team.id} className='analytics-team card'>
                <div className='team-header-row'>
                  <h3 className='mt-0 mb-0 team-name-heading'>{team.name}</h3>
                  {a && (
                    <div className='team-meta-inline'>
                      <span>{a.totals.totalPoints} points</span>
                      <span>· {a.totals.totalViews} views</span>
                      <span>· {formatPct(a.totals.percentAcknowledged)} ack</span>
                      <span>· {formatPct(a.totals.avgCompletionPercent)} completion</span>
                    </div>
                  )}
                </div>

                {/* KPI Cards */}
                <div className='kpi-grid'>
                  <div className='kpi-card'>
                    <div className='kpi-label'>Total Coaching Points</div>
                    <div className='kpi-value'>{a?.totals.totalPoints ?? 0}</div>
                  </div>
                  <div className='kpi-card'>
                    <div className='kpi-label'>Total Views</div>
                    <div className='kpi-value'>{a?.totals.totalViews ?? 0}</div>
                  </div>
                  <div className='kpi-card'>
                    <div className='kpi-label'>% Ack'd</div>
                    <div className='kpi-value'>{formatPct(a?.totals.percentAcknowledged)}</div>
                  </div>
                  <div className='kpi-card'>
                    <div className='kpi-label'>Avg Completion</div>
                    <div className='kpi-value'>{formatPct(a?.totals.avgCompletionPercent)}</div>
                  </div>
                </div>

                <div className='section-grid'>
                  {/* Per-Role Breakdown */}
                  <div className='subcard'>
                    <div className='subcard-header'>Per-Role Breakdown</div>
                    {a?.perRoleBreakdown && a.perRoleBreakdown.length > 0 ?
                      (
                        <div className='role-table'>
                          <div className='role-table-head'>
                            <div>Role</div>
                            <div className='text-right'>Views</div>
                            <div className='text-right'>Avg Viewed</div>
                          </div>
                          {a.perRoleBreakdown
                            .slice()
                            .sort((x: TeamRoleBreakdown, y: TeamRoleBreakdown) =>
                              roleOrder.indexOf(x.role) - roleOrder.indexOf(y.role)
                            )
                            .map(rb => (
                              <div key={rb.role} className='role-row'>
                                <div className='role-cell role-name'>{rb.role}</div>
                                <div className='role-cell text-right'>{rb.totalViews}</div>
                                <div className='role-cell text-right'>
                                  <span className='role-pct'>{formatPct(rb.avgCompletionPercent)}</span>
                                  <div
                                    className='progress-bar'
                                    aria-label={`Avg completion ${rb.avgCompletionPercent}%`}
                                  >
                                    <div
                                      className='progress-fill'
                                      style={{ width: `${Math.min(100, Math.max(0, rb.avgCompletionPercent))}%` }}
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                        </div>
                      ) :
                      <div className='empty-block'>No data</div>}
                  </div>

                  {/* Engagement Heatmap */}
                  <div className='subcard'>
                    <div className='subcard-header with-help'>
                      <span>Engagement Heatmap</span>
                      <span className='subtle-muted'>Local Time</span>
                    </div>
                    {a?.engagementHeatmap && a.engagementHeatmap.length > 0 ?
                      <Heatmap data={a.engagementHeatmap} /> :
                      <div className='empty-block'>No data</div>}
                  </div>
                </div>

                <div className='section-grid'>
                  {/* Top Players */}
                  <div className='subcard'>
                    <div className='subcard-header'>Top Players by Engagement</div>
                    <ul className='ranked-list'>
                      {a?.topPlayers?.map((p, idx) => (
                        <li key={p.player_profile_id} className='ranked-item'>
                          <div className='rank-index'>{idx + 1}</div>
                          <div className='rank-main'>
                            <div className='rank-title'>{p.name}</div>
                            <div className='rank-sub'>
                              Overall: Score {p.scorePercent}%
                            </div>
                            <div className='rank-sub'>
                              All Points: Ack {p.ackRatePercent}% · Completion {p.completionPercent}%
                            </div>
                            {(p.taggedAckRatePercent !== undefined || p.taggedCompletionPercent !== undefined) && (
                              <div className='rank-sub'>
                                Tagged: Ack {p.taggedAckRatePercent || 0}% · Completion {p.taggedCompletionPercent || 0}%
                              </div>
                            )}
                          </div>
                        </li>
                      ))}
                      {(!a?.topPlayers || a.topPlayers.length === 0) && <li className='empty-block'>No data</li>}
                    </ul>
                  </div>

                  {/* Games Viewership */}
                  <div className='subcard'>
                    <div className='subcard-header'>Games by Viewership</div>
                    <div className='games-split'>
                      <div>
                        <div className='mini-heading'>Highest</div>
                        <ul className='simple-list'>
                          {a?.gamesMostViewed?.map(g => (
                            <li key={g.id}>
                              <span className='list-primary'>{g.opponent}</span>
                              <span className='list-secondary'>
                                {new Date(g.date).toLocaleDateString()} · {g.views} views
                              </span>
                            </li>
                          ))}
                          {(!a?.gamesMostViewed || a.gamesMostViewed.length === 0) && (
                            <li className='empty-block'>No data</li>
                          )}
                        </ul>
                      </div>
                      <div>
                        <div className='mini-heading'>Lowest</div>
                        <ul className='simple-list'>
                          {a?.gamesLeastViewed?.map(g => (
                            <li key={g.id}>
                              <span className='list-primary'>{g.opponent}</span>
                              <span className='list-secondary'>
                                {new Date(g.date).toLocaleDateString()} · {g.views} views
                              </span>
                            </li>
                          ))}
                          {(!a?.gamesLeastViewed || a.gamesLeastViewed.length === 0) && (
                            <li className='empty-block'>No data</li>
                          )}
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
          <div className='card intro-card'>
            <div className='stat-label'>Deep-dive into a game: point engagement, viewer behavior, and content mix.</div>
          </div>

          {gamesLoading && <div className='loading'>Loading games...</div>}
          {gamesError && <div className='alert alert-error'>{gamesError}</div>}

          {!gamesLoading && !gamesError && (
            <div className='subcard filters-bar'>
              <div className='filters-grid'>
                <label className='filter-item'>
                  <span className='filter-label'>Team</span>
                  <select
                    value={selectedTeamFilter}
                    onChange={(e) =>
                    {
                      setSelectedTeamFilter(e.target.value);
                    }}
                  >
                    <option value='all'>All</option>
                    {teamsFromGames.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </label>
                <label className='filter-item'>
                  <span className='filter-label'>Game</span>
                  <select
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
                </label>
                <div className='filter-actions'>
                  <button
                    className='btn btn-secondary'
                    disabled={!selectedGameId}
                    onClick={() =>
                    {
                      if (selectedGameId)
                      {
                        fetchGameAnalytics(selectedGameId);
                      }
                    }}
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
            <div className='analytics-game card'>
              <div className='game-header'>
                <div className='game-title'>
                  {gameAnalytics.game.opponent}
                  <span className='game-date'>{new Date(gameAnalytics.game.date).toLocaleDateString()}</span>
                </div>
              </div>

              <div className='kpi-grid'>
                <div className='kpi-card'>
                  <div className='kpi-label'>Coaching Points</div>
                  <div className='kpi-value'>{gameAnalytics.numberOfCoachingPoints}</div>
                </div>
                <div className='kpi-card'>
                  <div className='kpi-label'>Total Views</div>
                  <div className='kpi-value'>{gameAnalytics.totalViews}</div>
                </div>
                <div className='kpi-card'>
                  <div className='kpi-label'>Unique Viewers</div>
                  <div className='kpi-value'>{gameAnalytics.uniqueViewers}</div>
                </div>
                <div className='kpi-card'>
                  <div className='kpi-label'>Points Ack’d</div>
                  <div className='kpi-value'>{gameAnalytics.percentPointsAcknowledged}%</div>
                </div>
                <div className='kpi-card'>
                  <div className='kpi-label'>Avg Completion</div>
                  <div className='kpi-value'>{gameAnalytics.avgCompletionPercent}%</div>
                </div>
              </div>

              <div className='section-grid games-sections'>
                {/* Per point engagement (spans all 3 cols on large screens) */}
                <div className='subcard engagement-full'>
                  <div className='subcard-header with-help'>
                    <span>Per-Point Engagement</span>
                    <span className='subtle-muted'>View & ack quality</span>
                  </div>
                  <div className='engagement-table'>
                    <div className='engagement-head'>
                      <div>Point Title</div>
                      <div className='text-right'>Tagged</div>
                      <div className='text-right'>Views</div>
                      <div className='text-right'>Avg Viewed</div>
                      <div className='text-right'>Ack’d</div>
                      <div className='text-right'>Last Viewed</div>
                    </div>
                    <div className='engagement-body'>
                      {gameAnalytics.perPointEngagement.map(row => (
                        <div key={row.pointId} className='engagement-row'>
                          <div className='title clamp-1'>{row.title}</div>
                          <div className='text-right'>{row.taggedPlayers}</div>
                          <div className='text-right'>{row.views}</div>
                          <div className='text-right'>
                            <span className='mini-pct'>{row.avgCompletionPercent}%</span>
                            <div className='progress-bar mini'>
                              <div
                                className='progress-fill'
                                style={{ width: `${Math.min(100, Math.max(0, row.avgCompletionPercent))}%` }}
                              />
                            </div>
                          </div>
                          <div className='text-right'>
                            <span className='mini-pct'>{row.percentAckd}%</span>
                            <div className='progress-bar mini ack'>
                              <div
                                className='progress-fill'
                                style={{ width: `${Math.min(100, Math.max(0, row.percentAckd))}%` }}
                              />
                            </div>
                          </div>
                          <div className='text-right'>
                            {row.lastViewedAt ? new Date(row.lastViewedAt).toLocaleDateString() : '—'}
                          </div>
                        </div>
                      ))}
                      {gameAnalytics.perPointEngagement.length === 0 && <div className='empty-block'>No data</div>}
                    </div>
                  </div>
                </div>

                {/* View Timeline Heatmap (spans 2 columns) */}
                <div className='subcard timeline-heatmap-wide'>
                  <div className='subcard-header with-help'>
                    <span>View Timeline Heatmap</span>
                    <span className='subtle-muted'>Local Time</span>
                  </div>
                  <GameTimelineHeatmap data={timelineHourly} />
                </div>

                {/* Point Type Breakdown */}
                <div className='subcard'>
                  <div className='subcard-header with-help'>
                    <span>Point Type Breakdown</span>
                    <span className='subtle-muted'>Mix of labels</span>
                  </div>
                  <div className='breakdown-table'>
                    <div className='breakdown-head'>
                      <div>Label</div>
                      <div className='text-right'>Points</div>
                      <div className='text-right'>Views</div>
                    </div>
                    {gameAnalytics.pointTypeBreakdown.map((b, i) => (
                      <div key={`${b.label}-${i}`} className='breakdown-row'>
                        <div>{b.label}</div>
                        <div className='text-right'>{b.points}</div>
                        <div className='text-right'>{b.views}</div>
                      </div>
                    ))}
                    {gameAnalytics.pointTypeBreakdown.length === 0 && <div className='empty-block'>No data</div>}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Players Tab */}
      {selectedTab === 'players' && (
        <>
          <div className='analytics-overview' style={{ marginBottom: 'var(--space-xl)' }}>
            <div className='card' style={{ marginBottom: 'var(--space-lg)' }}>
              <div className='stat-label'>
                Track individual player engagement across all games & teams they're in: tagged points, viewing patterns,
                acknowledgment rates, and timing metrics.
              </div>
            </div>

            {playersLoading && <div className='loading'>Loading players...</div>}
            {playersError && <div className='alert alert-error'>{playersError}</div>}

            {!playersLoading && !playersError && (
              <div className='subcard filters-bar' style={{ marginBottom: 'var(--space-xl)' }}>
                <div className='filters-grid'>
                  <div className='filter-item'>
                    <label className='filter-label'>Team</label>
                    <select
                      value={selectedPlayerTeamId}
                      onChange={(e) =>
                      {
                        const teamId = e.target.value;
                        setSelectedPlayerTeamId(teamId);
                        setSelectedPlayerId(''); // reset player selection when team changes
                        setPlayerAnalytics(null);
                      }}
                    >
                      <option value='all'>All Teams</option>
                      {playerTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                  <div className='filter-item'>
                    <label className='filter-label'>Player</label>
                    <select
                      value={selectedPlayerId}
                      onChange={(e) =>
                      {
                        const id = e.target.value;
                        setSelectedPlayerId(id);
                        if (id)
                        {
                          fetchPlayerAnalytics(id);
                        }
                      }}
                      disabled={filteredPlayers.length === 0}
                    >
                      <option value=''>Select a player</option>
                      {filteredPlayers.map(p => <option key={p.id} value={p.id}>{p.name} ({p.team_name})</option>)}
                    </select>
                  </div>
                  <div className='filter-actions'>
                    <button
                      className='btn btn-secondary'
                      onClick={() =>
                      {
                        if (selectedPlayerId)
                        {
                          fetchPlayerAnalytics(selectedPlayerId);
                        }
                      }}
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
              <div className='player-analytics'>
                <div className='subcard' style={{ marginBottom: 'var(--space-xl)' }}>
                  <div className='subcard-header'>
                    <span>{playerAnalytics.player.name}</span>
                  </div>
                  <div
                    className='empty-block'
                    style={{ marginTop: 'var(--space-sm)', marginBottom: 'var(--space-sm)' }}
                  >
                    {playerAnalytics.totalCoachingPointsTagged > 0 ?
                      <span>{playerAnalytics.totalCoachingPointsTagged} coaching points tagged</span> :
                      <span>No coaching points have been tagged for this player yet.</span>}
                  </div>
                  {playerAnalytics.totalCoachingPointsTagged > 0 && (
                    <div className='kpi-grid'>
                      <div className='kpi-card'>
                        <div className='kpi-label'>Total Coaching Points Tagged</div>
                        <div className='kpi-value'>{playerAnalytics.totalCoachingPointsTagged}</div>
                      </div>
                      <div className='kpi-card'>
                        <div className='kpi-label'>% Viewed</div>
                        <div className='kpi-value'>{formatPercent(playerAnalytics.percentViewed)}</div>
                      </div>
                      <div className='kpi-card'>
                        <div className='kpi-label'>% Ack'd</div>
                        <div className='kpi-value'>{formatPercent(playerAnalytics.percentAcknowledged)}</div>
                      </div>
                      <div className='kpi-card'>
                        <div className='kpi-label'>Avg Completion</div>
                        <div className='kpi-value'>{formatPercent(playerAnalytics.avgCompletionPercent)}</div>
                      </div>
                      <div className='kpi-card'>
                        <div className='kpi-label'>Time to First View (avg)</div>
                        <div className='kpi-value'>{formatHours(playerAnalytics.avgTimeToFirstViewHours)}</div>
                      </div>
                      <div className='kpi-card'>
                        <div className='kpi-label'>Time to Acknowledge (avg)</div>
                        <div className='kpi-value'>{formatHours(playerAnalytics.avgTimeToAcknowledgeHours)}</div>
                      </div>
                    </div>
                  )}

                  <div className='section-grid' style={{ marginTop: 'var(--space-xl)' }}>
                    <div className='subcard'>
                      <div className='subcard-header'>
                        <span>Engagement Over Time</span>
                      </div>
                      {playerAnalytics.engagementOverTime.length > 0 ?
                        <EngagementSpark data={playerAnalytics.engagementOverTime} /> :
                        <div className='empty-block'>No data</div>}
                    </div>
                  </div>
                </div>

                <div className='section-grid player-sections'>
                  <div className='subcard'>
                    <div className='subcard-header'>
                      <span>Most Viewed Tagged Points</span>
                    </div>
                    {playerAnalytics.mostViewedTaggedPoints.length === 0 && <div className='empty-block'>No data</div>}
                    <ul className='ranked-list scrollable'>
                      {playerAnalytics.mostViewedTaggedPoints.map((tp, i) => (
                        <li key={tp.pointId} className='ranked-item'>
                          <div className='rank-index'>{i + 1}</div>
                          <div className='rank-main'>
                            <div className='rank-title clamp-1'>{tp.title}</div>
                            <div className='rank-sub'>
                              {tp.game ? `${tp.game.opponent} (${new Date(tp.game.date).toLocaleDateString()}) · ` : ''}
                              {tp.views} views · {tp.avgCompletionPercent}% completion
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className='subcard'>
                    <div className='subcard-header'>
                      <span>Unacknowledged Points Tagged In</span>
                    </div>
                    {(!playerAnalytics.unacknowledgedTaggedPoints ||
                      playerAnalytics.unacknowledgedTaggedPoints.length === 0) && (
                      <div className='empty-block'>All tagged points acknowledged</div>
                    )}
                    <ul className='ranked-list scrollable'>
                      {(playerAnalytics.unacknowledgedTaggedPoints || []).map((tp, i) => (
                        <li key={tp.pointId} className='ranked-item'>
                          <div className='rank-index'>{i + 1}</div>
                          <div className='rank-main'>
                            <div className='rank-title clamp-1'>{tp.title}</div>
                            <div className='rank-sub'>
                              {tp.game ? `${tp.game.opponent} (${new Date(tp.game.date).toLocaleDateString()})` : '—'}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className='subcard'>
                    <div className='subcard-header'>
                      <span>Unviewed Points Tagged in</span>
                    </div>
                    {(!playerAnalytics.notViewedTaggedPoints || playerAnalytics.notViewedTaggedPoints.length === 0) && (
                      <div className='empty-block'>All tagged points have at least one view</div>
                    )}
                    <ul className='ranked-list scrollable'>
                      {(playerAnalytics.notViewedTaggedPoints || []).map((tp, i) => (
                        <li key={tp.pointId} className='ranked-item'>
                          <div className='rank-index'>{i + 1}</div>
                          <div className='rank-main'>
                            <div className='rank-title clamp-1'>{tp.title}</div>
                            <div className='rank-sub'>
                              {tp.game ? `${tp.game.opponent} (${new Date(tp.game.date).toLocaleDateString()})` : '—'}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Coaching Points Tab */}
      {selectedTab === 'points' && (
        <>
          <div className='card' style={{ marginBottom: 'var(--space-lg)' }}>
            <div className='stat-label'>
              Deep dive into individual coaching point engagement: tagged players, view/acknowledgment status,
              completion distribution, view events timeline, and notes.
            </div>
          </div>

          {pointsLoading && <div className='loading'>Loading coaching points...</div>}
          {pointsError && <div className='alert alert-error'>{pointsError}</div>}

          {!pointsLoading && !pointsError && (
            <div className='subcard filters-bar points-filters' style={{ marginBottom: 'var(--space-xl)' }}>
              <div className='filters-grid'>
                <div className='filter-item'>
                  <label className='filter-label'>Team</label>
                  <select
                    value={selectedPointTeamId}
                    onChange={(e) =>
                    {
                      const val = e.target.value;
                      setSelectedPointTeamId(val);
                      setSelectedPointGameId('all');
                      setSelectedPointId('');
                    }}
                  >
                    <option value='all'>All Teams</option>
                    {pointTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div className='filter-item'>
                  <label className='filter-label'>Game</label>
                  <select
                    value={selectedPointGameId}
                    onChange={(e) =>
                    {
                      const val = e.target.value;
                      setSelectedPointGameId(val);
                      setSelectedPointId('');
                    }}
                    disabled={pointGames.length === 0}
                  >
                    <option value=''>Select Game</option>
                    {pointGames.map(g => (
                      <option key={g.id} value={g.id}>
                        {g.team_name} vs {g.opponent} - {new Date(g.date).toLocaleDateString()}
                      </option>
                    ))}
                  </select>
                </div>
                <div className='filter-item'>
                  <label className='filter-label'>Coaching Point</label>
                  <select
                    value={selectedPointId}
                    onChange={(e) =>
                    {
                      const id = e.target.value;
                      setSelectedPointId(id);
                      if (id)
                      {
                        fetchPointDetail(id);
                      }
                    }}
                    disabled={!selectedPointGameId || filteredCoachingPoints.length === 0}
                  >
                    <option value=''>Select Point</option>
                    {filteredCoachingPoints.map(cp =>
                    {
                      return <option key={cp.id} value={cp.id}>[{formatHMS(cp.timestamp)}] - {cp.title}</option>;
                    })}
                  </select>
                </div>
                <div className='filter-actions'>
                  <button
                    className='btn btn-secondary'
                    disabled={!selectedPointId}
                    onClick={() =>
                    {
                      if (selectedPointId)
                      {
                        fetchPointDetail(selectedPointId);
                      }
                    }}
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
            <div className='analytics-point' style={{ marginBottom: 'var(--space-2xl)' }}>
              <div className='subcard' style={{ marginBottom: 'var(--space-xl)' }}>
                <div className='subcard-header'>
                  <span>{pointDetail.coachingPoint.title}</span>
                </div>
                <div className='kpi-grid'>
                  <div className='kpi-card'>
                    <div className='kpi-label'>Total Views</div>
                    <div className='kpi-value'>{pointDetail.totalViews}</div>
                  </div>
                  <div className='kpi-card'>
                    <div className='kpi-label'>Unique Viewers</div>
                    <div className='kpi-value'>{pointDetail.uniqueViewers}</div>
                  </div>
                  <div className='kpi-card'>
                    <div className='kpi-label'>Tagged Players</div>
                    <div className='kpi-value'>{pointDetail.taggedPlayers.length}</div>
                  </div>
                  <div className='kpi-card'>
                    <div className='kpi-label'>% Ack'd</div>
                    <div className='kpi-value'>{pointAckPercent}%</div>
                  </div>
                  <div className='kpi-card'>
                    <div className='kpi-label'>Video Timestamp</div>
                    <div className='kpi-value'>{formatHMS(pointDetail.coachingPoint.timestamp)}</div>
                  </div>
                  <div className='kpi-card'>
                    <div className='kpi-label'>Duration (s)</div>
                    <div className='kpi-value'>{Math.floor(pointDetail.coachingPoint.duration / 1000)}</div>
                  </div>
                </div>
                <div className='point-meta-grid'>
                  <div>
                    <span className='mini-heading'>Game</span>
                    <div>{pointDetail.coachingPoint.game.team_name} vs {pointDetail.coachingPoint.game.opponent}</div>
                  </div>
                  <div>
                    <span className='mini-heading'>Date</span>
                    <div>{new Date(pointDetail.coachingPoint.game.date).toLocaleDateString()}</div>
                  </div>
                  <div>
                    <span className='mini-heading'>Author</span>
                    <div>{pointDetail.coachingPoint.author}</div>
                  </div>
                  <div>
                    <span className='mini-heading'>Created</span>
                    <div>{new Date(pointDetail.coachingPoint.created_at).toLocaleString()}</div>
                  </div>
                </div>
                {pointDetail.coachingPoint.feedback && (
                  <div className='feedback-block'>
                    <div className='mini-heading'>Feedback</div>
                    <div className='feedback-text'>{pointDetail.coachingPoint.feedback}</div>
                  </div>
                )}
              </div>
              <div className='section-grid point-sections'>
                <div className='subcard wide'>
                  <div className='subcard-header'>
                    <span>Tagged Players</span>
                  </div>
                  <div className='tagged-table-head'>
                    <span>Player</span>
                    <span>Views</span>
                    <span>Completion</span>
                    <span>First</span>
                    <span>Last</span>
                    <span>Ack</span>
                  </div>
                  <div className='tagged-table-body scrollable'>
                    {pointDetail.taggedPlayers.length === 0 && <div className='empty-block'>No tagged players</div>}
                    {pointDetail.taggedPlayers.map(tp => (
                      <div key={tp.player_id} className='tagged-row'>
                        <div className='tp-name clamp-1'>{tp.name}</div>
                        <div>{tp.view_count}</div>
                        <div className='tp-comp'>{tp.latest_completion_percent}%</div>
                        <div className='tp-date'>
                          {tp.first_viewed_at ? new Date(tp.first_viewed_at).toLocaleDateString() : '—'}
                        </div>
                        <div className='tp-date'>
                          {tp.last_viewed_at ? new Date(tp.last_viewed_at).toLocaleDateString() : '—'}
                        </div>
                        <div className='tp-ack'>{tp.acknowledged ? '✓' : '—'}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className='subcard'>
                  <div className='subcard-header'>
                    <span>Completion Distribution</span>
                  </div>
                  <ul className='dist-list'>
                    <li>
                      <span>0-25%</span>
                      <strong>{pointDetail.completionDistribution['0-25%']}</strong>
                    </li>
                    <li>
                      <span>25-50%</span>
                      <strong>{pointDetail.completionDistribution['25-50%']}</strong>
                    </li>
                    <li>
                      <span>50-75%</span>
                      <strong>{pointDetail.completionDistribution['50-75%']}</strong>
                    </li>
                    <li>
                      <span>75-100%</span>
                      <strong>{pointDetail.completionDistribution['75-100%']}</strong>
                    </li>
                  </ul>
                </div>
                <div className='subcard'>
                  <div className='subcard-header'>
                    <span>Acknowledgment Notes</span>
                  </div>
                  {pointDetail.acknowledgmentNotes.length === 0 && (
                    <div className='empty-block'>No acknowledgment notes</div>
                  )}
                  <ul className='ranked-list scrollable'>
                    {pointDetail.acknowledgmentNotes.map((note, i) => (
                      <li key={i} className='ranked-item'>
                        <div className='rank-main'>
                          <div className='rank-title'>{note.player_name}</div>
                          <div className='rank-sub'>{new Date(note.ack_at).toLocaleString()}</div>
                          <div className='note-text'>"{note.notes}"</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
};

export default CoachAnalyticsPage;
