import React, { useEffect, useMemo, useState } from 'react';
import { parseVideoInfo } from '../../utils/videoUtils';
import { Modal } from '../Modal';
import './GameForm.css';

interface GameFormData
{
  opponent: string;
  date: string;
  location: string | null;
  video_url: string | null;
  team_score: number | null;
  opp_score: number | null;
  game_type: 'regular' | 'tournament' | 'scrimmage';
  home_away: 'home' | 'away' | 'neutral';
  notes: string | null;
}

interface GameFormProps
{
  isOpen: boolean;
  teamId: string;
  onSubmit: (gameData: GameFormData) => Promise<void>;
  onCancel: () => void;
  initialData?: Partial<GameFormData>;
  isEditing?: boolean;
}

// Helper function to convert YouTube ID back to full URL for editing
const getVideoUrlForEditing = (videoId: string | null | undefined): string | null =>
{
  if (!videoId) return null;

  // Check if it's already a full URL (contains protocol)
  try
  {
    new URL(videoId);
    // If URL constructor succeeds, it's already a valid full URL - return as is
    return videoId;
  }
  catch
  {
    // Not a valid URL, check if it's a YouTube video ID
    // YouTube video IDs are exactly 11 characters of alphanumeric, dash, and underscore
    if (/^[a-zA-Z0-9_-]{11}$/.test(videoId))
    {
      return `https://www.youtube.com/watch?v=${videoId}`;
    }

    // If it's not a valid URL and not a YouTube ID, return as is
    // This handles edge cases gracefully
    return videoId;
  }
};

