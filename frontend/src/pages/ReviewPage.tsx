import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { GameAnalysis } from '../components/GameAnalysis/GameAnalysis';
import { getApiUrl, getValidAccessToken } from '../utils/api';

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
  teams?: {
    id: string;
    name: string;
  };
}

export const ReviewPage: React.FC = () =>
{
  const { gameId } = useParams<{ gameId: string; }>();
  const navigate = useNavigate();
  const [game, setGame] = useState<Game | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() =>
  {
    // Set body class for HUD mode when analyzing
    if (gameId)
    {
      document.body.className = 'hud-mode';
    }
    else
    {
      document.body.className = 'dashboard-mode';
    }

    fetchGames();

    // Cleanup function to reset body class
    return () =>
    {
      document.body.className = '';
    };
  }, [gameId]);

  useEffect(() =>
  {
    if (gameId && games.length > 0)
    {
      const foundGame = games.find(g => g.id === gameId);
      setGame(foundGame || null);
    }
  }, [gameId, games]);

  const fetchGames = async () =>
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
      const response = await fetch(`${apiUrl}/api/games`, {
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
  };

  const handleBackFromAnalysis = () =>
  {
    navigate('/review');
  };

  const handleAnalyzeGame = (selectedGame: Game) =>
  {
    navigate(`/review/${selectedGame.id}`);
  };

  // Show loading state
  if (loading)
  {
    return <div className='loading'>Loading...</div>;
  }

  // If we have a gameId but no game, it means the game wasn't found
  if (gameId && !game)
  {
    return (
      <main className='dashboard-main'>
        <div className='alert alert-error'>Game not found or you don't have access to this game.</div>
        <button onClick={() => navigate('/review')} className='btn btn-secondary'>
          Back to Game Selection
        </button>
      </main>
    );
  }

  // If we have a specific game, show the analysis component
  if (game)
  {
    return <GameAnalysis game={game} onBack={handleBackFromAnalysis} />;
  }

  // Otherwise, show game selection interface
  return (
    <main className='dashboard-main'>
      <div className='section-header'>
        <h1 className='section-title'>Video Review</h1>
      </div>

      {error && <div className='alert alert-error'>{error}</div>}

      {games.length === 0 ?
        (
          <div className='empty-state'>
            <h3>No Games Available</h3>
            <p>You need to add games with video to start reviewing.</p>
            <button
              onClick={() => navigate('/games')}
              className='btn btn-primary'
              style={{ marginTop: 'var(--space-md)' }}
            >
              Go to Games
            </button>
          </div>
        ) :
        (
          <div className='games-grid'>
            {games
              .filter(game => game.video_id) // Only show games with video
              .map((game) => (
                <div key={game.id} className='game-card'>
                  <div className='game-header'>
                    <div className='game-info'>
                      <h3 className='game-opponent'>vs {game.opponent}</h3>
                      <div className='game-meta'>
                        <span className='game-date'>
                          {new Date(game.date).toLocaleDateString()}
                        </span>
                        <span className='game-type'>{game.game_type}</span>
                        <span className='game-location'>{game.home_away}</span>
                        {game.teams && <span className='team-name'>{game.teams.name}</span>}
                      </div>
                    </div>
                    <div className='game-result'>
                      {game.team_score !== null && game.opp_score !== null ?
                        (
                          game.team_score > game.opp_score ?
                            `W ${game.team_score}-${game.opp_score}` :
                            game.team_score < game.opp_score ?
                            `L ${game.team_score}-${game.opp_score}` :
                            `T ${game.team_score}-${game.opp_score}`
                        ) :
                        'No score'}
                    </div>
                  </div>

                  {game.location && <p className='game-location-detail'>📍 {game.location}</p>}

                  {game.notes && <p className='game-notes'>{game.notes}</p>}

                  <div className='game-stats'>
                    <span className='game-stat'>📹 Video Available</span>
                  </div>

                  <div className='game-actions'>
                    <button
                      onClick={() => handleAnalyzeGame(game)}
                      className='btn btn-primary'
                    >
                      Start Review
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}

      {games.length > 0 && games.filter(game => game.video_id).length === 0 && (
        <div className='empty-state'>
          <h3>No Videos Available</h3>
          <p>Add video links to your games to start reviewing them.</p>
          <button
            onClick={() => navigate('/games')}
            className='btn btn-primary'
            style={{ marginTop: 'var(--space-md)' }}
          >
            Go to Games
          </button>
        </div>
      )}
    </main>
  );
};
