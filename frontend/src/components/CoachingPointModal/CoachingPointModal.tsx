import React, { useEffect, useRef, useState } from 'react';
import { Modal } from '../Modal';
import { useAuth } from '../../contexts/AuthContext';
import type { Drawing } from '../../types/drawing';
import { createCoachingPointWithRecording, getApiUrl } from '../../utils/api';
import './CoachingPointModal.css';

interface CoachingPointModalProps
{
  isOpen: boolean;
  onClose: () => void;
  gameId: string;
  timestamp: number; // Video timestamp in seconds
  drawingData: Drawing[]; // Current drawing data from canvas
  onCoachingPointCreated?: () => void; // Callback to refresh coaching points list
  recordingData?: {
    audioBlob: Blob | null;
    recordingEvents: any[];
    recordingDuration: number;
  } | null;
}

interface Player
{
  id: string;
  name: string;
  jersey_number?: string;
}

interface Label
{
  id: string;
  name: string;
}

export const CoachingPointModal: React.FC<CoachingPointModalProps> = ({
  isOpen,
  onClose,
  gameId,
  timestamp,
  drawingData,
  onCoachingPointCreated,
  recordingData,
}) =>
{
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
  const [labelInput, setLabelInput] = useState('');
  const [playerInput, setPlayerInput] = useState('');
  const [showLabelSuggestions, setShowLabelSuggestions] = useState(false);
  const [showPlayerSuggestions, setShowPlayerSuggestions] = useState(false);
  const [teamId, setTeamId] = useState<string | null>(null);
  const labelInputRef = useRef<HTMLDivElement>(null);
  const playerInputRef = useRef<HTMLDivElement>(null);

  // Reset form when modal opens/closes
  useEffect(() =>
  {
    if (isOpen)
    {
      setFormData({ title: '', feedback: '' });
      setSelectedPlayers([]);
      setSelectedLabels([]);
      setLabelInput('');
      setPlayerInput('');
      setShowLabelSuggestions(false);
      setShowPlayerSuggestions(false);
      setError('');
      loadPlayersAndLabels();
    }
  }, [isOpen, gameId]);

  // Handle click outside to close suggestions
  useEffect(() =>
  {
    const handleClickOutside = (event: MouseEvent) =>
    {
      if (labelInputRef.current && !labelInputRef.current.contains(event.target as Node))
      {
        setShowLabelSuggestions(false);
      }
      if (playerInputRef.current && !playerInputRef.current.contains(event.target as Node))
      {
        setShowPlayerSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () =>
    {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const loadPlayersAndLabels = async () =>
  {
    try
    {
      const token = (await import('../../lib/supabase')).supabase.auth.getSession();
      const session = await token;

      if (!session.data.session?.access_token)
      {
        throw new Error('No access token');
      }

      const apiUrl = getApiUrl();

      // First get the game to find the team ID
      const gameResponse = await fetch(`${apiUrl}/api/games/${gameId}`, {
        headers: {
          'Authorization': `Bearer ${session.data.session.access_token}`,
        },
      });

      if (gameResponse.ok)
      {
        const game = await gameResponse.json();
        const teamIdFromGame = game.team_id;
        setTeamId(teamIdFromGame);

        // Load players for this team
        const playersResponse = await fetch(`${apiUrl}/api/teams/${teamIdFromGame}/players`, {
          headers: {
            'Authorization': `Bearer ${session.data.session.access_token}`,
          },
        });

        if (playersResponse.ok)
        {
          const playersData = await playersResponse.json();
          setPlayers(playersData);
        }

        // Load labels for this team
        const labelsResponse = await fetch(`${apiUrl}/api/teams/${teamIdFromGame}/labels`, {
          headers: {
            'Authorization': `Bearer ${session.data.session.access_token}`,
          },
        });

        if (labelsResponse.ok)
        {
          const labelsData = await labelsResponse.json();
          setLabels(labelsData);
        }
      }
    }
    catch (err)
    {
      console.error('Error loading players and labels:', err);
    }
  };

  const formatTime = (seconds: number): string =>
  {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Filter labels based on input
  const getFilteredLabels = () =>
  {
    if (!labelInput.trim()) return [];
    return labels.filter(label =>
      label.name.toLowerCase().includes(labelInput.toLowerCase()) &&
      !selectedLabels.includes(label.id)
    );
  };

  // Filter players based on input
  const getFilteredPlayers = () =>
  {
    if (!playerInput.trim()) return [];
    return players.filter(player =>
    {
      const matchesName = player.name.toLowerCase().includes(playerInput.toLowerCase());
      const matchesJersey = player.jersey_number?.toLowerCase().includes(playerInput.toLowerCase());
      return (matchesName || matchesJersey) && !selectedPlayers.includes(player.id);
    });
  };

  // Create a new label
  const createNewLabel = async (name: string) =>
  {
    if (!teamId) return null;

    try
    {
      const token = (await import('../../lib/supabase')).supabase.auth.getSession();
      const session = await token;

      if (!session.data.session?.access_token)
      {
        throw new Error('No access token');
      }

      const apiUrl = getApiUrl();

      const response = await fetch(`${apiUrl}/api/teams/${teamId}/labels`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.data.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: name.trim().toUpperCase() }),
      });

      if (response.ok)
      {
        const newLabel = await response.json();
        setLabels(prev => [...prev, newLabel]);
        return newLabel;
      }
    }
    catch (err)
    {
      console.error('Error creating label:', err);
    }
    return null;
  };

  const handleLabelInputChange = (e: React.ChangeEvent<HTMLInputElement>) =>
  {
    const value = e.target.value.toUpperCase();
    setLabelInput(value);
    setShowLabelSuggestions(value.trim().length > 0);
  };

  const handlePlayerInputChange = (e: React.ChangeEvent<HTMLInputElement>) =>
  {
    const value = e.target.value;
    setPlayerInput(value);
    setShowPlayerSuggestions(value.trim().length > 0);
  };

  const handleLabelSelect = async (label: Label | null, inputValue?: string) =>
  {
    if (label)
    {
      setSelectedLabels(prev => [...prev, label.id]);
    }
    else if (inputValue?.trim())
    {
      // Create new label
      const newLabel = await createNewLabel(inputValue.trim());
      if (newLabel)
      {
        setSelectedLabels(prev => [...prev, newLabel.id]);
      }
    }
    setLabelInput('');
    setShowLabelSuggestions(false);
  };

  const handlePlayerSelect = (player: Player) =>
  {
    setSelectedPlayers(prev => [...prev, player.id]);
    setPlayerInput('');
    setShowPlayerSuggestions(false);
  };

  const handleLabelKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) =>
  {
    if (e.key === 'Enter')
    {
      e.preventDefault();
      const filteredLabels = getFilteredLabels();
      if (filteredLabels.length > 0)
      {
        handleLabelSelect(filteredLabels[0]);
      }
      else if (labelInput.trim())
      {
        handleLabelSelect(null, labelInput.trim());
      }
    }
  };

  const handlePlayerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) =>
  {
    if (e.key === 'Enter')
    {
      e.preventDefault();
      const filteredPlayers = getFilteredPlayers();
      if (filteredPlayers.length > 0)
      {
        handlePlayerSelect(filteredPlayers[0]);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) =>
  {
    e.preventDefault();

    if (!formData.title.trim())
    {
      setError('Title is required');
      return;
    }

    if (!user)
    {
      setError('User not authenticated');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try
    {
      // Use the new API function that handles recording data
      if (recordingData)
      {
        // Create coaching point with recording data
        await createCoachingPointWithRecording(
          gameId,
          formData.title.trim(),
          formData.feedback.trim(),
          Math.floor(timestamp * 1000), // convert to milliseconds
          drawingData,
          selectedPlayers,
          selectedLabels,
          recordingData.audioBlob || undefined,
          recordingData.recordingEvents,
          recordingData.recordingDuration,
        );
      }
      else
      {
        // Fallback to original method for non-recording coaching points
        const token = (await import('../../lib/supabase')).supabase.auth.getSession();
        const session = await token;

        if (!session.data.session?.access_token)
        {
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
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(coachingPointData),
        });

        if (!response.ok)
        {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || 'Failed to create coaching point');
        }

        const coachingPoint = await response.json();

        // Create the drawing event if there's drawing data
        if (drawingData && drawingData.length > 0)
        {
          const eventData = {
            point_id: coachingPoint.id,
            event_type: 'draw',
            timestamp: 0, // Start of recording session
            event_data: {
              drawings: drawingData,
              canvas_dimensions: {
                // These would typically come from the video dimensions
                width: 1920,
                height: 1080,
              },
            },
          };

          const eventResponse = await fetch(`${apiUrl}/api/coaching-point-events`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.data.session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(eventData),
          });

          if (!eventResponse.ok)
          {
            console.warn('Failed to save drawing data, but coaching point was created');
          }
        }

        // Handle player tagging if any players are selected
        if (selectedPlayers.length > 0)
        {
          for (const playerId of selectedPlayers)
          {
            try
            {
              await fetch(`${apiUrl}/api/coaching-point-tagged-players`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${session.data.session.access_token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  point_id: coachingPoint.id,
                  player_id: playerId,
                }),
              });
            }
            catch (err)
            {
              console.warn('Failed to tag player:', playerId, err);
            }
          }
        }

        // Handle label assignment if any labels are selected
        if (selectedLabels.length > 0)
        {
          for (const labelId of selectedLabels)
          {
            try
            {
              await fetch(`${apiUrl}/api/coaching-point-labels`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${session.data.session.access_token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  point_id: coachingPoint.id,
                  label_id: labelId,
                }),
              });
            }
            catch (err)
            {
              console.warn('Failed to assign label:', labelId, err);
            }
          }
        }
      }

      // Notify parent component that a coaching point was created
      if (onCoachingPointCreated)
      {
        onCoachingPointCreated();
      }

      onClose();
    }
    catch (err)
    {
      setError(err instanceof Error ? err.message : 'Failed to create coaching point');
    }
    finally
    {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
  {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Coaching Point"
      size="lg"
      className="coaching-point-modal"
    >
      <form onSubmit={handleSubmit} className='form'>
          <div className='coaching-point-info'>
            <p>
              <strong>Timestamp:</strong> {formatTime(timestamp)}
            </p>
            <p>
              <strong>Drawings:</strong> {drawingData.length} drawing elements
            </p>
            {recordingData && (
              <>
                <p>
                  <strong>Recording:</strong> {Math.floor(recordingData.recordingDuration / 1000)}s with{' '}
                  {recordingData.recordingEvents.length} events
                </p>
                {recordingData.audioBlob && (
                  <p>
                    <strong>Audio:</strong> {(recordingData.audioBlob.size / 1024).toFixed(1)} KB
                  </p>
                )}
              </>
            )}
          </div>

          {error && <div className='alert alert-error'>{error}</div>}

          <div className='form-group'>
            <label htmlFor='title' className='form-label'>
              Short Description
            </label>
            <input
              id='title'
              name='title'
              type='text'
              value={formData.title}
              onChange={handleInputChange}
              className='form-input'
              placeholder='Brief summary of the coaching point'
              required
              maxLength={200}
            />
          </div>

          <div className='form-group'>
            <label htmlFor='feedback' className='form-label'>
              Detailed Feedback
            </label>
            <textarea
              id='feedback'
              name='feedback'
              value={formData.feedback}
              onChange={handleInputChange}
              className='form-textarea'
              placeholder='Optional detailed feedback and coaching notes...'
              rows={4}
            />
          </div>

          <div className='form-group'>
            <label className='form-label'>Tagged Players</label>
            <div className='autocomplete-container' ref={playerInputRef}>
              <input
                type='text'
                value={playerInput}
                onChange={handlePlayerInputChange}
                onKeyDown={handlePlayerKeyDown}
                onFocus={() => setShowPlayerSuggestions(playerInput.trim().length > 0)}
                className='form-input'
                placeholder='Type to search players...'
              />
              {showPlayerSuggestions && (
                <div className='autocomplete-suggestions'>
                  {getFilteredPlayers().map((player) => (
                    <div
                      key={player.id}
                      className='autocomplete-suggestion'
                      onClick={() => handlePlayerSelect(player)}
                    >
                      {player.name}
                      {player.jersey_number && <span className='jersey-number'>#{player.jersey_number}</span>}
                    </div>
                  ))}
                  {getFilteredPlayers().length === 0 && playerInput.trim() && (
                    <div className='autocomplete-no-results'>
                      No players found matching "{playerInput}"
                    </div>
                  )}
                </div>
              )}
            </div>
            {selectedPlayers.length > 0 && (
              <div className='selected-tags'>
                {selectedPlayers.map((playerId) =>
                {
                  const player = players.find(p => p.id === playerId);
                  return player ?
                    (
                      <span key={playerId} className='selected-tag'>
                        {player.name.split(' ')[0]}
                        <button
                          type='button'
                          onClick={() => setSelectedPlayers(prev => prev.filter(id => id !== playerId))}
                          className='remove-tag'
                          aria-label={`Remove ${player.name}`}
                        >
                          ×
                        </button>
                      </span>
                    ) :
                    null;
                })}
              </div>
            )}
          </div>

          <div className='form-group'>
            <label className='form-label'>Labels</label>
            <div className='autocomplete-container' ref={labelInputRef}>
              <input
                type='text'
                value={labelInput}
                onChange={handleLabelInputChange}
                onKeyDown={handleLabelKeyDown}
                onFocus={() => setShowLabelSuggestions(labelInput.trim().length > 0)}
                className='form-input'
                placeholder='Type to search or create labels...'
              />
              {showLabelSuggestions && (
                <div className='autocomplete-suggestions'>
                  {getFilteredLabels().map((label) => (
                    <div
                      key={label.id}
                      className='autocomplete-suggestion'
                      onClick={() => handleLabelSelect(label)}
                    >
                      {label.name}
                    </div>
                  ))}
                  {getFilteredLabels().length === 0 && labelInput.trim() && (
                    <div
                      className='autocomplete-suggestion create-new'
                      onClick={() => handleLabelSelect(null, labelInput.trim())}
                    >
                      Create "{labelInput.trim()}"
                    </div>
                  )}
                </div>
              )}
            </div>
            {selectedLabels.length > 0 && (
              <div className='selected-tags'>
                {selectedLabels.map((labelId) =>
                {
                  const label = labels.find(l => l.id === labelId);
                  return label ?
                    (
                      <span key={labelId} className='selected-tag'>
                        {label.name}
                        <button
                          type='button'
                          onClick={() => setSelectedLabels(prev => prev.filter(id => id !== labelId))}
                          className='remove-tag'
                          aria-label={`Remove ${label.name}`}
                        >
                          ×
                        </button>
                      </span>
                    ) :
                    null;
                })}
              </div>
            )}
          </div>

          <div className='form-actions'>
            <button
              type='button'
              onClick={onClose}
              className='btn btn-secondary'
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type='submit'
              className='btn btn-primary'
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating...' : 'Create Coaching Point'}
            </button>
          </div>
      </form>
    </Modal>
  );
};
