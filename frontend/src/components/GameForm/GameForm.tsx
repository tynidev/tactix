import React, { useState } from 'react';
import './GameForm.css';

interface GameFormData {
  opponent: string;
  date: string;
  location: string | null;
  video_id: string | null;
  team_score: number | null;
  opp_score: number | null;
  game_type: 'regular' | 'tournament' | 'scrimmage';
  home_away: 'home' | 'away' | 'neutral';
  notes: string | null;
}

interface GameFormProps {
  teamId: string;
  onSubmit: (gameData: GameFormData) => Promise<void>;
  onCancel: () => void;
  initialData?: Partial<GameFormData>;
  isEditing?: boolean;
}

export const GameForm: React.FC<GameFormProps> = ({
  teamId,
  onSubmit,
  onCancel,
  initialData = {},
  isEditing = false
}) => {
  const [formData, setFormData] = useState<GameFormData>({
    opponent: initialData.opponent || '',
    date: initialData.date || '',
    location: initialData.location || null,
    video_id: initialData.video_id || null,
    team_score: initialData.team_score || null,
    opp_score: initialData.opp_score || null,
    game_type: initialData.game_type || 'regular',
    home_away: initialData.home_away || 'home',
    notes: initialData.notes || null
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.opponent.trim() || !formData.date) {
      alert('Opponent and date are required');
      return;
    }

    setIsSubmitting(true);
    try {
      // Convert empty strings to null for API
      const apiData = {
        ...formData,
        location: formData.location?.trim() || null,
        video_id: formData.video_id?.trim() || null,
        notes: formData.notes?.trim() || null,
        team_id: teamId
      };
      await onSubmit(apiData as any);
    } catch (error) {
      console.error('Error submitting game:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    
    if (name === 'team_score' || name === 'opp_score') {
      setFormData(prev => ({
        ...prev,
        [name]: value === '' ? null : parseInt(value, 10)
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>{isEditing ? 'Edit Game' : 'Add New Game'}</h2>
          <button 
            onClick={onCancel}
            className="btn btn-ghost btn-sm"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="opponent" className="form-label">
                Opponent *
              </label>
              <input
                id="opponent"
                name="opponent"
                type="text"
                value={formData.opponent}
                onChange={handleInputChange}
                className="form-input"
                placeholder="Team name"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="date" className="form-label">
                Game Date *
              </label>
              <input
                id="date"
                name="date"
                type="date"
                value={formData.date}
                onChange={handleInputChange}
                className="form-input"
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="game_type" className="form-label">
                Game Type
              </label>
              <select
                id="game_type"
                name="game_type"
                value={formData.game_type}
                onChange={handleInputChange}
                className="form-select"
              >
                <option value="regular">Regular</option>
                <option value="tournament">Tournament</option>
                <option value="scrimmage">Scrimmage</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="home_away" className="form-label">
                Home/Away
              </label>
              <select
                id="home_away"
                name="home_away"
                value={formData.home_away}
                onChange={handleInputChange}
                className="form-select"
              >
                <option value="home">Home</option>
                <option value="away">Away</option>
                <option value="neutral">Neutral</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="location" className="form-label">
              Location
            </label>
            <input
              id="location"
              name="location"
              type="text"
              value={formData.location || ''}
              onChange={handleInputChange}
              className="form-input"
              placeholder="Field name or address"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="team_score" className="form-label">
                Our Score
              </label>
              <input
                id="team_score"
                name="team_score"
                type="number"
                min="0"
                value={formData.team_score || ''}
                onChange={handleInputChange}
                className="form-input"
                placeholder="0"
              />
            </div>

            <div className="form-group">
              <label htmlFor="opp_score" className="form-label">
                Opponent Score
              </label>
              <input
                id="opp_score"
                name="opp_score"
                type="number"
                min="0"
                value={formData.opp_score || ''}
                onChange={handleInputChange}
                className="form-input"
                placeholder="0"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="video_id" className="form-label">
              YouTube Video URL
            </label>
            <input
              id="video_id"
              name="video_id"
              type="url"
              value={formData.video_id || ''}
              onChange={handleInputChange}
              className="form-input"
              placeholder="https://www.youtube.com/watch?v=..."
            />
            <div className="form-help">
              Paste the full YouTube URL. We'll extract the video ID automatically.
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="notes" className="form-label">
              Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes || ''}
              onChange={handleInputChange}
              className="form-textarea"
              placeholder="Game notes, key moments, etc."
              rows={3}
            />
          </div>

          <div className="form-actions">
            <button
              type="button"
              onClick={onCancel}
              className="btn btn-secondary"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : isEditing ? 'Update Game' : 'Create Game'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