export const GameForm: React.FC<GameFormProps> = ({
  isOpen,
  teamId,
  onSubmit,
  onCancel,
  initialData,
  isEditing = false,
}) =>
{
  // Create stable initial form data using useMemo
  const initialFormData = useMemo(() =>
  {
    const data = initialData || {};
    return {
      opponent: data.opponent || '',
      date: data.date || '',
      location: data.location || null,
      video_url: isEditing ? getVideoUrlForEditing(data.video_url) : (data.video_url || null),
      team_score: data.team_score !== undefined ? data.team_score : null,
      opp_score: data.opp_score !== undefined ? data.opp_score : null,
      game_type: data.game_type || 'regular',
      home_away: data.home_away || 'home',
      notes: data.notes || null,
    };
  }, [initialData, isEditing]);

  const [formData, setFormData] = useState<GameFormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationMessage, setValidationMessage] = useState<string>('');

  // Update form data when initialData changes (for editing existing games)
  useEffect(() =>
  {
    setFormData(initialFormData);
  }, [initialFormData]);

  // Reset form when opening in create mode so old values don't persist
  useEffect(() =>
  {
    if (isOpen && !isEditing)
    {
      setFormData({
        opponent: '',
        date: '',
        location: null,
        video_url: null,
        team_score: null,
        opp_score: null,
        game_type: 'regular',
        home_away: 'home',
        notes: null,
      });
      setValidationMessage('');
    }
  }, [isOpen, isEditing]);

  const handleSubmit = async (e: React.FormEvent) =>
  {
    e.preventDefault();
    setValidationMessage('');

    if (!formData.opponent.trim() || !formData.date)
    {
      setValidationMessage('Opponent and date are required');
      return;
    }

    // Validate video URL is provided
    if (!formData.video_url?.trim())
    {
      setValidationMessage('Video URL is required');
      return;
    }

    // Validate that we can parse a valid video URL
    const videoInfo = parseVideoInfo(formData.video_url.trim());
    if (!videoInfo)
    {
      // If videoInfo is null, it means no patterns matched
      setValidationMessage('Please provide a valid YouTube or HTML5 video URL');
      return;
    }

    setIsSubmitting(true);

    try
    {
      setValidationMessage('Validating video...');

      // Convert empty strings to null for API and send the original video URL
      // Let the backend handle VEO parsing
      const apiData = {
        ...formData,
        location: formData.location?.trim() || null,
        video_url: formData.video_url.trim(),
        notes: formData.notes?.trim() || null,
        team_id: teamId,
      };

      await onSubmit(apiData);
    }
    catch (error)
    {
      console.error('Error submitting game:', error);
      if (error instanceof Error)
      {
        setValidationMessage(error.message || 'Failed to save game');
      }
      else
      {
        setValidationMessage('Failed to save game');
      }
    }
    finally
    {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) =>
  {
    const { name, value } = e.target;

    if (name === 'team_score' || name === 'opp_score')
    {
      setFormData(prev => ({
        ...prev,
        [name]: value === '' ? null : parseInt(value, 10),
      }));
    }
    else
    {
      setFormData(prev => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={isEditing ? 'Edit Game' : 'Add New Game'}
      size='lg'
      className='game-form-modal'
    >
      <form onSubmit={handleSubmit} className='form'>
        <div className='form-row'>
          <div className='form-group'>
            <label htmlFor='opponent' className='form-label'>
              Opponent
            </label>
            <input
              id='opponent'
              name='opponent'
              type='text'
              value={formData.opponent}
              onChange={handleInputChange}
              className='form-input'
              placeholder='Team name'
              required
            />
          </div>

          <div className='form-group'>
            <label htmlFor='date' className='form-label'>
              Game Date
            </label>
            <input
              id='date'
              name='date'
              type='date'
              value={formData.date}
              onChange={handleInputChange}
              className='form-input'
              required
            />
          </div>
        </div>

        <div className='form-row'>
          <div className='form-group'>
            <label htmlFor='game_type' className='form-label'>
              Game Type
            </label>
            <select
              id='game_type'
              name='game_type'
              value={formData.game_type}
              onChange={handleInputChange}
              className='form-select'
            >
              <option value='regular'>Regular</option>
              <option value='tournament'>Tournament</option>
              <option value='scrimmage'>Scrimmage</option>
            </select>
          </div>

          <div className='form-group'>
            <label htmlFor='home_away' className='form-label'>
              Home/Away
            </label>
            <select
              id='home_away'
              name='home_away'
              value={formData.home_away}
              onChange={handleInputChange}
              className='form-select'
            >
              <option value='home'>Home</option>
              <option value='away'>Away</option>
              <option value='neutral'>Neutral</option>
            </select>
          </div>
        </div>

        <div className='form-group'>
          <label htmlFor='location' className='form-label'>
            Location
          </label>
          <input
            id='location'
            name='location'
            type='text'
            value={formData.location || ''}
            onChange={handleInputChange}
            className='form-input'
            placeholder='Field name or address'
          />
        </div>

        <div className='form-row'>
          <div className='form-group'>
            <label htmlFor='team_score' className='form-label'>
              Our Score
            </label>
            <input
              id='team_score'
              name='team_score'
              type='number'
              min='0'
              value={formData.team_score !== null ? formData.team_score : ''}
              onChange={handleInputChange}
              className='form-input'
              placeholder='0'
            />
          </div>

          <div className='form-group'>
            <label htmlFor='opp_score' className='form-label'>
              Opponent Score
            </label>
            <input
              id='opp_score'
              name='opp_score'
              type='number'
              min='0'
              value={formData.opp_score !== null ? formData.opp_score : ''}
              onChange={handleInputChange}
              className='form-input'
              placeholder='0'
            />
          </div>
        </div>

        <div className='form-group'>
          <label htmlFor='video_url' className='form-label'>
            Video URL
          </label>
          <input
            id='video_url'
            name='video_url'
            type='url'
            value={formData.video_url || ''}
            onChange={handleInputChange}
            className='form-input'
            placeholder='https://www.youtube.com/watch?v=... or https://example.com/video.mp4'
            required
          />
          <div className='form-help'>
            Paste a YouTube URL or direct link to an HTML5 video file (MP4, WebM, OGG, AVI, MOV).
          </div>
        </div>

        <div className='form-group'>
          <label htmlFor='notes' className='form-label'>
            Notes
          </label>
          <textarea
            id='notes'
            name='notes'
            value={formData.notes || ''}
            onChange={handleInputChange}
            className='form-textarea'
            placeholder='Game notes, key moments, etc.'
            rows={3}
          />
        </div>

        {validationMessage && (
          <div
            className={`form-message ${
              validationMessage.includes('Validating') || validationMessage.includes('Processing') ?
                'form-message-info' :
                'form-message-error'
            }`}
          >
            {validationMessage}
          </div>
        )}

        <div className='form-actions'>
          <button
            type='button'
            onClick={onCancel}
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
            {isSubmitting ? 'Saving...' : isEditing ? 'Update Game' : 'Create Game'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
