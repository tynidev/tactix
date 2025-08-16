import express, { Response } from 'express';
import { type AuthenticatedRequest, authenticateUser } from '../middleware/auth.js';
import { supabase } from '../utils/supabase.js';

const router = express.Router();

/**
 * Build per (point,user) max completion map from view events.
 * This tracks the highest completion percentage achieved by each user for each coaching point.
 */
function buildPerUserPointMaxMap(
  viewEvents: Array<{ point_id: string; user_id: string; completion_percentage: number | null; }>,
): Map<string, number>
{
  const perUserPointMax = new Map<string, number>();
  (viewEvents || []).forEach(ev =>
  {
    const key = `${ev.point_id}__${ev.user_id}`;
    const val = typeof ev.completion_percentage === 'number' ? ev.completion_percentage : 0;
    const prev = perUserPointMax.get(key);
    if (prev === undefined || val > prev)
    {
      perUserPointMax.set(key, val);
    }
  });
  return perUserPointMax;
}

/**
 * Calculate engagement over time by grouping events into time buckets.
 * @param viewEvents - Array of view events with created_at timestamps
 * @param granularity - 'daily' or 'hourly'
 * @returns Array of {date, views} or {date, hour, views} objects
 */
function calculateEngagementOverTime(
  viewEvents: Array<{ created_at: string; }>,
  granularity: 'daily' | 'hourly' = 'daily',
): Array<{ date: string; views: number; hour?: number; }>
{
  const timeMap = new Map<string, number>();

  (viewEvents || []).forEach(ev =>
  {
    if (!ev.created_at) return;
    const d = new Date(ev.created_at);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');

    let key: string;
    if (granularity === 'hourly')
    {
      const hh = String(d.getUTCHours()).padStart(2, '0');
      key = `${yyyy}-${mm}-${dd}-${hh}`;
    }
    else
    {
      key = `${yyyy}-${mm}-${dd}`;
    }

    timeMap.set(key, (timeMap.get(key) || 0) + 1);
  });

  return Array.from(timeMap.entries())
    .map(([k, views]) =>
    {
      if (granularity === 'hourly')
      {
        return {
          date: k.slice(0, 10),
          hour: parseInt(k.slice(11, 13)),
          views,
        };
      }
      return { date: k, views };
    })
    .sort((a, b) =>
    {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      if ('hour' in a && 'hour' in b && a.hour !== undefined && b.hour !== undefined)
      {
        return a.hour - b.hour;
      }
      return 0;
    });
}

/**
 * Calculate per-point aggregates (sum, count, average) from per-user-point max map.
 */
function calculatePerPointAggregates(perUserPointMax: Map<string, number>): Map<string, number>
{
  const perPointAgg: Record<string, { sum: number; count: number; }> = {};

  perUserPointMax.forEach((v, key) =>
  {
    const [pid] = key.split('__');
    if (!perPointAgg[pid]) perPointAgg[pid] = { sum: 0, count: 0 };
    perPointAgg[pid].sum += v || 0;
    perPointAgg[pid].count += 1;
  });

  const avgCompletionByPoint = new Map<string, number>();
  Object.entries(perPointAgg).forEach(([pid, agg]) =>
  {
    if (agg.count > 0) avgCompletionByPoint.set(pid, Math.round(agg.sum / agg.count));
  });

  return avgCompletionByPoint;
}

/**
 * Calculate views by entity (point, game, etc.) from view events.
 */
function calculateViewsByEntity<T extends { point_id?: string; game_id?: string; }>(
  viewEvents: Array<T>,
  entityKey: keyof T,
): Map<string, number>
{
  const viewsByEntity = new Map<string, number>();
  (viewEvents || []).forEach(ev =>
  {
    const entityId = ev[entityKey] as string;
    if (entityId)
    {
      viewsByEntity.set(entityId, (viewsByEntity.get(entityId) || 0) + 1);
    }
  });
  return viewsByEntity;
}

/**
 * Calculate player engagement scores based on acknowledgment rate and completion rate.
 * Uses a weighted formula: 60% ack rate + 40% completion rate.
 */
function calculatePlayerScore(ackRate: number, completionRate: number): number
{
  return 0.6 * ackRate + 0.4 * completionRate;
}

/**
 * Calculate comprehensive player engagement scores including both overall and tagged-specific metrics.
 * This provides a complete view of player engagement across all coaching points and tagged points specifically.
 */
function calculatePlayerEngagementScores(
  players: Array<{ id: string; name: string; user_id: string; }>,
  pointIds: string[],
  tagsByPlayer: Map<string, string[]>,
  ackCountByPlayer: Map<string, number>,
  perUserPointMax: Map<string, number>,
): Array<{
  player_profile_id: string;
  name: string;
  // Overall engagement (ALL points)
  ackRate: number; // 0..1
  completionRate: number; // 0..1
  score: number; // 0..1
  // Tagged-specific engagement
  taggedAckRate: number; // 0..1
  taggedCompletionRate: number; // 0..1
  taggedScore: number; // 0..1
}>
{
  return players.map(player =>
  {
    const taggedPoints = tagsByPlayer.get(player.id) || [];
    const totalTagged = taggedPoints.length;
    const totalPoints = pointIds.length;
    const ackedCount = ackCountByPlayer.get(player.id) || 0;

    // === OVERALL ENGAGEMENT (ALL POINTS) ===
    const ackRate = totalPoints > 0 ? (ackedCount / totalPoints) : 0;

    // Completion across ALL points
    let allPointsCompSum = 0;
    pointIds.forEach(pointId =>
    {
      const key = `${pointId}__${player.user_id}`;
      const maxComp = perUserPointMax.get(key);
      allPointsCompSum += typeof maxComp === 'number' ? maxComp : 0;
    });
    const completionRate = totalPoints > 0 ? (allPointsCompSum / totalPoints) / 100 : 0;

    // === TAGGED-SPECIFIC ENGAGEMENT ===
    const taggedAckRate = totalTagged > 0 ? (ackedCount / totalTagged) : 0;

    // Completion across TAGGED points only
    let taggedCompSum = 0;
    taggedPoints.forEach(pointId =>
    {
      const key = `${pointId}__${player.user_id}`;
      const maxComp = perUserPointMax.get(key);
      taggedCompSum += typeof maxComp === 'number' ? maxComp : 0;
    });
    const taggedCompletionRate = totalTagged > 0 ? (taggedCompSum / totalTagged) / 100 : 0;

    // === SCORING ===
    const score = calculatePlayerScore(ackRate, completionRate); // Overall score
    const taggedScore = calculatePlayerScore(taggedAckRate, taggedCompletionRate); // Tagged score

    return {
      player_profile_id: player.id,
      name: player.name || 'Player',
      ackRate,
      completionRate,
      score,
      taggedAckRate,
      taggedCompletionRate,
      taggedScore,
    };
  });
}

/**
 * Calculate average completion percentage across all possible (point, player) combinations.
 * This ensures that players who haven't viewed a coaching point contribute 0% to the average,
 * rather than being excluded from the calculation entirely.
 */
function calculateAvgCompletionPercent(
  viewEvents: Array<{ point_id: string; user_id: string; completion_percentage: number | null; }>,
  pointIds: string[],
  playersWithUserIds: Array<{ user_id: string; }>,
): number
{
  const perUserPointMax = buildPerUserPointMaxMap(viewEvents);

  // Create complete matrix: for each point × player combination, get max completion or 0
  const allPlayerPointMaxValues: number[] = [];
  pointIds.forEach(pointId =>
  {
    playersWithUserIds.forEach(player =>
    {
      const key = `${pointId}__${player.user_id}`;
      const maxCompletion = perUserPointMax.get(key) || 0; // Default to 0 if no views
      allPlayerPointMaxValues.push(maxCompletion);
    });
  });

  return allPlayerPointMaxValues.length > 0 ?
    Math.round(allPlayerPointMaxValues.reduce((s, v) => s + v, 0) / allPlayerPointMaxValues.length * 10) / 10 :
    0;
}

