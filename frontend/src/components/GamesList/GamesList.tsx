import React, { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import DatePicker from 'react-datepicker';
import { FaPencilAlt, FaTrash } from 'react-icons/fa';
import { useSearchParams } from 'react-router-dom';
import { getApiUrl, getValidAccessToken } from '../../utils/api';
import { ConfirmationDialog } from '../ConfirmationDialog';
import { JoinTeamModal } from '../JoinTeamModal';
import './GamesList.css';
import 'react-datepicker/dist/react-datepicker.css';

// Date utility functions moved outside component to avoid recreation
const formatGameDate = (dateString: string): string =>
{
  // Parse date as local date to avoid timezone issues
  const [year, month, day] = dateString.split('-').map(Number);
  const localDate = new Date(year, month - 1, day); // month is 0-indexed
  return localDate.toLocaleDateString();
};

const parseGameDate = (dateString: string): Date =>
{
  // Centralized date parsing logic
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day); // month is 0-indexed
};

// Game result utility functions moved outside component
const formatGameResult = (teamScore: number | null, oppScore: number | null): string =>
{
  if (teamScore === null || oppScore === null)
  {
    return 'No score';
  }

  if (teamScore > oppScore)
  {
    return `W ${teamScore}-${oppScore}`;
  }
  else if (teamScore < oppScore)
  {
    return `L ${teamScore}-${oppScore}`;
  }
  else
  {
    return `T ${teamScore}-${oppScore}`;
  }
};

const getResultClass = (teamScore: number | null, oppScore: number | null): string =>
{
  if (teamScore === null || oppScore === null)
  {
    return '';
  }

  if (teamScore > oppScore)
  {
    return 'result-win';
  }
  else if (teamScore < oppScore)
  {
    return 'result-loss';
  }
  else
  {
    return 'result-tie';
  }
};

// YouTube utility functions moved outside component
const getYouTubeThumbnailUrl = (videoId: string): string =>
{
  // Try maxresdefault first (highest quality), fallback to hqdefault if needed
  return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
};

const getYouTubeThumbnailFallback = (videoId: string): string =>
{
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
};

interface Game
{
  id: string;
  opponent: string;
  date: string;
  location: string | null;
  video_id: string | null;
  team_score: number | null;
  opp_score: number | null;
  game_type: 'regular' | 'tournament' | 'scrimmage';
  home_away: 'home' | 'away' | 'neutral';
  notes: string | null;
  created_at: string;
  coaching_points_count?: number;
  teams?: {
    id: string;
    name: string;
  };
  user_role?: string;
}

interface Team
{
  role: string;
  teams: {
    id: string;
    name: string;
    created_at: string;
  };
}

interface GamesListProps
{
  teamId?: string;
  userRole?: string;
  teams: Team[];
  selectedTeam: Team | null;
  onTeamChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  onEditGame: (game: Game) => void;
  onAnalyzeGame: (game: Game) => void;
}

export interface GamesListRef
{
  refresh: () => void;
}

