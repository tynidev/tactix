import React, { useEffect, useState } from 'react';
import { getApiUrl, getValidAccessToken } from '../../utils/api';
import './GamesList.css';

interface Game {
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
}

interface GamesListProps {
  teamId: string;
  userRole: string;
  onEditGame: (game: Game) => void;
  onAnalyzeGame: (game: Game) => void;
}

export const GamesList: React.FC<GamesListProps> = ({
  teamId,
  userRole,
  onEditGame,
  onAnalyzeGame
}) => {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchGames();
  }, [teamId]);

  const fetchGames = async () => {
    try {
      setLoading(true);
      const token = await getValidAccessToken();
      
      if (!token) {
        throw new Error('No access token');
      }

      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/games/team/${teamId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch games');
      }

      const data = await response.json();
      setGames(data);
    } catch (err) {
      setError('Failed to load games');
      console.error('Error fetching games:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGame = async (gameId: string) => {
    if (!confirm('Are you sure you want to delete this game? This will also delete all coaching points.')) {
      return;
    }

    try {
      const token = await getValidAccessToken();
      
      if (!token) {
        throw new Error('No access token');
      }

      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/games/${gameId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete game');
      }

      // Refresh games list
      fetchGames();
    } catch (err) {
      alert('Failed to delete game');
      console.error('Error deleting game:', err);
    }
  };

  const formatGameResult = (teamScore: number | null, oppScore: number | null) => {
    if (teamScore === null || oppScore === null) {
      return 'No score';
    }

    if (teamScore > oppScore) {
      return `W ${teamScore}-${oppScore}`;
    } else if (teamScore < oppScore) {
      return `L ${teamScore}-${oppScore}`;
    } else {
      return `T ${teamScore}-${oppScore}`;
    }
  };

  const getResultClass = (teamScore: number | null, oppScore: number | null) => {
    if (teamScore === null || oppScore === null) {
      return '';
    }

    if (teamScore > oppScore) {
      return 'result-win';
    } else if (teamScore < oppScore) {
      return 'result-loss';
    } else {
      return 'result-tie';
    }
  };

  if (loading) {
    return (
      <div className="games-list">
        <div className="loading">Loading games...</div>
      </div>
    );
  }

  return (
    <div className="games-list">
      {error && <div className="alert alert-error">{error}</div>}

      {games.length === 0 ? (
        <div className="empty-state">
          <h3>No Games Yet</h3>
          <p>Get started by adding your first game to analyze.</p>
        </div>
      ) : (
        <div className="games-grid">
          {games.map((game) => (
            <div key={game.id} className="game-card">
              <div className="game-header">
                <div className="game-info">
                  <h3 className="game-opponent">vs {game.opponent}</h3>
                  <div className="game-meta">
                    <span className="game-date">
                      {new Date(game.date).toLocaleDateString()}
                    </span>
                    <span className="game-type">{game.game_type}</span>
                    <span className="game-location">{game.home_away}</span>
                  </div>
                </div>
                <div className={`game-result ${getResultClass(game.team_score, game.opp_score)}`}>
                  {formatGameResult(game.team_score, game.opp_score)}
                </div>
              </div>

              {game.location && (
                <p className="game-location-detail">📍 {game.location}</p>
              )}

              {game.notes && (
                <p className="game-notes">{game.notes}</p>
              )}

              <div className="game-stats">
                {game.video_id && (
                  <span className="game-stat">
                    📹 Video Available
                  </span>
                )}
                <span className="game-stat">
                  💬 {game.coaching_points_count || 0} coaching points
                </span>
              </div>

              <div className="game-actions">
                <button
                  onClick={() => onAnalyzeGame(game)}
                  className="btn btn-primary btn-sm"
                  disabled={!game.video_id}
                  title={!game.video_id ? 'Video required for analysis' : 'Start analysis'}
                >
                  {game.video_id ? 'Analyze' : 'No Video'}
                </button>
                
                {(userRole === 'coach' || userRole === 'admin') && (
                  <>
                    <button
                      onClick={() => onEditGame(game)}
                      className="btn btn-secondary btn-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteGame(game.id)}
                      className="btn btn-error btn-sm"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