function parseDateRange(query: any): { startISO: string; endISO: string; }
{
  const now = new Date();
  const end = query.end ? new Date(query.end) : now;
  let start: Date;
  if (query.start)
  {
    start = new Date(query.start);
  }
  else
  {
    // default last 30 days
    start = new Date(end);
    start.setDate(start.getDate() - 30);
  }
  return { startISO: start.toISOString(), endISO: end.toISOString() };
}

// GET /api/analytics/coach-overview
// Aggregates across all teams where the current user is coach (or admin)
// Query params: ?start=&end= (ISO strings)
router.get('/coach-overview', authenticateUser, async (req: AuthenticatedRequest, res: Response): Promise<void> =>
{
  try
  {
    const userId = req.user?.id;
    if (!userId)
    {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { startISO, endISO } = parseDateRange(req.query);

    // Teams where user is coach or admin
    const { data: memberships, error: membershipError } = await supabase
      .from('team_memberships')
      .select('team_id, role')
      .eq('user_id', userId)
      .in('role', ['coach', 'admin']);

    if (membershipError)
    {
      res.status(400).json({ error: membershipError.message });
      return;
    }
    const teamIds = (memberships || []).map(m => m.team_id);
    if (teamIds.length === 0)
    {
      res.json({
        totals: { totalPoints: 0, totalViews: 0, percentAcknowledged: 0, avgCompletionPercent: 0 },
        engagementOverTime: [],
        topPoints: [],
        bottomPoints: [],
        topEngagedPlayer: null,
        lowestEngagedPlayer: null,
      });
      return;
    }

    // Games for these teams
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('id, team_id, opponent, date')
      .in('team_id', teamIds);

    if (gamesError)
    {
      res.status(400).json({ error: gamesError.message });
      return;
    }
    const gameIds = (games || []).map(g => g.id);
    const gameById = new Map<string, any>();
    (games || []).forEach(g => gameById.set(g.id, g));

    // Coaching points in date window
    const { data: points, error: pointsError } = await supabase
      .from('coaching_points')
      .select('id, game_id, title, created_at')
      .in('game_id', gameIds)
      .gte('created_at', startISO)
      .lte('created_at', endISO);

    if (pointsError)
    {
      res.status(400).json({ error: pointsError.message });
      return;
    }
    const pointIds = (points || []).map(p => p.id);
    const pointById = new Map<string, any>();
    (points || []).forEach(p => pointById.set(p.id, p));

    // Player lists per team (include user_id to identify linked users)
    const { data: teamPlayers, error: teamPlayersError } = await supabase
      .from('team_players')
      .select(`
        team_id,
        player_id,
        player_profiles (
          id,
          name,
          user_id
        )
      `)
      .in('team_id', teamIds);

    if (teamPlayersError)
    {
      res.status(400).json({ error: teamPlayersError.message });
      return;
    }

    const playerCountsByTeam = new Map<string, number>();
    const playerProfileById = new Map<
      string,
      { id: string; name: string; user_id: string | null; teamIds: Set<string>; }
    >();
    (teamPlayers || []).forEach(tp =>
    {
      const tId = tp.team_id as string;
      playerCountsByTeam.set(tId, (playerCountsByTeam.get(tId) || 0) + 1);
      const prof = tp.player_profiles;
      if (prof?.id)
      {
        const existing = playerProfileById.get(prof.id);
        if (existing)
        {
          existing.teamIds.add(tId);
        }
        else
        {
          playerProfileById.set(prof.id, {
            id: prof.id,
            name: prof.name,
            user_id: prof.user_id,
            teamIds: new Set([tId]),
          });
        }
      }
    });

    // Views within window
    const { data: viewEvents, error: viewEventsError } = pointIds.length === 0 ?
      { data: [], error: null } :
      await supabase
        .from('coaching_point_view_events')
        .select('point_id, user_id, completion_percentage, created_at')
        .in('point_id', pointIds)
        .gte('created_at', startISO)
        .lte('created_at', endISO);

    if (viewEventsError)
    {
      res.status(400).json({ error: viewEventsError.message });
      return;
    }

    // Acknowledgments within window
    const { data: acks, error: acksError } = pointIds.length === 0 ?
      { data: [], error: null } :
      await supabase
        .from('coaching_point_acknowledgments')
        .select('id, point_id, player_id, ack_at, acknowledged')
        .in('point_id', pointIds)
        .eq('acknowledged', true)
        .gte('ack_at', startISO)
        .lte('ack_at', endISO);

    if (acksError)
    {
      res.status(400).json({ error: acksError.message });
      return;
    }

    // Aggregate: total views
    const totalViews = (viewEvents || []).length;

    // Aggregate: per (point,user) max completion - fixed to include all possible combinations
    const playersWithUserIds = Array.from(playerProfileById.values())
      .filter(p => !!p.user_id)
      .map(p => ({ user_id: p.user_id! }));
    const avgCompletionPercent = calculateAvgCompletionPercent(viewEvents, pointIds, playersWithUserIds);

    // Build per (point,user) max completion map for other calculations that still need it
    const perUserPointMax = buildPerUserPointMaxMap(viewEvents);

    // Engagement over time using utility functions
    const engagementOverTime = calculateEngagementOverTime(viewEvents, 'daily');
    const engagementHourlyOverTime = calculateEngagementOverTime(viewEvents, 'hourly');

    // % Acknowledged = acknowledged_count / total_possible_acks
    // total_possible_acks = sum_over_teams(points_for_team * players_in_team)
    const pointsByTeam = new Map<string, number>();
    (points || []).forEach(p =>
    {
      const game = gameById.get(p.game_id);
      if (!game) return;
      const tId = game.team_id as string;
      pointsByTeam.set(tId, (pointsByTeam.get(tId) || 0) + 1);
    });
    let totalPossibleAcks = 0;
    pointsByTeam.forEach((pointsCount, tId) =>
    {
      const playerCount = playerCountsByTeam.get(tId) || 0;
      totalPossibleAcks += pointsCount * playerCount;
    });
    const acknowledgedCount = (acks || []).length;
    const percentAcknowledged = totalPossibleAcks > 0 ?
      Math.round((acknowledgedCount / totalPossibleAcks) * 1000) / 10 :
      0;

    // Top/Bottom points by views with avg completion (per-user max)
    const viewsByPoint = calculateViewsByEntity(viewEvents, 'point_id');
    const avgCompletionByPoint = calculatePerPointAggregates(perUserPointMax);

    const pointSummaries = (points || []).map(p =>
    {
      const game = gameById.get(p.game_id);
      const pid = p.id as string;
      return {
        pointId: pid,
        title: p.title as string,
        game: game ? { id: game.id, opponent: game.opponent, date: game.date } : null,
        views: viewsByPoint.get(pid) || 0,
        avgCompletionPercent: avgCompletionByPoint.get(pid) || 0,
      };
    });

    const topPoints = [...pointSummaries]
      .sort((a, b) => b.views - a.views)
      .slice(0, 5);

    const bottomPoints = [...pointSummaries]
      .sort((a, b) => a.views - b.views)
      .slice(0, 5);

    // Top/Lowest engaged player
    // Compute based on tagged points within scope, players with linked user accounts
    const playersWithUser = Array.from(playerProfileById.values()).filter(p => !!p.user_id);

    // Tagged points of those players within our points set
    const playerIds = playersWithUser.map(p => p.id);
    const { data: tags, error: tagsError } = pointIds.length === 0 || playerIds.length === 0 ?
      { data: [], error: null } :
      await supabase
        .from('coaching_point_tagged_players')
        .select('point_id, player_id')
        .in('point_id', pointIds)
        .in('player_id', playerIds);

    if (tagsError)
    {
      res.status(400).json({ error: tagsError.message });
      return;
    }

    const tagsByPlayer = new Map<string, string[]>(); // player_profile_id -> [point_id...]
    (tags || []).forEach(t =>
    {
      const arr = tagsByPlayer.get(t.player_id) || [];
      arr.push(t.point_id);
      tagsByPlayer.set(t.player_id, arr);
    });

    // Acks per player (already filtered to points in scope and acknowledged within window)
    const ackCountByPlayer = new Map<string, number>();
    (acks || []).forEach(a =>
    {
      const pid = a.player_id as string;
      ackCountByPlayer.set(pid, (ackCountByPlayer.get(pid) || 0) + 1);
    });

    // Map for per-user-point max completion we already computed; need quick lookup by (point, user)
    const perUserPointMaxMap = perUserPointMax; // alias

    // Calculate comprehensive player engagement scores using utility function
    const playersForScoring = playersWithUser
      .filter(p => !!p.user_id)
      .map(p => ({ id: p.id, name: p.name, user_id: p.user_id! }));

    const playerScores = calculatePlayerEngagementScores(
      playersForScoring,
      pointIds,
      tagsByPlayer,
      ackCountByPlayer,
      perUserPointMax,
    );

    const filteredScores = playerScores.filter(ps => (tagsByPlayer.get(ps.player_profile_id)?.length || 0) > 0);
    let topEngagedPlayer = null as null | any;
    let lowestEngagedPlayer = null as null | any;

    if (filteredScores.length > 0)
    {
      filteredScores.sort((a, b) => b.score - a.score);
      const top = filteredScores[0];
      const low = filteredScores[filteredScores.length - 1];
      topEngagedPlayer = {
        player_profile_id: top.player_profile_id,
        name: top.name,
        scorePercent: Math.round(top.score * 100),
        ackRatePercent: Math.round(top.ackRate * 100),
        completionPercent: Math.round(top.completionRate * 100),
        // Enhanced: Tagged-specific metrics
        taggedAckRatePercent: Math.round(top.taggedAckRate * 100),
        taggedCompletionPercent: Math.round(top.taggedCompletionRate * 100),
        taggedScorePercent: Math.round(top.taggedScore * 100),
      };
      lowestEngagedPlayer = {
        player_profile_id: low.player_profile_id,
        name: low.name,
        scorePercent: Math.round(low.score * 100),
        ackRatePercent: Math.round(low.ackRate * 100),
        completionPercent: Math.round(low.completionRate * 100),
        // Enhanced: Tagged-specific metrics
        taggedAckRatePercent: Math.round(low.taggedAckRate * 100),
        taggedCompletionPercent: Math.round(low.taggedCompletionRate * 100),
        taggedScorePercent: Math.round(low.taggedScore * 100),
      };
    }

    res.json({
      totals: {
        totalPoints: (points || []).length,
        totalViews,
        percentAcknowledged,
        avgCompletionPercent,
      },
      engagementOverTime,
      engagementHourlyOverTime,
      topPoints,
      bottomPoints,
      topEngagedPlayer,
      lowestEngagedPlayer,
      // debug: { startISO, endISO }
    });
  }
  catch (error)
  {
    console.error('Error in GET /analytics/coach-overview:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/analytics/team/:teamId
 * Team-level analytics for coaches/admins
 * Query: ?start=&end= (ISO strings)
 */
router.get('/team/:teamId', authenticateUser, async (req: AuthenticatedRequest, res: Response): Promise<void> =>
{
  try
  {
    const userId = req.user?.id;
    const { teamId } = req.params;
    if (!userId)
    {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { startISO, endISO } = parseDateRange(req.query);

    // Verify user is coach/admin on this team
    const { data: membership, error: membershipError } = await supabase
      .from('team_memberships')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', userId)
      .single();

    if (membershipError || !membership || (membership.role !== 'coach' && membership.role !== 'admin'))
    {
      res.status(403).json({ error: 'Only coaches and admins can view team analytics' });
      return;
    }

    // Players on team (include linked user_id)
    const { data: teamPlayers, error: teamPlayersError } = await supabase
      .from('team_players')
      .select(`
        team_id,
        player_id,
        jersey_number,
        player_profiles (
          id,
          name,
          user_id
        )
      `)
      .eq('team_id', teamId);

    if (teamPlayersError)
    {
      res.status(400).json({ error: teamPlayersError.message });
      return;
    }

    const totalPlayers = teamPlayers?.length || 0;
    const playerProfileById = new Map<string, { id: string; name: string; user_id: string | null; }>();
    (teamPlayers || []).forEach(tp =>
    {
      if (tp.player_profiles?.id)
      {
        playerProfileById.set(tp.player_profiles.id, {
          id: tp.player_profiles.id,
          name: tp.player_profiles.name,
          user_id: tp.player_profiles.user_id,
        });
      }
    });

    // Membership map user->role for role breakdowns
    const { data: teamMemberships } = await supabase
      .from('team_memberships')
      .select('user_id, role')
      .eq('team_id', teamId);

    const userRoleMap = new Map<string, string>();
    (teamMemberships || []).forEach(m =>
    {
      if (m.user_id) userRoleMap.set(m.user_id, m.role);
    });

    // Games for this team
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('id, opponent, date')
      .eq('team_id', teamId);

    if (gamesError)
    {
      res.status(400).json({ error: gamesError.message });
      return;
    }

    const gameIds = (games || []).map(g => g.id);
    const gameById = new Map<string, any>();
    (games || []).forEach(g => gameById.set(g.id, g));

    // Coaching points in date range
    const { data: points, error: pointsError } = await supabase
      .from('coaching_points')
      .select('id, game_id, title, created_at')
      .in('game_id', gameIds.length ? gameIds : ['00000000-0000-0000-0000-000000000000'])
      .gte('created_at', startISO)
      .lte('created_at', endISO);

    if (pointsError)
    {
      res.status(400).json({ error: pointsError.message });
      return;
    }

    const pointIds = (points || []).map(p => p.id);
    const pointById = new Map<string, any>();
    (points || []).forEach(p => pointById.set(p.id, p));

    // View events in range (for points in scope)
    const { data: viewEvents, error: viewEventsError } = pointIds.length === 0 ?
      { data: [], error: null } :
      await supabase
        .from('coaching_point_view_events')
        .select('point_id, user_id, completion_percentage, created_at')
        .in('point_id', pointIds)
        .gte('created_at', startISO)
        .lte('created_at', endISO);

    if (viewEventsError)
    {
      res.status(400).json({ error: viewEventsError.message });
      return;
    }

    // Acknowledgments in range (for points in scope)
    const { data: acks, error: acksError } = pointIds.length === 0 ?
      { data: [], error: null } :
      await supabase
        .from('coaching_point_acknowledgments')
        .select('id, point_id, player_id, ack_at, acknowledged')
        .in('point_id', pointIds)
        .eq('acknowledged', true)
        .gte('ack_at', startISO)
        .lte('ack_at', endISO);

    if (acksError)
    {
      res.status(400).json({ error: acksError.message });
      return;
    }

    // Totals
    const totalPoints = (points || []).length;
    const totalViews = (viewEvents || []).length;

    // Per (point,user) max completion - fixed to include all possible combinations
    const playersWithUserIds = (teamPlayers || [])
      .map(tp => tp.player_profiles)
      .filter(p => !!p?.user_id)
      .map(p => ({ user_id: p!.user_id! }));
    const avgCompletionPercent = calculateAvgCompletionPercent(viewEvents, pointIds, playersWithUserIds);

    // Build per (point,user) max completion map for other calculations that still need it
    const perUserPointMax = buildPerUserPointMaxMap(viewEvents);

    // % Acknowledged: acknowledged_count / (total_points * total_players)
    const totalPossibleAcks = totalPoints * totalPlayers;
    const acknowledgedCount = (acks || []).length;
    const percentAcknowledged = totalPossibleAcks > 0 ?
      Math.round((acknowledgedCount / totalPossibleAcks) * 100) :
      0;

    // Engagement heatmap (UTC day-of-week/hour)
    const heatmapMap = new Map<string, number>(); // "dow-hour" -> views
    (viewEvents || []).forEach(ev =>
    {
      const d = new Date(ev.created_at);
      const dow = d.getUTCDay(); // 0..6
      const hour = d.getUTCHours(); // 0..23
      const key = `${dow}-${hour}`;
      heatmapMap.set(key, (heatmapMap.get(key) || 0) + 1);
    });
    const engagementHeatmap = Array.from(heatmapMap.entries())
      .map(([k, views]) =>
      {
        const [dowStr, hourStr] = k.split('-');
        return { dow: Number(dowStr), hour: Number(hourStr), views };
      })
      .sort((a, b) => a.dow - b.dow || a.hour - b.hour);

    // Per-role breakdown (total views & avg % viewed using per-user-point max)
    const roles = ['coach', 'admin', 'player', 'guardian'];
    const roleViewsCount = new Map<string, number>();
    (viewEvents || []).forEach(ev =>
    {
      const role = ev.user_id ? userRoleMap.get(ev.user_id) : undefined;
      if (role) roleViewsCount.set(role, (roleViewsCount.get(role) || 0) + 1);
    });

    const roleAgg: Record<string, { sum: number; count: number; }> = {};
    perUserPointMax.forEach((v, key) =>
    {
      const [, uid] = key.split('__');
      const role = uid ? userRoleMap.get(uid) : undefined;
      if (!role) return;
      if (!roleAgg[role]) roleAgg[role] = { sum: 0, count: 0 };
      roleAgg[role].sum += v || 0;
      roleAgg[role].count += 1;
    });

    const perRoleBreakdown = roles.map(role =>
    {
      const agg = roleAgg[role];
      const avg = agg && agg.count > 0 ? Math.round(agg.sum / agg.count) : 0;
      return {
        role,
        totalViews: roleViewsCount.get(role) || 0,
        avgCompletionPercent: avg,
      };
    });

    // Views by game (for highest/lowest)
    const viewsByGame = new Map<string, number>();
    (viewEvents || []).forEach(ev =>
    {
      const p = ev.point_id ? pointById.get(ev.point_id) : null;
      if (!p) return;
      const gId = p.game_id as string;
      viewsByGame.set(gId, (viewsByGame.get(gId) || 0) + 1);
    });

    const gameSummaries = (games || []).map(g =>
    {
      const count = viewsByGame.get(g.id) || 0;
      return { id: g.id, opponent: g.opponent, date: g.date, views: count };
    });

    const gamesMostViewed = [...gameSummaries].sort((a, b) => b.views - a.views).slice(0, 5);
    const gamesLeastViewed = [...gameSummaries].sort((a, b) => a.views - b.views).slice(0, 5);

    // Top players by engagement (linked players only)
    const linkedPlayers = (teamPlayers || [])
      .map(tp => tp.player_profiles)
      .filter((p): p is { id: string; name: string; user_id: string; } => !!p?.id && !!p?.user_id);

    // Tags (points in scope for players on this team)
    const playerIds = linkedPlayers.map(p => p.id);
    const { data: tags, error: tagsError } = pointIds.length === 0 || playerIds.length === 0 ?
      { data: [], error: null } :
      await supabase
        .from('coaching_point_tagged_players')
        .select('point_id, player_id')
        .in('point_id', pointIds)
        .in('player_id', playerIds);

    if (tagsError)
    {
      res.status(400).json({ error: tagsError.message });
      return;
    }

    const tagsByPlayer = new Map<string, string[]>();
    (tags || []).forEach(t =>
    {
      const arr = tagsByPlayer.get(t.player_id) || [];
      arr.push(t.point_id);
      tagsByPlayer.set(t.player_id, arr);
    });

    // Ack counts per player
    const ackCountByPlayer = new Map<string, number>();
    (acks || []).forEach(a =>
    {
      const pid = a.player_id as string;
      ackCountByPlayer.set(pid, (ackCountByPlayer.get(pid) || 0) + 1);
    });

    // Calculate comprehensive player engagement scores using utility function
    const playerScores = calculatePlayerEngagementScores(
      linkedPlayers,
      pointIds,
      tagsByPlayer,
      ackCountByPlayer,
      perUserPointMax,
    ).filter(ps => (tagsByPlayer.get(ps.player_profile_id)?.length || 0) > 0);

    const topPlayers = playerScores
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(p => ({
        player_profile_id: p.player_profile_id,
        name: p.name,
        scorePercent: Math.round(p.score * 100),
        ackRatePercent: Math.round(p.ackRate * 100),
        completionPercent: Math.round(p.completionRate * 100),
        // Enhanced: Tagged-specific metrics
        taggedAckRatePercent: Math.round(p.taggedAckRate * 100),
        taggedCompletionPercent: Math.round(p.taggedCompletionRate * 100),
        taggedScorePercent: Math.round(p.taggedScore * 100),
      }));

    res.json({
      totals: {
        totalPoints,
        totalViews,
        percentAcknowledged,
        avgCompletionPercent,
      },
      perRoleBreakdown,
      engagementHeatmap,
      topPlayers,
      gamesMostViewed,
      gamesLeastViewed,
    });
  }
  catch (error)
  {
    console.error('Error in GET /analytics/team/:teamId:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/analytics/game/:gameId
 * Game-level analytics (coaches/admins)
 * Query: ?start=&end= (ISO strings, optional; defaults to last 30 days based on parseDateRange)
 */
router.get('/game/:gameId', authenticateUser, async (req: AuthenticatedRequest, res: Response): Promise<void> =>
{
  try
  {
    const userId = req.user?.id;
    const { gameId } = req.params;
    if (!userId)
    {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // Load game and team access
    const { data: game, error: gameErr } = await supabase
      .from('games')
      .select('id, team_id, opponent, date')
      .eq('id', gameId)
      .single();

    if (gameErr || !game)
    {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    // Verify role
    const { data: membership, error: memErr } = await supabase
      .from('team_memberships')
      .select('role')
      .eq('team_id', game.team_id)
      .eq('user_id', userId)
      .single();

    if (memErr || !membership || (membership.role !== 'coach' && membership.role !== 'admin'))
    {
      res.status(403).json({ error: 'Only coaches and admins can view game analytics' });
      return;
    }

    const { startISO, endISO } = parseDateRange(req.query);

    // Coaching points for this game in range
    const { data: points, error: pointsErr } = await supabase
      .from('coaching_points')
      .select('id, title, created_at')
      .eq('game_id', gameId)
      .gte('created_at', startISO)
      .lte('created_at', endISO);

    if (pointsErr)
    {
      res.status(400).json({ error: pointsErr.message });
      return;
    }

    const pointIds = (points || []).map(p => p.id);

    // Tags for these points
    const { data: tags, error: tagsErr } = pointIds.length === 0 ?
      { data: [], error: null } :
      await supabase
        .from('coaching_point_tagged_players')
        .select('point_id, player_id')
        .in('point_id', pointIds);

    if (tagsErr)
    {
      res.status(400).json({ error: tagsErr.message });
      return;
    }

    // Acknowledgments (true) for these points (in window)
    const { data: acks, error: acksErr } = pointIds.length === 0 ?
      { data: [], error: null } :
      await supabase
        .from('coaching_point_acknowledgments')
        .select('point_id, player_id, ack_at, acknowledged')
        .in('point_id', pointIds)
        .eq('acknowledged', true)
        .gte('ack_at', startISO)
        .lte('ack_at', endISO);

    if (acksErr)
    {
      res.status(400).json({ error: acksErr.message });
      return;
    }

    // View summary for unique viewers
    const { data: viewSummaries, error: vsErr } = pointIds.length === 0 ?
      { data: [], error: null } :
      await supabase
        .from('coaching_point_view_summary')
        .select('point_id, user_id, last_viewed_at')
        .in('point_id', pointIds);

    if (vsErr)
    {
      res.status(400).json({ error: vsErr.message });
      return;
    }

    // View events (for avg completion and timeline)
    const { data: viewEvents, error: veErr } = pointIds.length === 0 ?
      { data: [], error: null } :
      await supabase
        .from('coaching_point_view_events')
        .select('point_id, user_id, completion_percentage, created_at')
        .in('point_id', pointIds)
        .gte('created_at', startISO)
        .lte('created_at', endISO);

    if (veErr)
    {
      res.status(400).json({ error: veErr.message });
      return;
    }

    // Unique viewers across the game
    const uniqUsers = new Set<string>();
    (viewSummaries || []).forEach(vs =>
    {
      if (vs.user_id) uniqUsers.add(vs.user_id);
    });
    const uniqueViewers = uniqUsers.size;

    // Total views
    const totalViews = (viewEvents || []).length;

    // Percent points acknowledged: compute over total tags (tags are the denominator)
    const tagsByPoint = new Map<string, number>();
    (tags || []).forEach(t =>
    {
      tagsByPoint.set(t.point_id, (tagsByPoint.get(t.point_id) || 0) + 1);
    });
    const acksByPoint = new Map<string, number>();
    (acks || []).forEach(a =>
    {
      acksByPoint.set(a.point_id, (acksByPoint.get(a.point_id) || 0) + 1);
    });

    const totalTags = (tags || []).length;
    const totalAcks = (acks || []).length;
    const percentPointsAcknowledged = totalTags > 0 ? Math.round((totalAcks / totalTags) * 100) : 0;

    // Per (point,user) max completion
    const perUserPointMax = buildPerUserPointMaxMap(viewEvents);

    // Avg completion across all views (per-user max)
    const maxValues = Array.from(perUserPointMax.values());
    const avgCompletionPercent = maxValues.length > 0 ?
      Math.round(maxValues.reduce((s, v) => s + (v || 0), 0) / maxValues.length) :
      0;

    // Per-point engagement table
    const lastViewedByPoint = new Map<string, string | null>();
    (viewSummaries || []).forEach(vs =>
    {
      const existing = lastViewedByPoint.get(vs.point_id);
      const cur = vs.last_viewed_at ? new Date(vs.last_viewed_at).toISOString() : null;
      if (!existing || (cur && cur > existing)) lastViewedByPoint.set(vs.point_id, cur);
    });

    // Avg completion per point (per-user max grouped by point)
    const perPointAgg: Record<string, { sum: number; count: number; }> = {};
    perUserPointMax.forEach((v, key) =>
    {
      const [pid] = key.split('__');
      if (!perPointAgg[pid]) perPointAgg[pid] = { sum: 0, count: 0 };
      perPointAgg[pid].sum += v || 0;
      perPointAgg[pid].count += 1;
    });

    const perPointAvgCompletion = new Map<string, number>();
    Object.entries(perPointAgg).forEach(([pid, agg]) =>
    {
      const avg = agg.count > 0 ? Math.round(agg.sum / agg.count) : 0;
      perPointAvgCompletion.set(pid, avg);
    });

    const viewsByPoint = new Map<string, number>();
    (viewEvents || []).forEach(ev =>
    {
      const pid = ev.point_id as string;
      viewsByPoint.set(pid, (viewsByPoint.get(pid) || 0) + 1);
    });

    const perPointEngagement = (points || []).map(p =>
    {
      const pid = p.id as string;
      const tagged = tagsByPoint.get(pid) || 0;
      const acked = acksByPoint.get(pid) || 0;
      return {
        pointId: pid,
        title: p.title,
        taggedPlayers: tagged,
        views: viewsByPoint.get(pid) || 0,
        avgCompletionPercent: perPointAvgCompletion.get(pid) || 0,
        percentAckd: tagged > 0 ? Math.round((acked / tagged) * 100) : 0,
        lastViewedAt: lastViewedByPoint.get(pid) || null,
      };
    });

    // View timeline relative to game date (days since game date)
    const gameDate = game.date ? new Date(game.date) : null;
    const viewTimeline = (viewEvents || []).map(ev =>
    {
      const created = new Date(ev.created_at);
      let daysSinceGame = null as number | null;
      if (gameDate) daysSinceGame = Math.floor((created.getTime() - gameDate.getTime()) / (1000 * 60 * 60 * 24));
      return {
        pointId: ev.point_id,
        created_at: created.toISOString(),
        daysSinceGame,
      };
    });

    // Point type breakdown (labels)
    const { data: pointLabels, error: labelsErr } = pointIds.length === 0 ?
      { data: [], error: null } :
      await supabase
        .from('coaching_point_labels')
        .select('point_id, labels!inner(id, name)')
        .in('point_id', pointIds);

    if (labelsErr)
    {
      res.status(400).json({ error: labelsErr.message });
      return;
    }

    const byLabel = new Map<string, { label: string; points: number; views: number; }>();
    (pointLabels || []).forEach(row =>
    {
      const labelRow = Array.isArray(row.labels) ? row.labels[0] : row.labels;
      const labelName = labelRow?.name || 'Unlabeled';
      const pid = row.point_id as string;
      const rec = byLabel.get(labelName) || { label: labelName, points: 0, views: 0 };
      rec.points += 1;
      rec.views += viewsByPoint.get(pid) || 0;
      byLabel.set(labelName, rec);
    });

    res.json({
      game: { id: game.id, opponent: game.opponent, date: game.date },
      numberOfCoachingPoints: (points || []).length,
      totalViews,
      uniqueViewers,
      percentPointsAcknowledged,
      avgCompletionPercent,
      perPointEngagement,
      viewTimeline,
      pointTypeBreakdown: Array.from(byLabel.values()).sort((a, b) => b.points - a.points),
    });
  }
  catch (error)
  {
    console.error('Error in GET /analytics/game/:gameId:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/analytics/player/:playerProfileId
 * Player dashboard across all teams/games
 */
router.get(
  '/player/:playerProfileId',
  authenticateUser,
  async (req: AuthenticatedRequest, res: Response): Promise<void> =>
  {
    try
    {
      const userId = req.user?.id;
      const { playerProfileId } = req.params;
      if (!userId)
      {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      // Get teams this player is on
      const { data: playerTeams, error: ptErr } = await supabase
        .from('team_players')
        .select('team_id')
        .eq('player_id', playerProfileId);

      if (ptErr)
      {
        res.status(400).json({ error: ptErr.message });
        return;
      }
      const teamIds = (playerTeams || []).map(t => t.team_id);
      if (teamIds.length === 0)
      {
        res.json({
          totals: {
            totalTaggedPoints: 0,
            percentViewed: 0,
            percentAcknowledged: 0,
            avgCompletionPercent: 0,
            avgTimeToFirstViewMs: null,
            avgTimeToAcknowledgeMs: null,
          },
          engagementOverTime: [],
          mostViewedTaggedPoints: [],
          leastViewedTaggedPoints: [],
        });
        return;
      }

      // Verify requester is coach/admin on at least one of these teams
      const { data: myMemberships, error: memErr } = await supabase
        .from('team_memberships')
        .select('team_id, role')
        .eq('user_id', userId)
        .in('team_id', teamIds);

      if (memErr)
      {
        res.status(400).json({ error: memErr.message });
        return;
      }

      const hasCoachAccess = (myMemberships || []).some(m => m.role === 'coach' || m.role === 'admin');
      if (!hasCoachAccess)
      {
        res.status(403).json({ error: 'Only coaches/admins of this player’s teams can view player analytics' });
        return;
      }

      // Load player profile (to get linked user)
      const { data: playerProfile, error: ppErr } = await supabase
        .from('player_profiles')
        .select('id, name, user_id, created_at')
        .eq('id', playerProfileId)
        .single();

      if (ppErr || !playerProfile)
      {
        res.status(404).json({ error: 'Player not found' });
        return;
      }

      // All games for these teams
      const { data: games, error: gamesErr } = await supabase
        .from('games')
        .select('id, team_id, date, opponent')
        .in('team_id', teamIds);

      if (gamesErr)
      {
        res.status(400).json({ error: gamesErr.message });
        return;
      }
      const gameIds = (games || []).map(g => g.id);

      // Points across those games
      const { data: points, error: pointsErr } = gameIds.length === 0 ?
        { data: [], error: null } :
        await supabase
          .from('coaching_points')
          .select('id, game_id, title, created_at')
          .in('game_id', gameIds);

      if (pointsErr)
      {
        res.status(400).json({ error: pointsErr.message });
        return;
      }
      const pointIds = (points || []).map(p => p.id);

      // Tags for this player
      const { data: tags, error: tagsErr } = pointIds.length === 0 ?
        { data: [], error: null } :
        await supabase
          .from('coaching_point_tagged_players')
          .select('point_id')
          .in('point_id', pointIds)
          .eq('player_id', playerProfileId);

      if (tagsErr)
      {
        res.status(400).json({ error: tagsErr.message });
        return;
      }

      const taggedPointSet = new Set<string>((tags || []).map(t => t.point_id));
      const taggedPoints = (points || []).filter(p => taggedPointSet.has(p.id));
      const totalTaggedPoints = taggedPoints.length;

      // Acks for this player
      const { data: acks, error: acksErr } = totalTaggedPoints === 0 ?
        { data: [], error: null } :
        await supabase
          .from('coaching_point_acknowledgments')
          .select('point_id, ack_at, acknowledged')
          .eq('player_id', playerProfileId)
          .in('point_id', Array.from(taggedPointSet))
          .eq('acknowledged', true);

      if (acksErr)
      {
        res.status(400).json({ error: acksErr.message });
        return;
      }

      // Player's own views (if linked)
      let myViewSummaries: any[] = [];
      let myViewEvents: any[] = [];
      if (playerProfile.user_id)
      {
        const userIdForPlayer = playerProfile.user_id as string;
        const { data: vs, error: vsErr } = await supabase
          .from('coaching_point_view_summary')
          .select('point_id, first_viewed_at, last_viewed_at, user_id')
          .in('point_id', Array.from(taggedPointSet))
          .eq('user_id', userIdForPlayer);

        if (vsErr)
        {
          res.status(400).json({ error: vsErr.message });
          return;
        }
        myViewSummaries = vs || [];

        const { data: ve, error: veErr } = await supabase
          .from('coaching_point_view_events')
          .select('point_id, user_id, completion_percentage, created_at')
          .in('point_id', Array.from(taggedPointSet))
          .eq('user_id', userIdForPlayer);

        if (veErr)
        {
          res.status(400).json({ error: veErr.message });
          return;
        }
        myViewEvents = ve || [];
      }

      // Percent viewed (among tagged points)
      const viewedTagged = new Set<string>();
      (myViewSummaries || []).forEach(vs =>
      {
        if (vs.point_id) viewedTagged.add(vs.point_id);
      });
      const percentViewed = totalTaggedPoints > 0 ? Math.round((viewedTagged.size / totalTaggedPoints) * 100) : 0;

      // Percent acknowledged (among tagged points)
      const ackedTagged = (acks || []).length;
      const percentAcknowledged = totalTaggedPoints > 0 ? Math.round((ackedTagged / totalTaggedPoints) * 100) : 0;

      // Avg completion across tagged points (using per-user max)
      type Key = string;
      const perPointMax = new Map<Key, number>();
      (myViewEvents || []).forEach(ev =>
      {
        const key = `${ev.point_id}`;
        const val = typeof ev.completion_percentage === 'number' ? ev.completion_percentage : 0;
        const prev = perPointMax.get(key);
        if (prev === undefined || val > prev) perPointMax.set(key, val);
      });
      const compVals = Array.from(perPointMax.values());
      const avgCompletionPercent = compVals.length > 0 ?
        Math.round(compVals.reduce((s, v) => s + v, 0) / compVals.length) :
        0;

      // Time to first view / acknowledge
      const pointCreatedAt = new Map<string, string>();
      (taggedPoints || []).forEach(p =>
      {
        pointCreatedAt.set(p.id, p.created_at || '');
      });

      const deltasFirstView: number[] = [];
      (myViewSummaries || []).forEach(vs =>
      {
        const created = pointCreatedAt.get(vs.point_id);
        if (!created || !vs.first_viewed_at) return;
        const dt = new Date(vs.first_viewed_at).getTime() - new Date(created).getTime();
        if (!Number.isNaN(dt)) deltasFirstView.push(dt);
      });
      const avgTimeToFirstViewMs = deltasFirstView.length > 0 ?
        Math.round(deltasFirstView.reduce((s, v) => s + v, 0) / deltasFirstView.length) :
        null;

      const deltasAck: number[] = [];
      (acks || []).forEach(a =>
      {
        const created = pointCreatedAt.get(a.point_id);
        if (!created || !a.ack_at) return;
        const dt = new Date(a.ack_at).getTime() - new Date(created).getTime();
        if (!Number.isNaN(dt)) deltasAck.push(dt);
      });
      const avgTimeToAcknowledgeMs = deltasAck.length > 0 ?
        Math.round(deltasAck.reduce((s, v) => s + v, 0) / deltasAck.length) :
        null;

      // Engagement over time (player's own views)
      const engagementOverTime = calculateEngagementOverTime(myViewEvents, 'daily');

      // Rank tagged points by player's own views
      const myViewsByPoint = new Map<string, number>();
      (myViewEvents || []).forEach(ev =>
      {
        myViewsByPoint.set(ev.point_id, (myViewsByPoint.get(ev.point_id) || 0) + 1);
      });

      const taggedPointSummaries = taggedPoints.map(p => ({
        pointId: p.id,
        title: p.title as string,
        viewsByPlayer: myViewsByPoint.get(p.id) || 0,
      }));

      const mostViewedTaggedPoints = [...taggedPointSummaries].sort((a, b) => b.viewsByPlayer - a.viewsByPlayer).slice(
        0,
        5,
      );
      const leastViewedTaggedPoints = [...taggedPointSummaries].sort((a, b) => a.viewsByPlayer - b.viewsByPlayer).slice(
        0,
        5,
      );
      // Not viewed tagged points (zero views)
      const gamesByIdForPlayer = new Map<string, any>();
      (games || []).forEach(g => gamesByIdForPlayer.set(g.id, g));
      const notViewedTaggedPoints = taggedPoints
        .filter(p => (myViewsByPoint.get(p.id) || 0) === 0)
        .map(p =>
        {
          const gm = gamesByIdForPlayer.get(p.game_id);
          return {
            pointId: p.id,
            title: p.title as string,
            game: gm ? { id: gm.id, opponent: gm.opponent, date: gm.date } : null,
            created_at: p.created_at,
          };
        })
        .sort((a, b) =>
        {
          const bt = b.created_at ? new Date(b.created_at).getTime() : 0;
          const at = a.created_at ? new Date(a.created_at).getTime() : 0;
          return bt - at;
        })
        .slice(0, 25);

      // Unacknowledged tagged points list (those tagged but not acknowledged)
      const ackedPointIds = new Set<string>((acks || []).map(a => a.point_id));
      const gamesById = new Map<string, any>();
      (games || []).forEach(g => gamesById.set(g.id, g));
      const unacknowledgedTaggedPoints = taggedPoints
        .filter(p => !ackedPointIds.has(p.id))
        .map(p =>
        {
          const gm = gamesById.get(p.game_id);
          return {
            pointId: p.id,
            title: p.title as string,
            game: gm ? { id: gm.id, opponent: gm.opponent, date: gm.date } : null,
            created_at: p.created_at,
          };
        })
        .sort((a, b) =>
        {
          const bt = b.created_at ? new Date(b.created_at).getTime() : 0;
          const at = a.created_at ? new Date(a.created_at).getTime() : 0;
          return bt - at;
        })
        .slice(0, 10); // cap list to prevent overload

      res.json({
        player: { id: playerProfile.id, name: playerProfile.name, hasUser: !!playerProfile.user_id },
        totals: {
          totalTaggedPoints,
          percentViewed,
          percentAcknowledged,
          avgCompletionPercent,
          avgTimeToFirstViewMs,
          avgTimeToAcknowledgeMs,
        },
        engagementOverTime,
        mostViewedTaggedPoints,
        leastViewedTaggedPoints,
        notViewedTaggedPoints,
        unacknowledgedTaggedPoints,
      });
    }
    catch (error)
    {
      console.error('Error in GET /analytics/player/:playerProfileId:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * GET /api/analytics/point/:pointId
 * Coaching Point detail analytics
 */
router.get('/point/:pointId', authenticateUser, async (req: AuthenticatedRequest, res: Response): Promise<void> =>
{
  try
  {
    const userId = req.user?.id;
    const { pointId } = req.params;
    if (!userId)
    {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // Load point -> game -> team
    const { data: point, error: pErr } = await supabase
      .from('coaching_points')
      .select('id, title, game_id, created_at')
      .eq('id', pointId)
      .single();

    if (pErr || !point)
    {
      res.status(404).json({ error: 'Coaching point not found' });
      return;
    }

    const { data: game, error: gErr } = await supabase
      .from('games')
      .select('id, team_id, date, opponent')
      .eq('id', point.game_id)
      .single();

    if (gErr || !game)
    {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    // Verify role
    const { data: membership, error: memErr } = await supabase
      .from('team_memberships')
      .select('role')
      .eq('team_id', game.team_id)
      .eq('user_id', userId)
      .single();

    if (memErr || !membership || (membership.role !== 'coach' && membership.role !== 'admin'))
    {
      res.status(403).json({ error: 'Only coaches and admins can view point analytics' });
      return;
    }

    // Tagged players
    const { data: tags, error: tErr } = await supabase
      .from('coaching_point_tagged_players')
      .select('player_id, player_profiles!inner(id, name, user_id)')
      .eq('point_id', pointId);

    if (tErr)
    {
      res.status(400).json({ error: tErr.message });
      return;
    }

    // Acks (include notes)
    const { data: acks, error: aErr } = await supabase
      .from('coaching_point_acknowledgments')
      .select('player_id, acknowledged, ack_at, notes')
      .eq('point_id', pointId);

    if (aErr)
    {
      res.status(400).json({ error: aErr.message });
      return;
    }

    // View summaries (for unique viewers and last viewed)
    const { data: viewSummaries, error: vsErr } = await supabase
      .from('coaching_point_view_summary')
      .select('user_id, first_viewed_at, last_viewed_at')
      .eq('point_id', pointId);

    if (vsErr)
    {
      res.status(400).json({ error: vsErr.message });
      return;
    }

    // View events (for completion distribution)
    const { data: viewEvents, error: veErr } = await supabase
      .from('coaching_point_view_events')
      .select('user_id, completion_percentage, created_at')
      .eq('point_id', pointId);

    if (veErr)
    {
      res.status(400).json({ error: veErr.message });
      return;
    }

    // Recording events timeline (from coaching_point_events)
    const { data: cpEvents, error: cpeErr } = await supabase
      .from('coaching_point_events')
      .select('event_type, timestamp, event_data, created_at')
      .eq('point_id', pointId)
      .order('timestamp', { ascending: true });

    if (cpeErr)
    {
      res.status(400).json({ error: cpeErr.message });
      return;
    }

    // Build tagged players view/ack status
    const ackByPlayer = new Map<string, { acknowledged: boolean; ack_at: string | null; notes: string | null; }>();
    (acks || []).forEach(a =>
    {
      ackByPlayer.set(a.player_id, {
        acknowledged: !!a.acknowledged,
        ack_at: a.ack_at || null,
        notes: a.notes || null,
      });
    });

    // Map player_profile_id -> user_id to correlate with view summaries/events
    const playerMap: { id: string; name: string; user_id: string | null; }[] = (tags || []).map(t =>
    {
      const prof = Array.isArray(t.player_profiles) ? t.player_profiles[0] : t.player_profiles;
      return { id: prof?.id, name: prof?.name, user_id: prof?.user_id || null } as any;
    }).filter(p => p && p.id);

    // Per-user max completion for this point
    const perUserMax = new Map<string, number>();
    (viewEvents || []).forEach(ev =>
    {
      const uid = ev.user_id as string;
      const val = typeof ev.completion_percentage === 'number' ? ev.completion_percentage : 0;
      const prev = perUserMax.get(uid);
      if (prev === undefined || val > prev) perUserMax.set(uid, val);
    });

    const taggedPlayersStatus = playerMap.map(p =>
    {
      const ack = ackByPlayer.get(p.id) || { acknowledged: false, ack_at: null, notes: null };
      const userMax = p.user_id ? (perUserMax.get(p.user_id as string) ?? null) : null;
      return {
        player_profile_id: p.id,
        name: p.name,
        acknowledged: ack.acknowledged,
        ack_at: ack.ack_at,
        notes: ack.notes,
        maxCompletionPercent: userMax,
      };
    });

    // Totals
    const totalViews = (viewEvents || []).length;
    const uniqueViewers = (viewSummaries || []).length;

    // Completion distribution buckets using per-user max
    const buckets = [
      { range: '0-25', min: 0, max: 25, count: 0 },
      { range: '25-50', min: 25, max: 50, count: 0 },
      { range: '50-75', min: 50, max: 75, count: 0 },
      { range: '75-100', min: 75, max: 100, count: 0 },
    ];
    perUserMax.forEach(val =>
    {
      const v = typeof val === 'number' ? val : 0;
      if (v < 25) buckets[0].count += 1;
      else if (v < 50) buckets[1].count += 1;
      else if (v < 75) buckets[2].count += 1;
      else buckets[3].count += 1;
    });

    // Ack notes list
    const notes = (acks || [])
      .map(a => a.notes)
      .filter((n): n is string => !!n && n.trim().length > 0);

    res.json({
      point: { id: point.id, title: point.title, game: { id: game.id, opponent: game.opponent, date: game.date } },
      taggedPlayers: taggedPlayersStatus,
      totalViews,
      uniqueViewers,
      viewCompletionDistribution: buckets,
      recordingEventsTimeline: cpEvents || [],
      acknowledgmentNotes: notes,
    });
  }
  catch (error)
  {
    console.error('Error in GET /analytics/point/:pointId:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/analytics/coaching-point/:pointId - Get detailed coaching point analytics
router.get(
  '/coaching-point/:pointId',
  authenticateUser,
  async (req: AuthenticatedRequest, res: Response): Promise<void> =>
  {
    try
    {
      const userId = req.user?.id;
      if (!userId)
      {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const { pointId } = req.params;

      // Verify user has access to this coaching point (coach/admin on the team)
      const { data: accessCheck, error: accessError } = await supabase
        .from('coaching_points')
        .select(`
        id,
        title,
        feedback,
        timestamp,
        duration,
        created_at,
        games!inner(
          id,
          opponent,
          date,
          teams!inner(
            id,
            name,
            team_memberships!inner(
              user_id,
              role
            )
          )
        ),
        user_profiles!coaching_points_author_id_fkey(
          id,
          name
        )
      `)
        .eq('id', pointId)
        .eq('games.teams.team_memberships.user_id', userId)
        .in('games.teams.team_memberships.role', ['coach', 'admin'])
        .single();

      if (accessError || !accessCheck)
      {
        res.status(404).json({ error: 'Coaching point not found or access denied' });
        return;
      }

      // Get tagged players with their view/acknowledgment status
      const { data: taggedPlayersData, error: taggedError } = await supabase
        .from('coaching_point_tagged_players')
        .select(`
        player_profiles!inner(
          id,
          name
        )
      `)
        .eq('point_id', pointId);

      if (taggedError)
      {
        res.status(500).json({ error: 'Failed to fetch tagged players' });
        return;
      }

      // Get view/acknowledgment status for each tagged player
      const taggedPlayers = await Promise.all((taggedPlayersData || []).map(async (tp) =>
      {
        const playerId = tp.player_profiles.id;

        // Get view status
        const { data: viewSummary } = await supabase
          .from('coaching_point_view_summary')
          .select('view_count, first_viewed_at, last_viewed_at')
          .eq('point_id', pointId)
          .eq('user_id', playerId)
          .single();

        // Get acknowledgment status
        const { data: ackData } = await supabase
          .from('coaching_point_acknowledgments')
          .select('acknowledged, ack_at, notes')
          .eq('point_id', pointId)
          .eq('player_id', playerId)
          .single();

        // Get latest completion percentage
        const { data: latestView } = await supabase
          .from('coaching_point_view_events')
          .select('completion_percentage')
          .eq('point_id', pointId)
          .eq('user_id', playerId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        return {
          player_id: playerId,
          name: tp.player_profiles.name,
          view_count: viewSummary?.view_count || 0,
          first_viewed_at: viewSummary?.first_viewed_at || null,
          last_viewed_at: viewSummary?.last_viewed_at || null,
          latest_completion_percent: latestView?.completion_percentage || 0,
          acknowledged: ackData?.acknowledged || false,
          ack_at: ackData?.ack_at || null,
          ack_notes: ackData?.notes || null,
        };
      }));

      // Get total views and unique viewers
      const { data: viewStats, error: viewStatsError } = await supabase
        .from('coaching_point_view_events')
        .select('user_id, completion_percentage')
        .eq('point_id', pointId);

      if (viewStatsError)
      {
        res.status(500).json({ error: 'Failed to fetch view statistics' });
        return;
      }

      const totalViews = viewStats?.length || 0;
      const uniqueViewers = new Set(viewStats?.map(v => v.user_id) || []).size;

      // Build completion distribution (histogram)
      const completionBuckets = {
        '0-25%': 0,
        '25-50%': 0,
        '50-75%': 0,
        '75-100%': 0,
      };

      viewStats?.forEach(v =>
      {
        const completion = v.completion_percentage || 0;
        if (completion < 25) completionBuckets['0-25%']++;
        else if (completion < 50) completionBuckets['25-50%']++;
        else if (completion < 75) completionBuckets['50-75%']++;
        else completionBuckets['75-100%']++;
      });

      // Get view events timeline from coaching_point_events
      const { data: viewEvents, error: eventsError } = await supabase
        .from('coaching_point_events')
        .select('event_type, timestamp, event_data, created_at')
        .eq('point_id', pointId)
        .order('timestamp', { ascending: true });

      if (eventsError)
      {
        res.status(500).json({ error: 'Failed to fetch view events' });
        return;
      }

      // Get acknowledgment notes (avoid FK join which can fail due to RLS; map names from taggedPlayers instead)
      const { data: ackNotes, error: notesError } = await supabase
        .from('coaching_point_acknowledgments')
        .select('player_id, notes, ack_at')
        .eq('point_id', pointId)
        .not('notes', 'is', null)
        .order('ack_at', { ascending: false });

      if (notesError)
      {
        console.error('Acknowledgment notes query failed:', notesError);
        res.status(500).json({ error: 'Failed to fetch acknowledgment notes' });
        return;
      }

      const result = {
        coachingPoint: {
          id: accessCheck.id,
          title: accessCheck.title,
          feedback: accessCheck.feedback,
          timestamp: accessCheck.timestamp,
          duration: accessCheck.duration,
          created_at: accessCheck.created_at,
          author: accessCheck.user_profiles?.name || 'Unknown',
          game: {
            id: accessCheck.games.id,
            opponent: accessCheck.games.opponent,
            date: accessCheck.games.date,
            team_name: accessCheck.games.teams.name,
          },
        },
        taggedPlayers,
        totalViews,
        uniqueViewers,
        completionDistribution: completionBuckets,
        viewEventsTimeline: viewEvents || [],
        acknowledgmentNotes: (ackNotes || []).map(note => ({
          player_name: taggedPlayers.find(tp => tp.player_id === (note as any).player_id)?.name || 'Unknown',
          notes: (note as any).notes,
          ack_at: (note as any).ack_at,
        })),
      };

      res.json(result);
    }
    catch (error)
    {
      console.error('Error fetching coaching point details:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// GET /api/analytics/coach-players - Get all players from teams where user is coach/admin
router.get('/coach-players', authenticateUser, async (req: AuthenticatedRequest, res: Response): Promise<void> =>
{
  try
  {
    const userId = req.user?.id;
    if (!userId)
    {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // Get teams where user is coach/admin
    const { data: memberships, error: membershipError } = await supabase
      .from('team_memberships')
      .select('team_id, role')
      .eq('user_id', userId)
      .in('role', ['coach', 'admin']);

    if (membershipError)
    {
      res.status(400).json({ error: membershipError.message });
      return;
    }

    const teamIds = (memberships || []).map(m => m.team_id);
    if (teamIds.length === 0)
    {
      res.json([]);
      return;
    }

    // Get team names
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('id, name')
      .in('id', teamIds);

    if (teamsError)
    {
      res.status(400).json({ error: teamsError.message });
      return;
    }

    const teamNameMap = new Map<string, string>();
    (teams || []).forEach(t => teamNameMap.set(t.id, t.name));

    // Get players from these teams
    const { data: teamPlayers, error: playersError } = await supabase
      .from('team_players')
      .select(`
        team_id,
        player_profiles!inner(
          id,
          name
        )
      `)
      .in('team_id', teamIds);

    if (playersError)
    {
      res.status(400).json({ error: playersError.message });
      return;
    }

    // Format response including team_id so frontend can filter by team first.
    // We intentionally do NOT de-duplicate across teams; the frontend will show
    // only players for the selected team, so duplicates are not surfaced.
    const players = (teamPlayers || []).map(tp => ({
      id: tp.player_profiles.id,
      name: tp.player_profiles.name,
      team_id: tp.team_id,
      team_name: teamNameMap.get(tp.team_id) || 'Unknown Team',
    }));

    res.json(players);
  }
  catch (error)
  {
    console.error('Error fetching coach players:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/analytics/coaching-points - Get all coaching points from teams where user is coach/admin
router.get('/coaching-points', authenticateUser, async (req: AuthenticatedRequest, res: Response): Promise<void> =>
{
  try
  {
    const userId = req.user?.id;
    if (!userId)
    {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // Get teams where user is coach/admin
    const { data: memberships, error: membershipError } = await supabase
      .from('team_memberships')
      .select('team_id, role')
      .eq('user_id', userId)
      .in('role', ['coach', 'admin']);

    if (membershipError)
    {
      res.status(400).json({ error: membershipError.message });
      return;
    }

    const teamIds = (memberships || []).map(m => m.team_id);
    if (teamIds.length === 0)
    {
      res.json([]);
      return;
    }

    // Get games for these teams
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('id, team_id, opponent, date')
      .in('team_id', teamIds);

    if (gamesError)
    {
      res.status(400).json({ error: gamesError.message });
      return;
    }

    const gameIds = (games || []).map(g => g.id);
    const gameMap = new Map<string, any>();
    (games || []).forEach(g => gameMap.set(g.id, g));

    // Get team names
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('id, name')
      .in('id', teamIds);

    if (teamsError)
    {
      res.status(400).json({ error: teamsError.message });
      return;
    }

    const teamNameMap = new Map<string, string>();
    (teams || []).forEach(t => teamNameMap.set(t.id, t.name));

    // Get coaching points for these games
    const { data: coachingPoints, error: pointsError } = gameIds.length === 0 ?
      { data: [], error: null } :
      await supabase
        .from('coaching_points')
        .select('id, game_id, title, created_at, timestamp')
        .in('game_id', gameIds)
        .order('created_at', { ascending: false });

    if (pointsError)
    {
      res.status(400).json({ error: pointsError.message });
      return;
    }

    // Format response (include identifiers for filtering)
    const points = (coachingPoints || []).map(cp =>
    {
      const game = gameMap.get(cp.game_id);
      return {
        id: cp.id,
        title: cp.title,
        game_id: cp.game_id,
        game_opponent: game?.opponent || 'Unknown',
        game_date: game?.date || '',
        team_id: game?.team_id || null,
        team_name: teamNameMap.get(game?.team_id) || 'Unknown Team',
        timestamp: cp.timestamp || 0,
      };
    });

    res.json(points);
  }
  catch (error)
  {
    console.error('Error fetching coaching points:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
