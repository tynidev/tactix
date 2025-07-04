import { TeamRole } from '../types/database.js';
import { supabase } from './supabase.js';

export interface UserTeamRole
{
  teamId: string;
  role: TeamRole;
}

/**
 * Get user's role in a specific team
 */
export async function getUserTeamRole(userId: string, teamId: string): Promise<TeamRole | null>
{
  const { data: membership, error } = await supabase
    .from('team_memberships')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', userId)
    .single();

  if (error || !membership)
  {
    return null;
  }

  return membership.role as TeamRole;
}

/**
 * Get all teams and roles for a user
 */
export async function getUserTeamRoles(userId: string): Promise<UserTeamRole[]>
{
  const { data: memberships, error } = await supabase
    .from('team_memberships')
    .select('team_id, role')
    .eq('user_id', userId);

  if (error || !memberships)
  {
    return [];
  }

  return memberships.map(m => ({
    teamId: m.team_id,
    role: m.role as TeamRole,
  }));
}

/**
 * Check if user has required role in team
 */
export async function checkUserTeamRole(
  userId: string,
  teamId: string,
  requiredRoles: TeamRole[],
): Promise<boolean>
{
  const role = await getUserTeamRole(userId, teamId);
  return role !== null && requiredRoles.includes(role);
}

/**
 * Middleware to check team role authorization
 */
export function requireTeamRole(requiredRoles: TeamRole[])
{
  return async (req: any, res: any, next: any) =>
  {
    const userId = req.user?.id;
    const teamId = req.params.teamId;

    if (!userId || !teamId)
    {
      return res.status(400).json({ error: 'Missing user or team information' });
    }

    const hasPermission = await checkUserTeamRole(userId, teamId, requiredRoles);

    if (!hasPermission)
    {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
}
