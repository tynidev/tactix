import React, { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import './Auth.css'

export const Auth: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const { signIn, signUp } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccessMessage('')

    try {
      let result
      if (isLogin) {
        result = await signIn(email, password)
      } else {
        if (!name.trim()) {
          setError('Name is required')
          setLoading(false)
          return
        }
        result = await signUp(email, password, name)
      }

      if (result.error) {
        setError(result.error)
      } else if (!isLogin) {
        // Successful signup - user will be automatically signed in after a brief delay
        setSuccessMessage('Account created successfully! Check your email for verification.')
        // Clear the form
        setEmail('')
        setPassword('')
        setName('')
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>TACTIX</h1>
          <p>Video Coaching Platform</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-tabs">
            <button
              type="button"
              className={`tab ${isLogin ? 'active' : ''}`}
              onClick={() => {
                setIsLogin(true)
                setError('')
                setSuccessMessage('')
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`tab ${!isLogin ? 'active' : ''}`}
              onClick={() => {
                setIsLogin(false)
                setError('')
                setSuccessMessage('')
              }}
            >
              Sign Up
            </button>
          </div>

          {error && <div className="error-message">{error}</div>}
          {successMessage && <div className="success-message">{successMessage}</div>}

          {!isLogin && (
            <div className="form-group">
              <label htmlFor="name">Full Name</label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required={!isLogin}
                placeholder="Enter your full name"
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Enter your email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter your password"
              minLength={6}
            />
          </div>

          <button
            type="submit"
            className="auth-button"
            disabled={loading}
          >
            {loading ? 'Loading...' : isLogin ? 'Sign In' : 'Sign Up'}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button
              type="button"
              className="link-button"
              onClick={() => setIsLogin(!isLogin)}
            >
              {isLogin ? 'Sign Up' : 'Sign In'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
