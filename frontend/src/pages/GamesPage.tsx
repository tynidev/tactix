import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { GamesList } from '../components/GamesList/GamesList'
import { GameForm } from '../components/GameForm/GameForm'
import { getApiUrl } from '../utils/api'

interface Team {
  role: string
  teams: {
    id: string
    name: string
    created_at: string
  }
}

interface Game {
  id: string
  opponent: string
  date: string
  location: string | null
  video_id: string | null
  team_score: number | null
  opp_score: number | null
  game_type: 'regular' | 'tournament' | 'scrimmage'
  home_away: 'home' | 'away' | 'neutral'
  notes: string | null
  created_at: string
  teams?: {
    id: string
    name: string
  }
}

export const GamesPage: React.FC = () => {
  const { teamId } = useParams<{ teamId: string }>()
  const navigate = useNavigate()
  const [teams, setTeams] = useState<Team[]>([])
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showGameForm, setShowGameForm] = useState(false)
  const [editingGame, setEditingGame] = useState<Game | null>(null)

  useEffect(() => {
    // Set body class for dashboard mode
    document.body.className = 'dashboard-mode'
    fetchTeams()
    
    // Cleanup function to reset body class
    return () => {
      document.body.className = ''
    }
  }, [])

  useEffect(() => {
    if (teamId && teams.length > 0) {
      const team = teams.find(t => t.teams.id === teamId)
      setSelectedTeam(team || null)
    }
  }, [teamId, teams])

  const fetchTeams = async () => {
    try {
      const token = (await import('../lib/supabase')).supabase.auth.getSession()
      const session = await token
      
      if (!session.data.session?.access_token) {
        throw new Error('No access token')
      }

      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/teams`, {
        headers: {
          'Authorization': `Bearer ${session.data.session.access_token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch teams')
      }

      const data = await response.json()
      setTeams(data)
    } catch (err) {
      setError('Failed to load teams')
      console.error('Error fetching teams:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleAddGame = () => {
    setEditingGame(null)
    setShowGameForm(true)
  }

  const handleEditGame = (game: Game) => {
    setEditingGame(game)
    setShowGameForm(true)
  }

  const handleAnalyzeGame = (game: Game) => {
    navigate(`/review/${game.id}`)
  }

  const handleGameFormSubmit = async (gameData: any) => {
    try {
      const token = (await import('../lib/supabase')).supabase.auth.getSession()
      const session = await token
      
      if (!session.data.session?.access_token) {
        throw new Error('No access token')
      }

      const apiUrl = getApiUrl()
      const url = editingGame 
        ? `${apiUrl}/api/games/${editingGame.id}`
        : `${apiUrl}/api/games`
      
      const response = await fetch(url, {
        method: editingGame ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${session.data.session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(gameData)
      })

      if (!response.ok) {
        throw new Error('Failed to save game')
      }

      setShowGameForm(false)
      setEditingGame(null)
      // The GamesList component will refresh automatically
    } catch (err) {
      alert('Failed to save game')
      console.error('Error saving game:', err)
    }
  }

  const handleCancelGameForm = () => {
    setShowGameForm(false)
    setEditingGame(null)
  }

  const handleTeamChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newTeamId = event.target.value
    if (newTeamId) {
      navigate(`/games/${newTeamId}`)
    } else {
      navigate('/games')
    }
  }

  // Show loading state
  if (loading) {
    return <div className="loading">Loading...</div>
  }

  // If we have a teamId but no selectedTeam, it means the team wasn't found
  if (teamId && !selectedTeam) {
    return (
      <main className="dashboard-main">
        <div className="alert alert-error">Team not found or you don't have access to this team.</div>
      </main>
    )
  }

  return (
    <main className="dashboard-main">
      {/* Game Form Modal */}
      {showGameForm && selectedTeam && (
        <GameForm
          teamId={selectedTeam.teams.id}
          onSubmit={handleGameFormSubmit}
          onCancel={handleCancelGameForm}
          initialData={editingGame || undefined}
          isEditing={!!editingGame}
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '0px 20px 0px 20px'}}>
        <h1 className="section-title" style={{ margin: 0 }}>Games</h1>
        {(selectedTeam && (selectedTeam.role === 'coach' || selectedTeam.role === 'admin')) && 
          <button onClick={handleAddGame} className="btn btn-primary">
            Add Game
          </button>
        }
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Games List */}
      <GamesList
        teamId={selectedTeam?.teams.id}
        userRole={selectedTeam?.role}
        teams={teams}
        selectedTeam={selectedTeam}
        onTeamChange={handleTeamChange}
        onEditGame={handleEditGame}
        onAnalyzeGame={handleAnalyzeGame}
      />
    </main>
  )
}
