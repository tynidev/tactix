import React from 'react';
import { FaPencilAlt, FaTrash } from 'react-icons/fa';
import { Link } from 'react-router-dom';
import './TeamsGrid.css';

interface Team
{
  role: string;
  teams: {
    id: string;
    name: string;
    created_at: string;
    player_count?: number;
    game_count?: number;
    reviewed_games_count?: number;
    coaches?: Array<{ name: string; }>;
  };
}

interface TeamsGridProps
{
  teams: Team[];
  variant?: 'full' | 'compact';
  onTeamClick?: (teamId: string) => void;
  onEditTeam?: (teamId: string, currentName: string) => void;
  onDeleteTeam?: (teamId: string) => void;
  showMetadata?: boolean;
  showFloatingActions?: boolean;
  customActions?: (team: Team) => React.ReactNode;
}

export const TeamsGrid: React.FC<TeamsGridProps> = ({
  teams,
  variant = 'full',
  onTeamClick,
  onEditTeam,
  onDeleteTeam,
  showMetadata = variant === 'full',
  showFloatingActions = variant === 'full',
  customActions,
}) =>
{
  const handleCardClick = (teamId: string) =>
  {
    if (onTeamClick)
    {
      onTeamClick(teamId);
    }
  };

  const renderTeamActions = (teamMembership: Team) =>
  {
    if (customActions)
    {
      return customActions(teamMembership);
    }

    // Default actions for full variant
    return (
      <div className='team-actions'>
        <Link
          to={`/games/${teamMembership.teams.id}`}
          className='btn btn-primary'
          onClick={(e) => e.stopPropagation()}
        >
          View Games
        </Link>
      </div>
    );
  };

  return (
    <div className='teams-grid'>
      {teams.map((teamMembership) => (
        <div
          key={teamMembership.teams.id}
          className='team-card'
          style={{
            position: 'relative',
            cursor: onTeamClick ? 'pointer' : 'default',
          }}
          onClick={() => handleCardClick(teamMembership.teams.id)}
        >
          {/* Floating Action Icons - only for full variant */}
          {showFloatingActions && (teamMembership.role === 'coach' || teamMembership.role === 'admin') && (
            <div className='floating-actions team'>
              <button
                className='floating-action-btn edit-btn'
                onClick={(e) =>
                {
                  e.stopPropagation();
                  if (onEditTeam)
                  {
                    onEditTeam(teamMembership.teams.id, teamMembership.teams.name);
                  }
                }}
                title='Edit team'
                aria-label='Edit team'
              >
                <FaPencilAlt />
              </button>
              <button
                className='floating-action-btn delete-btn'
                onClick={(e) =>
                {
                  e.stopPropagation();
                  if (onDeleteTeam)
                  {
                    onDeleteTeam(teamMembership.teams.id);
                  }
                }}
                title='Delete team'
                aria-label='Delete team'
              >
                <FaTrash />
              </button>
            </div>
          )}

          <div className='team-header'>
            {variant === 'compact' ?
              (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h3 className='team-name'>{teamMembership.teams.name}</h3>
                  {(teamMembership.role === 'coach' || teamMembership.role === 'admin') && (
                    <button
                      onClick={(e) =>
                      {
                        e.stopPropagation();
                        if (onEditTeam)
                        {
                          onEditTeam(teamMembership.teams.id, teamMembership.teams.name);
                        }
                      }}
                      className='btn btn-secondary btn-sm'
                      title='Edit team name'
                      style={{ padding: '4px 8px' }}
                    >
                      ✏️
                    </button>
                  )}
                </div>
              ) :
              <h3 className='team-name'>{teamMembership.teams.name}</h3>}
            <p className='team-role'>Role: {teamMembership.role}</p>

            {variant === 'compact' && (
              <p className='team-created'>
                Created: {new Date(teamMembership.teams.created_at).toLocaleDateString()}
              </p>
            )}
          </div>

          {/* Team Metadata - only for full variant */}
          {showMetadata && (
            <div className='team-metadata'>
              {teamMembership.teams.coaches && teamMembership.teams.coaches.length > 0 && (
                <div className='metadata-row'>
                  <span className='metadata-label'>Coaches:</span>
                  <span className='metadata-value'>
                    {teamMembership.teams.coaches.map(coach => coach.name).join(', ')}
                  </span>
                </div>
              )}
              {teamMembership.teams.player_count !== undefined && (
                <div className='metadata-row'>
                  <span className='metadata-label'>Players:</span>
                  <span className='metadata-value'>{teamMembership.teams.player_count}</span>
                </div>
              )}
              {teamMembership.teams.game_count !== undefined && (
                <div className='metadata-row'>
                  <span className='metadata-label'>Games:</span>
                  <span className='metadata-value'>{teamMembership.teams.game_count}</span>
                </div>
              )}
              {teamMembership.teams.reviewed_games_count !== undefined && (
                <div className='metadata-row'>
                  <span className='metadata-label'>Reviewed:</span>
                  <span className='metadata-value'>{teamMembership.teams.reviewed_games_count}</span>
                </div>
              )}
            </div>
          )}

          {renderTeamActions(teamMembership)}
        </div>
      ))}
    </div>
  );
};
