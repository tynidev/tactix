import React, { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { getApiUrl } from '../../utils/api'
import './Dashboard.css'

interface Team {
  role: string
  teams: {
    id: string
    name: string
    created_at: string
  }
}

export const Dashboard: React.FC = () => {
  const { user, signOut } = useAuth()
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null)
  const [editingTeamName, setEditingTeamName] = useState('')

  useEffect(() => {
    // Set body class for dashboard mode
    document.body.className = 'dashboard-mode'
    fetchTeams()
    
    // Cleanup function to reset body class
    return () => {
      document.body.className = ''
    }
  }, [])

  const fetchTeams = async () => {
    try {
      const token = (await import('../../lib/supabase')).supabase.auth.getSession()
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

  const handleCreateTeam = async () => {
    const teamName = prompt('Enter team name:')
    if (!teamName) return

    try {
      const token = (await import('../../lib/supabase')).supabase.auth.getSession()
      const session = await token
      
      if (!session.data.session?.access_token) {
        throw new Error('No access token')
      }

      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/teams`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.data.session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: teamName })
      })

      if (!response.ok) {
        throw new Error('Failed to create team')
      }

      // Refresh teams list
      fetchTeams()
    } catch (err) {
      alert('Failed to create team')
      console.error('Error creating team:', err)
    }
  }

  const handleEditTeam = (teamId: string, currentName: string) => {
    setEditingTeamId(teamId)
    setEditingTeamName(currentName)
  }

  const handleCancelEdit = () => {
    setEditingTeamId(null)
    setEditingTeamName('')
  }

  const handleSaveTeamName = async (teamId: string) => {
    if (!editingTeamName.trim()) {
      alert('Team name cannot be empty')
      return
    }

    try {
      const token = (await import('../../lib/supabase')).supabase.auth.getSession()
      const session = await token
      
      if (!session.data.session?.access_token) {
        throw new Error('No access token')
      }

      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/teams/${teamId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.data.session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: editingTeamName.trim() })
      })

      if (!response.ok) {
        throw new Error('Failed to update team name')
      }

      // Update the local state
      setTeams(teams.map(team => 
        team.teams.id === teamId 
          ? { ...team, teams: { ...team.teams, name: editingTeamName.trim() } }
          : team
      ))

      // Reset editing state
      setEditingTeamId(null)
      setEditingTeamName('')
    } catch (err) {
      alert('Failed to update team name')
      console.error('Error updating team name:', err)
    }
  }

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="loading">Loading...</div>
      </div>
    )
  }

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-content">
          <h1>TACTIX Dashboard</h1>
          <div className="user-menu">
            <span>Welcome, {user?.email}</span>
            <button onClick={signOut} className="sign-out-button">
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="dashboard-main">
        <div className="teams-section">
          <div className="section-header">
            <h2>My Teams</h2>
            <button onClick={handleCreateTeam} className="create-button">
              Create Team
            </button>
          </div>

          {error && <div className="error-message">{error}</div>}

          {teams.length === 0 ? (
            <div className="empty-state">
              <p>No teams found. Create your first team to get started!</p>
            </div>
          ) : (
            <div className="teams-grid">
              {teams.map((teamMembership) => (
                <div key={teamMembership.teams.id} className="team-card">
                  <div className="team-header">
                    {editingTeamId === teamMembership.teams.id ? (
                      <div className="team-name-edit">
                        <input
                          type="text"
                          value={editingTeamName}
                          onChange={(e) => setEditingTeamName(e.target.value)}
                          className="team-name-input"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleSaveTeamName(teamMembership.teams.id)
                            } else if (e.key === 'Escape') {
                              handleCancelEdit()
                            }
                          }}
                          autoFocus
                        />
                        <div className="edit-actions">
                          <button
                            onClick={() => handleSaveTeamName(teamMembership.teams.id)}
                            className="save-button"
                            title="Save"
                          >
                            ✓
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="cancel-button"
                            title="Cancel"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="team-name-display">
                        <h3>{teamMembership.teams.name}</h3>
                        {(teamMembership.role === 'coach' || teamMembership.role === 'admin') && (
                          <button
                            onClick={() => handleEditTeam(teamMembership.teams.id, teamMembership.teams.name)}
                            className="edit-button"
                            title="Edit team name"
                          >
                            ✏️
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <p className="team-role">Role: {teamMembership.role}</p>
                  <p className="team-created">
                    Created: {new Date(teamMembership.teams.created_at).toLocaleDateString()}
                  </p>
                  
                  <div className="team-actions">
                    <button className="team-button">View Games</button>
                    {(teamMembership.role === 'coach' || teamMembership.role === 'admin') && (
                      <button className="team-button secondary">Manage</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