export const GamesList = memo(forwardRef<GamesListRef, GamesListProps>(({
  teamId,
  userRole,
  teams,
  selectedTeam,
  onTeamChange,
  onEditGame,
  onAnalyzeGame,
}, ref) =>
{
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();

  // Filter states
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [homeAwayFilter, setHomeAwayFilter] = useState('');
  const [gameTypeFilter, setGameTypeFilter] = useState('');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [initialJoinCode, setInitialJoinCode] = useState<string>('');

  // Check for team code in URL on mount
  useEffect(() =>
  {
    const teamCode = searchParams.get('teamCode');
    console.log('Team code found in URL:', teamCode);
    if (teamCode)
    {
      setInitialJoinCode(teamCode);
      setShowJoinModal(true);

      // Clean up URL
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('teamCode');
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Delete confirmation state
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    gameId: string | null;
    gameOpponent: string;
    loading: boolean;
  }>({
    isOpen: false,
    gameId: null,
    gameOpponent: '',
    loading: false,
  });

  useEffect(() =>
  {
    fetchGames();
  }, [teamId]);

  // Expose refresh function to parent component
  useImperativeHandle(ref, () => ({
    refresh: fetchGames,
  }));

  const fetchGames = useCallback(async () =>
  {
    try
    {
      setLoading(true);
      const token = await getValidAccessToken();

      if (!token)
      {
        throw new Error('No access token');
      }

      const apiUrl = getApiUrl();
      // Use different endpoint based on whether teamId is provided
      const endpoint = teamId ? `${apiUrl}/api/games/team/${teamId}` : `${apiUrl}/api/games`;
      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok)
      {
        throw new Error('Failed to fetch games');
      }

      const data = await response.json();
      setGames(data);
    }
    catch (err)
    {
      setError('Failed to load games');
      console.error('Error fetching games:', err);
    }
    finally
    {
      setLoading(false);
    }
  }, [teamId]);

  const handleJoinModalClose = () =>
  {
    setShowJoinModal(false);
    setInitialJoinCode('');
  };

  const handleJoinModalSuccess = () =>
  {
    fetchGames(); // Refresh games list after joining
    setShowJoinModal(false);
    setInitialJoinCode('');
  };

  const handleDeleteGame = useCallback((gameId: string) =>
  {
    const game = games.find(g => g.id === gameId);
    const gameOpponent = game?.opponent || 'this game';

    setDeleteConfirmation({
      isOpen: true,
      gameId,
      gameOpponent,
      loading: false,
    });
  }, [games]);

  const handleDeleteConfirmationClose = useCallback(() =>
  {
    setDeleteConfirmation({
      isOpen: false,
      gameId: null,
      gameOpponent: '',
      loading: false,
    });
  }, []);

  const handleDeleteConfirmationConfirm = useCallback(async () =>
  {
    if (!deleteConfirmation.gameId) return;

    setDeleteConfirmation(prev => ({ ...prev, loading: true }));

    try
    {
      const token = await getValidAccessToken();

      if (!token)
      {
        throw new Error('No access token');
      }

      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/games/${deleteConfirmation.gameId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok)
      {
        throw new Error('Failed to delete game');
      }

      // Close confirmation dialog
      handleDeleteConfirmationClose();

      // Refresh games list
      fetchGames();
    }
    catch (err)
    {
      setDeleteConfirmation(prev => ({ ...prev, loading: false }));
      alert('Failed to delete game');
      console.error('Error deleting game:', err);
    }
  }, [deleteConfirmation.gameId, handleDeleteConfirmationClose, fetchGames]);

  // Date range handlers
  const handleDateChange = useCallback((dates: [Date | null, Date | null]) =>
  {
    const [start, end] = dates;
    setStartDate(start);
    setEndDate(end);
  }, []);

  const clearDateRange = useCallback(() =>
  {
    setStartDate(null);
    setEndDate(null);
  }, []);

  // Filter logic
  const filteredGames = useMemo(() =>
  {
    return games.filter((game) =>
    {
      // Text search filter
      if (searchText)
      {
        const searchLower = searchText.toLowerCase();
        const teamName = game.teams?.name?.toLowerCase() || '';
        const opponent = game.opponent.toLowerCase();
        const notes = game.notes?.toLowerCase() || '';

        const matchesSearch = teamName.includes(searchLower) ||
          opponent.includes(searchLower) ||
          notes.includes(searchLower);

        if (!matchesSearch) return false;
      }

      // Home/Away filter
      if (homeAwayFilter && game.home_away !== homeAwayFilter)
      {
        return false;
      }

      // Game type filter
      if (gameTypeFilter && game.game_type !== gameTypeFilter)
      {
        return false;
      }

      // Date range filter
      if (startDate || endDate)
      {
        // Use centralized date parsing logic
        const gameDate = parseGameDate(game.date);

        if (startDate)
        {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          if (gameDate < start) return false;
        }

        if (endDate)
        {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          if (gameDate > end) return false;
        }
      }

      return true;
    });
  }, [games, searchText, homeAwayFilter, gameTypeFilter, startDate, endDate]);

  // Clear all filters
  const clearFilters = useCallback(() =>
  {
    setSearchText('');
    setHomeAwayFilter('');
    setGameTypeFilter('');
    clearDateRange();
  }, [clearDateRange]);

  // Check if any filters are active
  const hasActiveFilters = searchText || homeAwayFilter || gameTypeFilter || startDate || endDate;

  // Auto-expand filters when there are active filters
  useEffect(() =>
  {
    if (hasActiveFilters && !filtersExpanded)
    {
      setFiltersExpanded(true);
    }
  }, [hasActiveFilters, filtersExpanded]);

  if (loading)
  {
    return (
      <div className='games-list'>
        <div className='loading'>Loading games...</div>
      </div>
    );
  }

  return (
    <div className='games-list'>
      {error && <div className='alert alert-error'>{error}</div>}

      {/* Filter Section */}
      <div className='filter-section'>
        {/* Filter Toggle Header */}
        <div className='filter-toggle-header'>
          <button
            className='btn btn-secondary'
            onClick={() => setFiltersExpanded(!filtersExpanded)}
            aria-expanded={filtersExpanded ? 'true' : 'false'}
            aria-controls='filter-content'
          >
            <span className='filter-toggle-text'>
              Filters
              {hasActiveFilters && (
                <span className='filter-count-badge'>
                  {[searchText, homeAwayFilter, gameTypeFilter, startDate, endDate].filter(Boolean).length}
                </span>
              )}
            </span>
            <span className={`filter-toggle-icon ${filtersExpanded ? 'expanded' : ''}`}>
              ▲
            </span>
          </button>
          {hasActiveFilters && !filtersExpanded && (
            <button onClick={clearFilters} className='btn btn-secondary btn-sm clear-all-btn-header'>
              Clear All
            </button>
          )}
        </div>

        {/* Filter Content */}
        <div
          id='filter-content'
          className={`filter-content ${filtersExpanded ? 'expanded' : 'collapsed'}`}
        >
          <div className='filter-container'>
            <div className='filter-group'>
              <label htmlFor='search'>Search</label>
              <input
                type='text'
                id='search'
                className='filter-input'
                placeholder='Search teams, opponents, notes...'
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </div>

            <div className='filter-group'>
              <label htmlFor='team'>Team</label>
              <select
                id='team'
                className='filter-input filter-select'
                value={selectedTeam?.teams.id || ''}
                onChange={onTeamChange}
              >
                <option value=''>All Teams</option>
                {teams.map((team) => (
                  <option key={team.teams.id} value={team.teams.id}>
                    {team.teams.name}
                  </option>
                ))}
              </select>
            </div>

            <div className='filter-group'>
              <label htmlFor='location'>Location</label>
              <select
                id='location'
                className='filter-input filter-select'
                value={homeAwayFilter}
                onChange={(e) => setHomeAwayFilter(e.target.value)}
              >
                <option value=''>Home/Away</option>
                <option value='home'>Home</option>
                <option value='away'>Away</option>
                <option value='neutral'>Neutral</option>
              </select>
            </div>

            <div className='filter-group'>
              <label htmlFor='game-type'>Game Type</label>
              <select
                id='game-type'
                className='filter-input filter-select'
                value={gameTypeFilter}
                onChange={(e) => setGameTypeFilter(e.target.value)}
              >
                <option value=''>All Game Types</option>
                <option value='regular'>Regular</option>
                <option value='tournament'>Tournament</option>
                <option value='scrimmage'>Scrimmage</option>
              </select>
            </div>

            <div className='date-range-container'>
              <div className='date-picker-wrapper'>
                <label>Date Range</label>
                <DatePicker
                  selectsRange
                  startDate={startDate}
                  endDate={endDate}
                  onChange={handleDateChange}
                  placeholderText='Select date range'
                  className='filter-input'
                  isClearable
                  dateFormat='MM/dd/yyyy'
                />
              </div>
              {hasActiveFilters && (
                <button onClick={clearFilters} className='btn btn-secondary clear-all-btn'>
                  Clear All
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {games.length === 0 ?
        (
          <div className='empty-state'>
            <h3>No Games Yet</h3>
            <p>Get started by adding your first game to analyze.</p>
          </div>
        ) :
        filteredGames.length === 0 ?
        (
          <div className='empty-state'>
            <h3>No Games Match Filters</h3>
            <p>Try adjusting your filters to see more games.</p>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className='btn btn-secondary btn-sm clear-filters-btn'
              >
                Clear All Filters
              </button>
            )}
          </div>
        ) :
        (
          <div className='grid grid-3'>
            {filteredGames.map((game) => (
              <div
                key={game.id}
                className={`game-card ${game.video_id ? 'clickable' : 'disabled'}`}
                onClick={() => game.video_id && onAnalyzeGame(game)}
                title={game.video_id ? 'Click to analyze game' : 'Video required for analysis'}
              >
                {/* Floating Action Icons */}
                {((game.user_role || userRole) === 'coach' || (game.user_role || userRole) === 'admin') && (
                  <div className='floating-actions'>
                    <button
                      className='floating-action-btn edit-btn'
                      onClick={(e) =>
                      {
                        e.stopPropagation();
                        onEditGame(game);
                      }}
                      title='Edit game'
                      aria-label='Edit game'
                    >
                      <FaPencilAlt />
                    </button>
                    <button
                      className='floating-action-btn delete-btn'
                      onClick={(e) =>
                      {
                        e.stopPropagation();
                        handleDeleteGame(game.id);
                      }}
                      title='Delete game'
                      aria-label='Delete game'
                    >
                      <FaTrash />
                    </button>
                  </div>
                )}

                {game.video_id && (
                  <div className='game-thumbnail'>
                    <div className='thumbnail-loading-placeholder'></div>
                    <img
                      src={getYouTubeThumbnailUrl(game.video_id)}
                      alt={`Thumbnail for ${game.opponent} game`}
                      className='thumbnail-image'
                      loading='lazy'
                      onLoad={(e) =>
                      {
                        const target = e.target as HTMLImageElement;
                        const placeholder = target.previousElementSibling as HTMLElement;
                        if (placeholder)
                        {
                          placeholder.style.display = 'none';
                        }
                      }}
                      onError={(e) =>
                      {
                        const target = e.target as HTMLImageElement;
                        const placeholder = target.previousElementSibling as HTMLElement;
                        if (placeholder)
                        {
                          placeholder.style.display = 'none';
                        }
                        target.src = getYouTubeThumbnailFallback(game.video_id!);
                      }}
                    />
                    {game.teams?.name && (
                      <div className='team-name-overlay'>
                        {game.teams.name}
                      </div>
                    )}
                    <div className='video-overlay'>
                      <div className='play-icon'>▶</div>
                    </div>
                  </div>
                )}

                <div className='game-header'>
                  <div className='game-info'>
                    <h3 className='game-opponent' title={game.opponent}>{game.opponent}</h3>
                    <div className='game-meta'>
                      <span className='game-date'>
                        {formatGameDate(game.date)}
                      </span>
                      <span className='game-type'>{game.game_type}</span>
                      <span className='game-location'>{game.home_away}</span>
                    </div>
                  </div>
                  <div className={`game-result ${getResultClass(game.team_score, game.opp_score)}`}>
                    {formatGameResult(game.team_score, game.opp_score)}
                  </div>
                </div>

                <div className='game-content'>
                  {game.location && <p className='game-location-detail'>📍 {game.location}</p>}

                  <div className='game-notes'>
                    {game.notes || ''}
                  </div>

                  <div className='game-stats'>
                    {game.video_id && (
                      <span className='game-stat'>
                        📹 Video Available
                      </span>
                    )}
                    <span className='game-stat'>
                      💬 {game.coaching_points_count || 0} coaching points
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      <ConfirmationDialog
        isOpen={deleteConfirmation.isOpen}
        onClose={handleDeleteConfirmationClose}
        onConfirm={handleDeleteConfirmationConfirm}
        title='Delete Game'
        message={`Are you sure you want to delete the game against "${deleteConfirmation.gameOpponent}"? This will also delete all coaching points. This action cannot be undone.`}
        confirmButtonText='Delete Game'
        variant='danger'
        loading={deleteConfirmation.loading}
      />

      <JoinTeamModal
        isOpen={showJoinModal}
        onClose={handleJoinModalClose}
        onSuccess={handleJoinModalSuccess}
        initialJoinCode={initialJoinCode}
      />
    </div>
  );
}));
