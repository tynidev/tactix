import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getApiUrl } from '../../utils/api';
import type { Drawing } from '../../types/drawing';
import './CoachingPointModal.css';

interface CoachingPointModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameId: string;
  timestamp: number; // Video timestamp in seconds
  drawingData: Drawing[]; // Current drawing data from canvas
}

interface Player {
  id: string;
  name: string;
}

interface Label {
  id: string;
  name: string;
}

export const CoachingPointModal: React.FC<CoachingPointModalProps> = ({
  isOpen,
  onClose,
  gameId,
  timestamp,
  drawingData,
}) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    title: '',
    feedback: '',
  });
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setFormData({ title: '', feedback: '' });
      setSelectedPlayers([]);
      setSelectedLabels([]);
      setError('');
      // TODO: Load players and labels for the team
      loadPlayersAndLabels();
    }
  }, [isOpen, gameId]);

  const loadPlayersAndLabels = async () => {
    try {
      const token = (await import('../../lib/supabase')).supabase.auth.getSession();
      const session = await token;
      
      if (!session.data.session?.access_token) {
        throw new Error('No access token');
      }

      // For now, we'll leave players and labels empty since they're not required
      // In the future, these would be loaded from the team's players and labels
      setPlayers([]);
      setLabels([]);
    } catch (err) {
      console.error('Error loading players and labels:', err);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.feedback.trim()) {
      setError('Title and feedback are required');
      return;
    }

    if (!user) {
      setError('User not authenticated');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const token = (await import('../../lib/supabase')).supabase.auth.getSession();
      const session = await token;
      
      if (!session.data.session?.access_token) {
        throw new Error('No access token');
      }

      const apiUrl = getApiUrl();
      
      // Create the coaching point
      const coachingPointData = {
        game_id: gameId,
        author_id: user.id,
        title: formData.title.trim(),
        feedback: formData.feedback.trim(),
        timestamp: Math.floor(timestamp * 1000), // convert to milliseconds and round down
        audio_url: '', // Empty for now since we're not recording voice
        duration: 0, // 0 since no audio recording
      };

      const response = await fetch(`${apiUrl}/api/coaching-points`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.data.session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(coachingPointData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to create coaching point');
      }

      const coachingPoint = await response.json();
      
      // Create the drawing event if there's drawing data
      if (drawingData && drawingData.length > 0) {
        const eventData = {
          point_id: coachingPoint.id,
          event_type: 'draw',
          timestamp: 0, // Start of recording session
          event_data: {
            drawings: drawingData,
            canvas_dimensions: {
              // These would typically come from the video dimensions
              width: 1920,
              height: 1080
            }
          }
        };

        const eventResponse = await fetch(`${apiUrl}/api/coaching-point-events`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.data.session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(eventData)
        });

        if (!eventResponse.ok) {
          console.warn('Failed to save drawing data, but coaching point was created');
        }
      }

      // Handle player tagging if any players are selected
      if (selectedPlayers.length > 0) {
        for (const playerId of selectedPlayers) {
          try {
            await fetch(`${apiUrl}/api/coaching-point-tagged-players`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.data.session.access_token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                point_id: coachingPoint.id,
                player_id: playerId
              })
            });
          } catch (err) {
            console.warn('Failed to tag player:', playerId, err);
          }
        }
      }

      // Handle label assignment if any labels are selected
      if (selectedLabels.length > 0) {
        for (const labelId of selectedLabels) {
          try {
            await fetch(`${apiUrl}/api/coaching-point-labels`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.data.session.access_token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                point_id: coachingPoint.id,
                label_id: labelId
              })
            });
          } catch (err) {
            console.warn('Failed to assign label:', labelId, err);
          }
        }
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create coaching point');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const togglePlayerSelection = (playerId: string) => {
    setSelectedPlayers(prev => 
      prev.includes(playerId) 
        ? prev.filter(id => id !== playerId)
        : [...prev, playerId]
    );
  };

  const toggleLabelSelection = (labelId: string) => {
    setSelectedLabels(prev => 
      prev.includes(labelId) 
        ? prev.filter(id => id !== labelId)
        : [...prev, labelId]
    );
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content coaching-point-modal">
        <div className="modal-header">
          <h2>Add Coaching Point</h2>
          <button 
            onClick={onClose}
            className="btn btn-ghost btn-sm"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="form">
          <div className="coaching-point-info">
            <p><strong>Timestamp:</strong> {formatTime(timestamp)}</p>
            <p><strong>Drawings:</strong> {drawingData.length} drawing elements</p>
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          <div className="form-group">
            <label htmlFor="title" className="form-label">
              Title *
            </label>
            <input
              id="title"
              name="title"
              type="text"
              value={formData.title}
              onChange={handleInputChange}
              className="form-input"
              placeholder="Brief summary of the coaching point"
              required
              maxLength={200}
            />
          </div>

          <div className="form-group">
            <label htmlFor="feedback" className="form-label">
              Feedback *
            </label>
            <textarea
              id="feedback"
              name="feedback"
              value={formData.feedback}
              onChange={handleInputChange}
              className="form-textarea"
              placeholder="Detailed feedback and coaching notes..."
              required
              rows={4}
            />
          </div>

          {players.length > 0 && (
            <div className="form-group">
              <label className="form-label">Tagged Players</label>
              <div className="player-tags">
                {players.map((player) => (
                  <button
                    key={player.id}
                    type="button"
                    className={`tag ${selectedPlayers.includes(player.id) ? 'selected' : ''}`}
                    onClick={() => togglePlayerSelection(player.id)}
                  >
                    {player.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {labels.length > 0 && (
            <div className="form-group">
              <label className="form-label">Labels</label>
              <div className="label-tags">
                {labels.map((label) => (
                  <button
                    key={label.id}
                    type="button"
                    className={`tag ${selectedLabels.includes(label.id) ? 'selected' : ''}`}
                    onClick={() => toggleLabelSelection(label.id)}
                  >
                    {label.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="form-actions">
            <button
              type="button"
              onClick={onClose}
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
              {isSubmitting ? 'Creating...' : 'Create Coaching Point'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
