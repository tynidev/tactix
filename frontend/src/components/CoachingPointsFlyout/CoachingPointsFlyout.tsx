import React, { useState, useEffect, useCallback } from 'react';
import { getApiUrl } from '../../utils/api';
import type { Drawing } from '../../types/drawing';
import './CoachingPointsFlyout.css';

interface CoachingPoint {
  id: string;
  game_id: string;
  author_id: string;
  title: string;
  feedback: string;
  timestamp: string;
  audio_url: string;
  duration: number;
  created_at: string;
  author?: {
    id: string;
    name: string;
    email: string;
  };
}

interface CoachingPointEvent {
  id: string;
  point_id: string;
  event_type: 'play' | 'pause' | 'seek' | 'draw' | 'change_speed';
  timestamp: number;
  event_data: {
    drawings?: Drawing[];
    canvas_dimensions?: {
      width: number;
      height: number;
    };
  };
  created_at: string;
}

interface CoachingPointsFlyoutProps {
  gameId: string;
  onSeekToPoint: (timestamp: string) => void;
  onShowDrawings: (drawings: Drawing[]) => void;
  onPauseVideo: () => void;
}

export const CoachingPointsFlyout: React.FC<CoachingPointsFlyoutProps> = ({
  gameId,
  onSeekToPoint,
  onShowDrawings,
  onPauseVideo,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [coachingPoints, setCoachingPoints] = useState<CoachingPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadCoachingPoints = useCallback(async () => {
    setLoading(true);
    setError('');
    
    try {
      const token = (await import('../../lib/supabase')).supabase.auth.getSession();
      const session = await token;
      
      if (!session.data.session?.access_token) {
        throw new Error('No access token');
      }

      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/coaching-points/game/${gameId}`, {
        headers: {
          'Authorization': `Bearer ${session.data.session.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load coaching points');
      }

      const points = await response.json();
      // Sort points by timestamp in ascending order (earliest first)
      const sortedPoints = points.sort((a: CoachingPoint, b: CoachingPoint) => {
        return parseInt(a.timestamp) - parseInt(b.timestamp);
      });
      setCoachingPoints(sortedPoints);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load coaching points');
      console.error('Error loading coaching points:', err);
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  const loadDrawingEvents = useCallback(async (pointId: string) => {
    try {
      const token = (await import('../../lib/supabase')).supabase.auth.getSession();
      const session = await token;
      
      if (!session.data.session?.access_token) {
        return;
      }

      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/coaching-point-events/point/${pointId}`, {
        headers: {
          'Authorization': `Bearer ${session.data.session.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const events: CoachingPointEvent[] = await response.json();
        // Find drawing events with timestamp=0
        const drawingEvents = events.filter(event => 
          event.event_type === 'draw' && 
          event.timestamp === 0 && 
          event.event_data.drawings
        );
        
        if (drawingEvents.length > 0) {
          // Combine all drawings from timestamp=0 events
          const allDrawings = drawingEvents.flatMap(event => event.event_data.drawings || []);
          onShowDrawings(allDrawings);
        }
      }
    } catch (err) {
      console.error('Error loading drawing events:', err);
    }
  }, [onShowDrawings]);

  const handlePointClick = useCallback(async (point: CoachingPoint) => {
    // Pause the video first
    onPauseVideo();
    
    // Add a small delay to ensure the video is paused before seeking
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Seek to the timestamp
    onSeekToPoint(point.timestamp);
    
    // Load and show any drawings for this point
    await loadDrawingEvents(point.id);
    
    // Hide the flyout
    setIsExpanded(false);
  }, [onPauseVideo, onSeekToPoint, loadDrawingEvents]);

  const formatTimestamp = (timestamp: string): string => {
    const timestampNum = parseInt(timestamp);
    const date = new Date(timestampNum);
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  useEffect(() => {
    if (isExpanded && coachingPoints.length === 0) {
      loadCoachingPoints();
    }
  }, [isExpanded, coachingPoints.length, loadCoachingPoints]);

  return (
    <div className={`coaching-points-flyout ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <div className="flyout-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="header-content">
          <h3>Coaching Points ({coachingPoints.length})</h3>
          <button className="expand-button">
            {isExpanded ? '▼' : '▲'}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="flyout-content">
          {loading && (
            <div className="loading-state">
              <div className="loading-spinner">Loading coaching points...</div>
            </div>
          )}

          {error && (
            <div className="error-state">
              <p>{error}</p>
              <button onClick={loadCoachingPoints} className="btn btn-secondary btn-sm">
                Retry
              </button>
            </div>
          )}

          {!loading && !error && coachingPoints.length === 0 && (
            <div className="empty-state">
              <p>No coaching points have been created for this game yet.</p>
              <p>Pause the video and click "Add Coaching Point" to create one.</p>
            </div>
          )}

          {!loading && !error && coachingPoints.length > 0 && (
            <div className="coaching-points-list">
              {coachingPoints.map((point) => (
                <div
                  key={point.id}
                  className="coaching-point-item"
                  onClick={() => handlePointClick(point)}
                >
                  <div className="point-header">
                    <div className="point-timestamp">
                      {formatTimestamp(point.timestamp)}
                    </div>
                  </div>
                  
                  <div className="point-content">
                    <h4 className="point-title">{point.title}</h4>
                    <p className="point-feedback">{point.feedback}</p>
                  </div>
                  
                  <div className="point-footer">
                    <span className="point-author">
                      by {point.author?.name || 'Unknown'}
                    </span>
                    <div className="point-date">
                      {formatDate(point.created_at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
