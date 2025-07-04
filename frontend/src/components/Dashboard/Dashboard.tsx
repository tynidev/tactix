import React, { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { getApiUrl } from '../../utils/api'
import './Dashboard.css'

interface Team {
  role: string
  teams: {
    id: string
    name: string
    coach_join_code: string
    player_join_code: string
    admin_join_code: string
    parent_join_code: string
    created_at: string
  }
}

export const Dashboard: React.FC = () => {
  const { user, signOut } = useAuth()
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchTeams()
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
                  <h3>{teamMembership.teams.name}</h3>
                  <p className="team-role">Role: {teamMembership.role}</p>
                  <p className="team-created">
                    Created: {new Date(teamMembership.teams.created_at).toLocaleDateString()}
                  </p>
                  
                  <div className="join-codes">
                    <h4>Join Codes:</h4>
                    <div className="join-codes-grid">
                      {teamMembership.role !== 'coach' && (
                        <div className="join-code-item">
                          <span className="join-code-label">Coach:</span>
                          <code className="join-code">{teamMembership.teams.coach_join_code}</code>
                        </div>
                      )}
                      {teamMembership.role !== 'player' && (
                        <div className="join-code-item">
                          <span className="join-code-label">Player:</span>
                          <code className="join-code">{teamMembership.teams.player_join_code}</code>
                        </div>
                      )}
                      {teamMembership.role !== 'admin' && (
                        <div className="join-code-item">
                          <span className="join-code-label">Admin:</span>
                          <code className="join-code">{teamMembership.teams.admin_join_code}</code>
                        </div>
                      )}
                      {teamMembership.role !== 'parent' && (
                        <div className="join-code-item">
                          <span className="join-code-label">Parent:</span>
                          <code className="join-code">{teamMembership.teams.parent_join_code}</code>
                        </div>
                      )}
                    </div>
                  </div>

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
