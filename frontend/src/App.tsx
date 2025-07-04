import React from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { Auth } from './components/Auth/Auth'
import { Dashboard } from './components/Dashboard/Dashboard'
import './App.css'

const AppContent: React.FC = () => {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner">Loading...</div>
      </div>
    )
  }

  return user ? <Dashboard /> : <Auth />
}

function App() {
  return (
    <AuthProvider>
      <div className="App">
        <AppContent />
      </div>
    </AuthProvider>
  )
}

export default App
