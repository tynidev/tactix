import express, { Response } from 'express';
import { type AuthenticatedRequest, authenticateUser } from '../middleware/auth.js';
import { supabase } from '../utils/supabase.js';

const router = express.Router();

/**
 * Options for filtering views in getViewsWithGuardianSupport
 */
export interface ViewsQueryOptions
{
  teamId?: string;
  playerId?: string;
  startDate?: string;
  endDate?: string;
  coachingPointId?: string;
  gameId?: string;
  coachId?: string;
}

/**
 * Comprehensive function to get views by any combination of filters.
 * Handles both direct player views (when player has user_profile) and
 * guardian views (when player doesn't have user_profile).
 */
export async function getViewsWithGuardianSupport(options: ViewsQueryOptions): Promise<
  Array<{
    player_profile_id: string;
    player_name: string;
    point_id: string;
    point_title: string;
    game_id: string;
    team_id: string;
    completion_percentage: number | null;
    created_at: string;
    view_source: 'direct' | 'guardian';
    guardian_id?: string;
  }>
>
{
  // Build dynamic WHERE clauses based on provided options
  const whereConditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  // Helper to add parameterized condition
  const addCondition = (condition: string, value: any) =>
  {
    whereConditions.push(`${condition} = $${paramIndex}`);
    params.push(value);
    paramIndex++;
  };

  // Helper to add date range condition
  const addDateRange = (field: string) =>
  {
    if (options.startDate)
    {
      whereConditions.push(`${field} >= $${paramIndex}`);
      params.push(options.startDate);
      paramIndex++;
    }
    if (options.endDate)
    {
      whereConditions.push(`${field} <= $${paramIndex}`);
      params.push(options.endDate);
      paramIndex++;
    }
  };

  // Build filter conditions
  if (options.teamId) addCondition('g.team_id', options.teamId);
  if (options.playerId) addCondition('pp.id', options.playerId);
  if (options.coachingPointId) addCondition('cp.id', options.coachingPointId);
  if (options.gameId) addCondition('g.id', options.gameId);
  if (options.coachId) addCondition('cp.author_id', options.coachId);

  // Add date range for view events
  addDateRange('cpve.created_at');

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

  const query = `
    WITH direct_player_views AS (
      -- Get views for players who have their own user accounts
      SELECT 
        pp.id as player_profile_id,
        pp.name as player_name,
        cp.id as point_id,
        cp.title as point_title,
        g.id as game_id,
        g.team_id,
        cpve.completion_percentage,
        cpve.created_at,
        'direct'::text as view_source,
        NULL::uuid as guardian_id
      FROM player_profiles pp
      INNER JOIN coaching_point_view_events cpve ON pp.user_id = cpve.user_id
      INNER JOIN coaching_points cp ON cpve.point_id = cp.id
      INNER JOIN games g ON cp.game_id = g.id
      WHERE pp.user_id IS NOT NULL
        ${whereConditions.length > 0 ? `AND ${whereConditions.join(' AND ')}` : ''}
    ),
    guardian_views AS (
      -- Get views from guardians for players without user accounts
      SELECT 
        pp.id as player_profile_id,
        pp.name as player_name,
        cp.id as point_id,
        cp.title as point_title,
        g.id as game_id,
        g.team_id,
        cpve.completion_percentage,
        cpve.created_at,
        'guardian'::text as view_source,
        gpr.guardian_id
      FROM player_profiles pp
      INNER JOIN guardian_player_relationships gpr ON pp.id = gpr.player_profile_id
      INNER JOIN coaching_point_view_events cpve ON gpr.guardian_id = cpve.user_id
      INNER JOIN coaching_points cp ON cpve.point_id = cp.id
      INNER JOIN games g ON cp.game_id = g.id
      WHERE pp.user_id IS NULL
        ${whereConditions.length > 0 ? `AND ${whereConditions.join(' AND ')}` : ''}
    )
    -- Combine both sources
    SELECT 
      player_profile_id,
      player_name,
      point_id,
      point_title,
      game_id,
      team_id,
      completion_percentage,
      created_at,
      view_source,
      guardian_id
    FROM direct_player_views
    UNION ALL
    SELECT 
      player_profile_id,
      player_name,
      point_id,
      point_title,
      game_id,
      team_id,
      completion_percentage,
      created_at,
      view_source,
      guardian_id
    FROM guardian_views
    ORDER BY player_profile_id, point_id, created_at;
  `;

  try
  {
    // Since we need complex filtering, we'll break this into parts using standard Supabase queries

    // Step 1: Build base query conditions for coaching_point_view_events
    let viewQuery = supabase
      .from('coaching_point_view_events')
      .select(`
        point_id,
        user_id,
        completion_percentage,
        created_at,
        coaching_points!inner(
          id,
          title,
          games!inner(
            id,
            team_id
          )
        )
      `);

    // Apply filters
    if (options.coachingPointId)
    {
      viewQuery = viewQuery.eq('point_id', options.coachingPointId);
    }
    if (options.startDate)
    {
      viewQuery = viewQuery.gte('created_at', options.startDate);
    }
    if (options.endDate)
    {
      viewQuery = viewQuery.lte('created_at', options.endDate);
    }
    if (options.teamId)
    {
      viewQuery = viewQuery.eq('coaching_points.games.team_id', options.teamId);
    }
    if (options.gameId)
    {
      viewQuery = viewQuery.eq('coaching_points.games.id', options.gameId);
    }
    if (options.coachId)
    {
      viewQuery = viewQuery.eq('coaching_points.author_id', options.coachId);
    }

    const { data: viewEvents, error: viewError } = await viewQuery;

    if (viewError)
    {
      console.error('Error fetching view events:', viewError);
      throw viewError;
    }

    if (!viewEvents || viewEvents.length === 0)
    {
      return [];
    }

    // Step 2: Get player profiles to determine which views are direct vs guardian
    // Filter players to only those on relevant teams based on the query options
    let relevantTeamIds: string[] = [];

    // Determine which teams are relevant based on the filters
    if (options.teamId)
    {
      relevantTeamIds = [options.teamId];
    }
    else if (options.gameId)
    {
      // Get team from the game
      const gameTeam = (viewEvents || []).find(event =>
      {
        const game = event.coaching_points?.games;
        return game?.id === options.gameId;
      });
      if (gameTeam?.coaching_points?.games?.team_id)
      {
        relevantTeamIds = [gameTeam.coaching_points.games.team_id];
      }
    }
    else if (options.coachId)
    {
      // Get teams where the coach has coach/admin role
      const { data: coachTeams, error: coachTeamsError } = await supabase
        .from('team_memberships')
        .select('team_id')
        .eq('user_id', options.coachId)
        .in('role', ['coach', 'admin']);

      if (coachTeamsError)
      {
        console.error('Error fetching coach teams:', coachTeamsError);
        throw coachTeamsError;
      }

      relevantTeamIds = (coachTeams || []).map(t => t.team_id);
    }
    else
    {
      // Extract unique team IDs from view events if no specific team filter
      const teamIdSet = new Set<string>();
      (viewEvents || []).forEach(event =>
      {
        const teamId = event.coaching_points?.games?.team_id;
        if (teamId) teamIdSet.add(teamId);
      });
      relevantTeamIds = Array.from(teamIdSet);
    }

    let playerQuery = supabase
      .from('player_profiles')
      .select(`
        id, 
        name, 
        user_id,
        team_players!inner(team_id)
      `);

    // Filter by specific player if provided
    if (options.playerId)
    {
      playerQuery = playerQuery.eq('id', options.playerId);
    }

    // Filter players to only those on relevant teams
    if (relevantTeamIds.length > 0)
    {
      playerQuery = playerQuery.in('team_players.team_id', relevantTeamIds);
    }

    const { data: playerProfiles, error: playerError } = await playerQuery;

    if (playerError)
    {
      console.error('Error fetching player profiles:', playerError);
      throw playerError;
    }

    // Step 3: Get guardian relationships for players without user accounts
    // Only get players that are already filtered by team membership
    const playersWithoutUser = (playerProfiles || []).filter(p => !p.user_id);
    let guardianMap = new Map<string, string[]>();

    if (playersWithoutUser.length > 0)
    {
      const { data: guardianRels, error: guardianError } = await supabase
        .from('guardian_player_relationships')
        .select('guardian_id, player_profile_id')
        .in('player_profile_id', playersWithoutUser.map(p => p.id));

      if (guardianError)
      {
        console.error('Error fetching guardian relationships:', guardianError);
        throw guardianError;
      }

      (guardianRels || []).forEach(rel =>
      {
        const existing = guardianMap.get(rel.player_profile_id) || [];
        existing.push(rel.guardian_id);
        guardianMap.set(rel.player_profile_id, existing);
      });
    }

    // Step 4: Process and categorize view events
    const result: Array<{
      player_profile_id: string;
      player_name: string;
      point_id: string;
      point_title: string;
      game_id: string;
      team_id: string;
      completion_percentage: number | null;
      created_at: string;
      view_source: 'direct' | 'guardian';
      guardian_id?: string;
    }> = [];

    (viewEvents || []).forEach(event =>
    {
      const point = event.coaching_points;
      const game = point.games;

      // Check if this is a direct player view
      const directPlayer = (playerProfiles || []).find(p => p.user_id === event.user_id);
      if (directPlayer)
      {
        result.push({
          player_profile_id: directPlayer.id,
          player_name: directPlayer.name,
          point_id: event.point_id,
          point_title: point.title,
          game_id: game.id,
          team_id: game.team_id,
          completion_percentage: event.completion_percentage,
          created_at: event.created_at,
          view_source: 'direct',
        });
        return;
      }

      // Check if this is a guardian view
      for (const [playerId, guardianIds] of guardianMap.entries())
      {
        if (guardianIds.includes(event.user_id))
        {
          const player = playersWithoutUser.find(p => p.id === playerId);
          if (player)
          {
            result.push({
              player_profile_id: player.id,
              player_name: player.name,
              point_id: event.point_id,
              point_title: point.title,
              game_id: game.id,
              team_id: game.team_id,
              completion_percentage: event.completion_percentage,
              created_at: event.created_at,
              view_source: 'guardian',
              guardian_id: event.user_id,
            });
          }
          break;
        }
      }
    });

    // Sort by players with the most views (group by player and count views)
    const playerViewCounts = new Map<string, number>();
    result.forEach(view =>
    {
      const currentCount = playerViewCounts.get(view.player_profile_id) || 0;
      playerViewCounts.set(view.player_profile_id, currentCount + 1);
    });

    // Sort result by player view count (descending), then by player name, then by created_at
    return result.sort((a, b) =>
    {
      const aViewCount = playerViewCounts.get(a.player_profile_id) || 0;
      const bViewCount = playerViewCounts.get(b.player_profile_id) || 0;

      // First, sort by view count (descending)
      if (aViewCount !== bViewCount)
      {
        return bViewCount - aViewCount;
      }

      // Then by player name (ascending)
      if (a.player_name !== b.player_name)
      {
        return a.player_name.localeCompare(b.player_name);
      }

      // Finally by created_at (descending - most recent first)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }
  catch (error)
  {
    console.error('Error in getViewsWithGuardianSupport:', error);
    throw error;
  }
}

/**
 * Get guardian user IDs for players who don't have user accounts
 */
async function getGuardianViewsForPlayers(
  playerProfiles: Array<{ id: string; user_id: string | null; }>,
): Promise<Map<string, string[]>>
{
  const playersWithoutUser = playerProfiles.filter(p => !p.user_id);
  if (playersWithoutUser.length === 0) return new Map();

  const { data: guardianRelationships, error } = await supabase
    .from('guardian_player_relationships')
    .select('guardian_id, player_profile_id')
    .in('player_profile_id', playersWithoutUser.map(p => p.id));

  if (error)
  {
    console.error('Error fetching guardian relationships:', error);
    return new Map();
  }

  const guardianMap = new Map<string, string[]>();
  (guardianRelationships || []).forEach(rel =>
  {
    const existing = guardianMap.get(rel.player_profile_id) || [];
    existing.push(rel.guardian_id);
    guardianMap.set(rel.player_profile_id, existing);
  });

  return guardianMap;
}

/**
 * Get all view events including guardian views for players without user accounts
 */
async function getViewEventsWithGuardianViews(
  pointIds: string[],
  playerProfiles: Array<{ id: string; user_id: string | null; }>,
  dateFilter?: { startISO: string; endISO: string; },
): Promise<
  Array<
    { point_id: string; user_id: string; completion_percentage: number | null; created_at: string; player_id?: string; }
  >
>
{
  if (pointIds.length === 0) return [];

  // Get guardian mappings
  const guardianMap = await getGuardianViewsForPlayers(playerProfiles);

  // Build query for direct user views (players with user_id)
  const playersWithUser = playerProfiles.filter(p => p.user_id);
  const directUserIds = playersWithUser.map(p => p.user_id!);

  // Build query for guardian views (guardians of players without user_id)
  const guardianUserIds = Array.from(
    new Set(
      Array.from(guardianMap.values()).flat(),
    ),
  );

  // Get all relevant user IDs
  const allUserIds = [...directUserIds, ...guardianUserIds];
  if (allUserIds.length === 0) return [];

  // Fetch view events
  let query = supabase
    .from('coaching_point_view_events')
    .select('point_id, user_id, completion_percentage, created_at')
    .in('point_id', pointIds)
    .in('user_id', allUserIds);

  if (dateFilter)
  {
    query = query.gte('created_at', dateFilter.startISO).lte('created_at', dateFilter.endISO);
  }

  const { data: viewEvents, error } = await query;

  if (error)
  {
    console.error('Error fetching view events:', error);
    return [];
  }

  // Map guardian views to their respective players
  const result: Array<
    { point_id: string; user_id: string; completion_percentage: number | null; created_at: string; player_id?: string; }
  > = [];

  (viewEvents || []).forEach(event =>
  {
    // Check if this is a direct player view
    const directPlayer = playersWithUser.find(p => p.user_id === event.user_id);
    if (directPlayer)
    {
      result.push({ ...event, player_id: directPlayer.id });
      return;
    }

    // Check if this is a guardian view
    for (const [playerId, guardianIds] of guardianMap.entries())
    {
      if (guardianIds.includes(event.user_id))
      {
        result.push({ ...event, player_id: playerId });
        break; // A guardian can only be mapped to one player per event
      }
    }
  });

  return result;
}

/**
 * Build per (point,player) max completion map from view events, including guardian views.
 * This tracks the highest completion percentage achieved for each player for each coaching point,
 * using either their own views (if they have a user account) or their guardians' views.
 */
function buildPerPlayerPointMaxMap(
  viewEvents: Array<{ point_id: string; user_id: string; completion_percentage: number | null; player_id?: string; }>,
  playerProfiles: Array<{ id: string; user_id: string | null; }>,
): Map<string, number>
{
  const perPlayerPointMax = new Map<string, number>();

  (viewEvents || []).forEach(ev =>
  {
    // For events that include player_id (from guardian views), use that
    // For direct player views, find the player by user_id
    let playerId = ev.player_id;
    if (!playerId)
    {
      const player = playerProfiles.find(p => p.user_id === ev.user_id);
      playerId = player?.id;
    }

    if (!playerId) return;

    const key = `${ev.point_id}__${playerId}`;
    const val = typeof ev.completion_percentage === 'number' ? ev.completion_percentage : 0;
    const prev = perPlayerPointMax.get(key);
    if (prev === undefined || val > prev)
    {
      perPlayerPointMax.set(key, val);
    }
  });
  return perPlayerPointMax;
}

/**
 * Build per (point,user) max completion map from view events.
 * This tracks the highest completion percentage achieved by each user for each coaching point.
 * @deprecated Use buildPerPlayerPointMaxMap for analytics that should include guardian views
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
 * Calculate engagement over time from guardian-supported view data.
 * @param viewData - Array of view data from getViewsWithGuardianSupport
 * @param granularity - 'daily' or 'hourly'
 * @returns Array of {date, views} or {date, hour, views} objects
 */
function calculateEngagementOverTimeFromGuardianViews(
  viewData: Array<{ created_at: string; }>,
  granularity: 'daily' | 'hourly' = 'daily',
): Array<{ date: string; views: number; hour?: number; }>
{
  return calculateEngagementOverTime(viewData, granularity);
}

/**
 * Calculate views by entity from guardian-supported view data.
 * @param viewData - Array of view data from getViewsWithGuardianSupport
 * @param entityKey - The key to group by ('point_id', 'game_id', etc.)
 * @returns Map of entity ID to view count
 */
function calculateViewsByEntityFromGuardianViews<T extends Record<string, any>>(
  viewData: Array<T>,
  entityKey: keyof T,
): Map<string, number>
{
  const viewsByEntity = new Map<string, number>();
  (viewData || []).forEach(ev =>
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
 * Calculate average completion percentage from guardian-supported view data.
 * This ensures that players who haven't viewed a coaching point contribute 0% to the average.
 * @param viewData - Array of view data from getViewsWithGuardianSupport
 * @param pointIds - All point IDs to include in calculation
 * @param playerIds - All player IDs to include in calculation
 * @returns Average completion percentage
 */
function calculateAvgCompletionFromGuardianViews(
  viewData: Array<{ point_id: string; player_profile_id: string; completion_percentage: number | null; }>,
  pointIds: string[],
  playerIds: string[],
): number
{
  // Build per-player-point max completion map
  const perPlayerPointMax = new Map<string, number>();
  (viewData || []).forEach(ev =>
  {
    const key = `${ev.point_id}__${ev.player_profile_id}`;
    const val = typeof ev.completion_percentage === 'number' ? ev.completion_percentage : 0;
    const prev = perPlayerPointMax.get(key);
    if (prev === undefined || val > prev)
    {
      perPlayerPointMax.set(key, val);
    }
  });

  // Create complete matrix: for each point × player combination, get max completion or 0
  const allPlayerPointMaxValues: number[] = [];
  pointIds.forEach(pointId =>
  {
    playerIds.forEach(playerId =>
    {
      const key = `${pointId}__${playerId}`;
      const maxCompletion = perPlayerPointMax.get(key) || 0; // Default to 0 if no views
      allPlayerPointMaxValues.push(maxCompletion);
    });
  });

  return allPlayerPointMaxValues.length > 0 ?
    Math.round(allPlayerPointMaxValues.reduce((s, v) => s + v, 0) / allPlayerPointMaxValues.length * 10) / 10 :
    0;
}

/**
 * Calculate per-point aggregates from guardian-supported view data.
 * @param viewData - Array of view data from getViewsWithGuardianSupport
 * @returns Map of point ID to average completion percentage
 */
function calculatePerPointAggregatesFromGuardianViews(
  viewData: Array<{ point_id: string; player_profile_id: string; completion_percentage: number | null; }>,
): Map<string, number>
{
  // Build per-player-point max completion map
  const perPlayerPointMax = new Map<string, number>();
  (viewData || []).forEach(ev =>
  {
    const key = `${ev.point_id}__${ev.player_profile_id}`;
    const val = typeof ev.completion_percentage === 'number' ? ev.completion_percentage : 0;
    const prev = perPlayerPointMax.get(key);
    if (prev === undefined || val > prev)
    {
      perPlayerPointMax.set(key, val);
    }
  });

  // Aggregate by point
  const perPointAgg: Record<string, { sum: number; count: number; }> = {};
  perPlayerPointMax.forEach((v, key) =>
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
 * Updated to support guardian views for players without user accounts.
 */
async function calculatePlayerEngagementScores(
  players: Array<{ id: string; name: string; user_id: string | null; }>,
  pointIds: string[],
  tagsByPlayer: Map<string, string[]>,
  ackCountByPlayer: Map<string, number>,
  playerViewEvents: Array<
    { point_id: string; user_id: string; completion_percentage: number | null; player_id?: string; }
  >,
): Promise<
  Array<{
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
>
{
  // Build per-player-point max completion map from view events that include guardian views
  const perPlayerPointMax = buildPerPlayerPointMaxMap(playerViewEvents, players);

  return players.map(player =>
  {
    const taggedPoints = tagsByPlayer.get(player.id) || [];
    const totalTagged = taggedPoints.length;
    const totalPoints = pointIds.length;
    const ackedCount = ackCountByPlayer.get(player.id) || 0;

    // === OVERALL ENGAGEMENT (ALL POINTS) ===
    const ackRate = totalPoints > 0 ? (ackedCount / totalPoints) : 0;

    // Completion across ALL points using player-based max completion
    let allPointsCompSum = 0;
    pointIds.forEach(pointId =>
    {
      const key = `${pointId}__${player.id}`;
      const maxComp = perPlayerPointMax.get(key);
      allPointsCompSum += typeof maxComp === 'number' ? maxComp : 0;
    });
    const completionRate = totalPoints > 0 ? (allPointsCompSum / totalPoints) / 100 : 0;

    // === TAGGED-SPECIFIC ENGAGEMENT ===
    const taggedAckRate = totalTagged > 0 ? (ackedCount / totalTagged) : 0;

    // Completion across TAGGED points only using player-based max completion
    let taggedCompSum = 0;
    taggedPoints.forEach(pointId =>
    {
      const key = `${pointId}__${player.id}`;
      const maxComp = perPlayerPointMax.get(key);
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

    // Get comprehensive view data with guardian support for these teams within the date window
    const allViewData = await getViewsWithGuardianSupport({
      startDate: startISO,
      endDate: endISO,
    });

    // Filter view data to only include teams the user has access to
    const filteredViewData = allViewData.filter(view => teamIds.includes(view.team_id));

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

    // Aggregate: total views (from guardian-supported data)
    const totalViews = filteredViewData.length;

    // Aggregate: per (point,player) max completion using guardian views
    const allPlayerProfiles = Array.from(playerProfileById.values());
    const allPlayerIds = allPlayerProfiles.map(p => p.id);
    const avgCompletionPercent = calculateAvgCompletionFromGuardianViews(filteredViewData, pointIds, allPlayerIds);

    // Engagement over time using guardian-supported view data
    const engagementOverTime = calculateEngagementOverTimeFromGuardianViews(filteredViewData, 'daily');
    const engagementHourlyOverTime = calculateEngagementOverTimeFromGuardianViews(filteredViewData, 'hourly');

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

    // Top/Bottom points by views with avg completion using guardian-supported data
    const viewsByPoint = calculateViewsByEntityFromGuardianViews(filteredViewData, 'point_id');
    const avgCompletionByPoint = calculatePerPointAggregatesFromGuardianViews(filteredViewData);

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

    // Tagged points of ALL players within our points set
    const playerIds = allPlayerProfiles.map(p => p.id);
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

    // Get view events with guardian views for player engagement calculations
    const playerViewEvents = await getViewEventsWithGuardianViews(
      pointIds,
      allPlayerProfiles,
      { startISO, endISO },
    );

    // Calculate comprehensive player engagement scores using utility function for ALL players
    const playersForScoring = allPlayerProfiles.map(p => ({
      id: p.id,
      name: p.name,
      user_id: p.user_id,
    }));

    const playerScores = await calculatePlayerEngagementScores(
      playersForScoring,
      pointIds,
      tagsByPlayer,
      ackCountByPlayer,
      playerViewEvents,
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

    // Coaching points for this team (all time - no date filter)
    const { data: points, error: pointsError } = await supabase
      .from('coaching_points')
      .select('id, game_id, title, created_at')
      .in('game_id', gameIds.length ? gameIds : ['00000000-0000-0000-0000-000000000000']);

    if (pointsError)
    {
      res.status(400).json({ error: pointsError.message });
      return;
    }

    const pointIds = (points || []).map(p => p.id);
    const pointById = new Map<string, any>();
    (points || []).forEach(p => pointById.set(p.id, p));

    // Get comprehensive view data with guardian support for this team (all time)
    const allTeamViewData = await getViewsWithGuardianSupport({
      teamId: teamId,
    });

    // Get view events using the guardian-aware helper for role breakdowns and backward compatibility
    const teamPlayerViewEvents = await getViewEventsWithGuardianViews(
      pointIds,
      Array.from(playerProfileById.values()),
    );

    // Acknowledgments for all coaching points (no date filter)
    const { data: acks, error: acksError } = pointIds.length === 0 ?
      { data: [], error: null } :
      await supabase
        .from('coaching_point_acknowledgments')
        .select('id, point_id, player_id, ack_at, acknowledged')
        .in('point_id', pointIds)
        .eq('acknowledged', true);

    if (acksError)
    {
      res.status(400).json({ error: acksError.message });
      return;
    }

    // Totals
    const totalPoints = (points || []).length;
    const totalViews = allTeamViewData.length;

    // Avg completion percentage using guardian-supported data
    const allPlayerIds = Array.from(playerProfileById.values()).map(p => p.id);
    const avgCompletionPercent = calculateAvgCompletionFromGuardianViews(allTeamViewData, pointIds, allPlayerIds);

    // Build per (point,user) max completion map for backward compatibility with role breakdowns
    const perUserPointMax = buildPerUserPointMaxMap(teamPlayerViewEvents);

    // % Acknowledged: acknowledged_count / (total_points * total_players)
    const totalPossibleAcks = totalPoints * totalPlayers;
    const acknowledgedCount = (acks || []).length;
    const percentAcknowledged = totalPossibleAcks > 0 ?
      Math.round((acknowledgedCount / totalPossibleAcks) * 100) :
      0;

    // Get heatmap view data filtered by date range using guardian support
    const heatmapViewData = await getViewsWithGuardianSupport({
      teamId: teamId,
      startDate: startISO,
      endDate: endISO,
    });

    // Engagement heatmap (UTC day-of-week/hour) - uses date-filtered data
    const heatmapMap = new Map<string, number>(); // "dow-hour" -> views
    (heatmapViewData || []).forEach(ev =>
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

    // Per-role breakdown using guardian-supported view data
    const roles = ['coach', 'admin', 'player', 'guardian'];
    const roleViewsCount = new Map<string, number>();

    // Get all view events (not date filtered) to calculate role breakdowns
    const allRoleViewEvents = await getViewEventsWithGuardianViews(
      pointIds,
      Array.from(playerProfileById.values()),
    );

    allRoleViewEvents.forEach(ev =>
    {
      const role = ev.user_id ? userRoleMap.get(ev.user_id) : undefined;
      if (role) roleViewsCount.set(role, (roleViewsCount.get(role) || 0) + 1);
    });

    // Calculate role-based completion averages using per-player-point max
    const perPlayerPointMaxForRoles = buildPerPlayerPointMaxMap(
      allRoleViewEvents,
      Array.from(playerProfileById.values()),
    );
    const roleAgg: Record<string, { sum: number; count: number; }> = {};

    perPlayerPointMaxForRoles.forEach((v, key) =>
    {
      const [, playerId] = key.split('__');
      const player = Array.from(playerProfileById.values()).find(p => p.id === playerId);
      if (!player?.user_id) return;

      const role = userRoleMap.get(player.user_id);
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

    // Views by game using guardian-supported data
    const viewsByGame = new Map<string, number>();
    (allTeamViewData || []).forEach(ev =>
    {
      viewsByGame.set(ev.game_id, (viewsByGame.get(ev.game_id) || 0) + 1);
    });

    const gameSummaries = (games || []).map(g =>
    {
      const count = viewsByGame.get(g.id) || 0;
      return { id: g.id, opponent: g.opponent, date: g.date, views: count };
    });

    const gamesMostViewed = [...gameSummaries].sort((a, b) => b.views - a.views).slice(0, 5);
    const gamesLeastViewed = [...gameSummaries].sort((a, b) => a.views - b.views).slice(0, 5);

    // Top players by engagement (all players including those without user accounts)
    const allPlayers = Array.from(playerProfileById.values());

    // Get view events with guardian views for player engagement calculations
    const playerEngagementViewEvents = await getViewEventsWithGuardianViews(
      pointIds,
      allPlayers,
      // Note: No date filter here since we want all-time data for team analytics
    );

    // Tags (points in scope for players on this team)
    const playerIds = allPlayers.map(p => p.id);
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
    const playerScores = await calculatePlayerEngagementScores(
      allPlayers,
      pointIds,
      tagsByPlayer,
      ackCountByPlayer,
      playerEngagementViewEvents,
    );

    const filteredPlayerScores = playerScores.filter(ps => (tagsByPlayer.get(ps.player_profile_id)?.length || 0) > 0);
    const topPlayers = filteredPlayerScores
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

    // Get comprehensive view data with guardian support for this game in the date range
    const gameViewData = await getViewsWithGuardianSupport({
      gameId: gameId,
      startDate: startISO,
      endDate: endISO,
    });

    // Total views from guardian-supported data
    const totalViews = gameViewData.length;

    // Unique viewers calculation from guardian-supported data
    // (count unique player profiles that have views, not unique user IDs)
    const uniquePlayerViewers = new Set<string>();
    gameViewData.forEach(view =>
    {
      uniquePlayerViewers.add(view.player_profile_id);
    });
    const uniqueViewers = uniquePlayerViewers.size;

    // Keep legacy view summary query for backward compatibility with last_viewed_at calculations
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

    // Get tagged players for this game to support guardian views
    const { data: gameTeamPlayers, error: gameTeamPlayersError } = await supabase
      .from('team_players')
      .select(`
        player_profiles (
          id,
          name,
          user_id
        )
      `)
      .eq('team_id', game.team_id);

    if (gameTeamPlayersError)
    {
      res.status(400).json({ error: gameTeamPlayersError.message });
      return;
    }

    const gamePlayerProfiles = (gameTeamPlayers || [])
      .map(tp => tp.player_profiles)
      .filter(p => !!p)
      .map(p => ({ id: p.id, name: p.name, user_id: p.user_id }));

    // Calculate average completion percentage using guardian-supported data
    const gamePlayerIds = gamePlayerProfiles.map(p => p.id);
    const avgCompletionPercent = calculateAvgCompletionFromGuardianViews(gameViewData, pointIds, gamePlayerIds);

    // Legacy view events query for backward compatibility (timeline generation)
    const { data: legacyViewEvents, error: veErr } = pointIds.length === 0 ?
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

    // Keep the old per-user max for backward compatibility where needed
    const perUserPointMax = buildPerUserPointMaxMap(legacyViewEvents);

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

    // Calculate views by point using guardian-supported data
    const viewsByPoint = calculateViewsByEntityFromGuardianViews(gameViewData, 'point_id');

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

    // View timeline relative to game date (days since game date) using guardian-supported data
    const gameDate = game.date ? new Date(game.date) : null;
    const viewTimeline = gameViewData.map(ev =>
    {
      const created = new Date(ev.created_at);
      let daysSinceGame = null as number | null;
      if (gameDate) daysSinceGame = Math.floor((created.getTime() - gameDate.getTime()) / (1000 * 60 * 60 * 24));
      return {
        pointId: ev.point_id,
        created_at: created,
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

      // Get comprehensive view data for this specific player using guardian support
      const myPlayerViewData = await getViewsWithGuardianSupport({
        playerId: playerProfileId,
      });

      // Filter to only tagged points for this specific analysis
      const myTaggedViewData = myPlayerViewData.filter(view => taggedPointSet.has(view.point_id));

      // Convert guardian-supported view data to legacy format for compatibility
      const myViewEvents = myTaggedViewData.map(view => ({
        point_id: view.point_id,
        user_id: view.guardian_id || 'placeholder', // placeholder for guardian views
        completion_percentage: view.completion_percentage,
        created_at: view.created_at,
        player_id: view.player_profile_id,
      }));

      let myViewSummaries: any[] = [];

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
      }
      else
      {
        // For players without user accounts, we need to get guardian view summaries
        const guardianMap = await getGuardianViewsForPlayers([{
          id: playerProfile.id,
          user_id: playerProfile.user_id,
        }]);

        const guardianIds = guardianMap.get(playerProfile.id) || [];
        if (guardianIds.length > 0)
        {
          const { data: guardianViewSummaries, error: gvsErr } = await supabase
            .from('coaching_point_view_summary')
            .select('point_id, first_viewed_at, last_viewed_at, user_id')
            .in('point_id', Array.from(taggedPointSet))
            .in('user_id', guardianIds);

          if (gvsErr)
          {
            res.status(400).json({ error: gvsErr.message });
            return;
          }

          // Group by point_id and take the earliest first_viewed_at and latest last_viewed_at
          const summaryMap = new Map<string, { first_viewed_at: string | null; last_viewed_at: string | null; }>();
          (guardianViewSummaries || []).forEach(summary =>
          {
            const existing = summaryMap.get(summary.point_id);
            const firstViewed = summary.first_viewed_at;
            const lastViewed = summary.last_viewed_at;

            if (!existing)
            {
              summaryMap.set(summary.point_id, {
                first_viewed_at: firstViewed,
                last_viewed_at: lastViewed,
              });
            }
            else
            {
              // Take earliest first_viewed_at
              if (firstViewed && (!existing.first_viewed_at || firstViewed < existing.first_viewed_at))
              {
                existing.first_viewed_at = firstViewed;
              }
              // Take latest last_viewed_at
              if (lastViewed && (!existing.last_viewed_at || lastViewed > existing.last_viewed_at))
              {
                existing.last_viewed_at = lastViewed;
              }
            }
          });

          myViewSummaries = Array.from(summaryMap.entries()).map(([point_id, data]) => ({
            point_id,
            first_viewed_at: data.first_viewed_at,
            last_viewed_at: data.last_viewed_at,
            user_id: null, // Since this represents aggregated guardian views
          }));
        }
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

      // Engagement over time using guardian-supported view data
      const engagementOverTime = calculateEngagementOverTimeFromGuardianViews(myTaggedViewData, 'daily');

      // Rank tagged points by player's own views using guardian-supported data
      const myViewsByPoint = calculateViewsByEntityFromGuardianViews(myTaggedViewData, 'point_id');

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

    // Get comprehensive view data with guardian support for this specific coaching point
    const pointViewData = await getViewsWithGuardianSupport({
      coachingPointId: pointId,
    });

    // Legacy view events query for backward compatibility with completion distribution
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

    // Totals using guardian-supported data where appropriate
    const totalViews = pointViewData.length;
    const uniqueViewers = new Set(pointViewData.map(view => view.player_profile_id)).size;

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

      const teamId = accessCheck.games.teams.id;

      // Get ALL players from the team (not just tagged ones)
      const { data: allTeamPlayersData, error: playersError } = await supabase
        .from('team_players')
        .select(`
        player_profiles!inner(
          id,
          name
        )
      `)
        .eq('team_id', teamId);

      if (playersError)
      {
        res.status(500).json({ error: 'Failed to fetch team players' });
        return;
      }

      // Get tagged player IDs for this coaching point
      const { data: taggedPlayersData, error: taggedError } = await supabase
        .from('coaching_point_tagged_players')
        .select('player_id')
        .eq('point_id', pointId);

      if (taggedError)
      {
        res.status(500).json({ error: 'Failed to fetch tagged players' });
        return;
      }

      const taggedPlayerIds = new Set((taggedPlayersData || []).map(tp => tp.player_id));

      // Get comprehensive view data with guardian support for this coaching point
      const pointViewData = await getViewsWithGuardianSupport({
        coachingPointId: pointId,
      });

      // Get view/acknowledgment status for ALL team players
      const players = await Promise.all((allTeamPlayersData || []).map(async (tp) =>
      {
        const playerId = tp.player_profiles.id;

        // Get view count and completion for this player from guardian-supported data
        const playerViewData = pointViewData.filter(view => view.player_profile_id === playerId);
        const viewCount = playerViewData.length;

        // Calculate max completion percentage for this player
        const maxCompletion = playerViewData.length > 0 ?
          Math.max(...playerViewData.map(view => view.completion_percentage || 0)) :
          0;

        // Get first/last viewed times (if player has direct views)
        let firstViewedAt: string | null = null;
        let lastViewedAt: string | null = null;

        // Try to get view summary for direct views
        const { data: viewSummary } = await supabase
          .from('coaching_point_view_summary')
          .select('first_viewed_at, last_viewed_at')
          .eq('point_id', pointId)
          .eq('user_id', playerId)
          .single();

        if (viewSummary)
        {
          firstViewedAt = viewSummary.first_viewed_at;
          lastViewedAt = viewSummary.last_viewed_at;
        }
        else if (playerViewData.length > 0)
        {
          // For guardian views, calculate from the view data
          const sortedViews = [...playerViewData].sort((a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
          firstViewedAt = sortedViews[0].created_at;
          lastViewedAt = sortedViews[sortedViews.length - 1].created_at;
        }

        // Get acknowledgment status
        const { data: ackData } = await supabase
          .from('coaching_point_acknowledgments')
          .select('acknowledged, ack_at, notes')
          .eq('point_id', pointId)
          .eq('player_id', playerId)
          .single();

        return {
          player_id: playerId,
          name: tp.player_profiles.name,
          views: viewCount,
          completion_percent: maxCompletion,
          first_viewed_at: firstViewedAt,
          last_viewed_at: lastViewedAt,
          acknowledged: ackData?.acknowledged || false,
          ack_at: ackData?.ack_at || null,
          ack_notes: ackData?.notes || null,
          tagged: taggedPlayerIds.has(playerId),
        };
      }));

      // Sort players by: Completion %, Acknowledged, Has Notes, Views, Tagged
      // Priority order (descending): completion_percent, acknowledged, has notes, views, tagged
      players.sort((a, b) =>
      {
        // 1. Sort by completion percentage (highest first)
        if (b.completion_percent !== a.completion_percent)
        {
          return b.completion_percent - a.completion_percent;
        }

        // 2. Sort by acknowledged status (acknowledged first)
        if (b.acknowledged !== a.acknowledged)
        {
          return (b.acknowledged ? 1 : 0) - (a.acknowledged ? 1 : 0);
        }

        // 3. Sort by whether they have notes (has notes first)
        const aHasNotes = a.ack_notes !== null && a.ack_notes.trim().length > 0;
        const bHasNotes = b.ack_notes !== null && b.ack_notes.trim().length > 0;
        if (bHasNotes !== aHasNotes)
        {
          return (bHasNotes ? 1 : 0) - (aHasNotes ? 1 : 0);
        }

        // 4. Sort by view count (highest first)
        if (b.views !== a.views)
        {
          return b.views - a.views;
        }

        // 5. Sort by tagged status (tagged first)
        if (b.tagged !== a.tagged)
        {
          return (b.tagged ? 1 : 0) - (a.tagged ? 1 : 0);
        }

        // 6. Finally, sort alphabetically by name as tiebreaker
        return a.name.localeCompare(b.name);
      });

      // Calculate totals from guardian-supported data
      const totalViews = pointViewData.length;
      const uniqueViewers = new Set(pointViewData.map(view => view.player_profile_id)).size;

      // Get acknowledgment notes (avoid FK join which can fail due to RLS; map names from players instead)
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
        players,
        totalViews,
        uniqueViewers,
        acknowledgmentNotes: (ackNotes || []).map(note => ({
          player_name: players.find(p => p.player_id === (note as any).player_id)?.name || 'Unknown',
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
