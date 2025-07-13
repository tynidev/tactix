import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FaCircle, FaPlus } from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';
import type { Drawing } from '../../types/drawing';
import { getApiUrl } from '../../utils/api';
import { ConfirmationDialog } from '../ConfirmationDialog';
import TransportControl from '../TransportControl/TransportControl';
import './CoachingPointsFlyout.css';
import { supabase } from '../../lib/supabase';

interface CoachingPoint
{
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
  coaching_point_tagged_players?: {
    id: string;
    player_profiles: {
      id: string;
      name: string;
      jersey_number: string;
    };
  }[];
  coaching_point_labels?: {
    id: string;
    labels: {
      id: string;
      name: string;
    };
  }[];
}

interface CoachingPointEvent
{
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

interface CoachingPointsFlyoutProps
{
  gameId: string;
  userRole?: 'coach' | 'player' | 'admin' | 'guardian';
  onSeekToPoint: (timestamp: string) => void;
  onShowDrawings: (drawings: Drawing[]) => void;
  onPauseVideo: () => void;
  onSelectCoachingPoint: (point: CoachingPoint | null) => void;
  refreshTrigger?: number; // Optional prop to trigger refresh
  onExpandedChange?: (isExpanded: boolean) => void; // Callback to notify parent of expansion state
  // Unified auto-hide system
  isVisible: boolean; // Controlled by parent GameAnalysis component
  // Transport control props
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  currentPlaybackRate: number;
  onTogglePlayPause: () => void;
  onSeek: (seconds: number) => void;
  onSeekTo: (time: number) => void;
  onPlaybackRateChange: (rate: number) => void;
  isCoachingPointPlaybackActive?: boolean; // Disable transport controls during coaching point playback
  // Fullscreen props
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  // Analysis control props
  onCreateCoachingPoint: () => void;
  onToggleRecording: () => void;
  isRecording: boolean;
  isReady: boolean;
  audioRecording: {
    recordingTime: number;
    error: string | null;
  };
}

export const CoachingPointsFlyout = React.memo<CoachingPointsFlyoutProps>(
  ({
    gameId,
    userRole,
    onSeekToPoint,
    onShowDrawings,
    onPauseVideo,
    onSelectCoachingPoint,
    refreshTrigger,
    onExpandedChange,
    // Unified auto-hide system
    isVisible,
    // Transport control props
    isPlaying,
    currentTime,
    duration,
    currentPlaybackRate,
    onTogglePlayPause,
    onSeek,
    onSeekTo,
    onPlaybackRateChange,
    isCoachingPointPlaybackActive = false,
    // Fullscreen props
    isFullscreen = false,
    onToggleFullscreen,
    // Analysis control props
    onCreateCoachingPoint,
    onToggleRecording,
    isRecording,
    isReady,
    audioRecording,
  }) =>
  {
    const { user } = useAuth();
    const [isExpanded, setIsExpanded] = useState(false);
    const [coachingPoints, setCoachingPoints] = useState<CoachingPoint[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Filter states
    const [titleFilter, setTitleFilter] = useState('');
    const [selectedPlayerFilter, setSelectedPlayerFilter] = useState('');
    const [selectedLabelFilter, setSelectedLabelFilter] = useState('');

    // Delete confirmation state
    const [deleteConfirmation, setDeleteConfirmation] = useState<{
      isOpen: boolean;
      pointId: string | null;
      pointTitle: string;
      loading: boolean;
    }>({
      isOpen: false,
      pointId: null,
      pointTitle: '',
      loading: false,
    });

    // Touch handling state
    const [touchState, setTouchState] = useState<{
      startX: number;
      startY: number;
      startTime: number;
      hasMoved: boolean;
    } | null>(null);

    const flyoutRef = useRef<HTMLDivElement>(null);

    const loadCoachingPoints = useCallback(async () =>
    {
      const abortController = new AbortController();

      setLoading(true);
      setError('');

      try
      {
        const session = await supabase.auth.getSession();

        if (!session.data.session?.access_token)
        {
          throw new Error('No access token');
        }

        const apiUrl = getApiUrl();
        const response = await fetch(`${apiUrl}/api/coaching-points/game/${gameId}`, {
          headers: {
            Authorization: `Bearer ${session.data.session.access_token}`,
            'Content-Type': 'application/json',
          },
          signal: abortController.signal,
        });

        if (!response.ok)
        {
          throw new Error('Failed to load coaching points');
        }

        const points = await response.json();
        const sortedPoints = points.sort((a: CoachingPoint, b: CoachingPoint) =>
        {
          return parseInt(a.timestamp) - parseInt(b.timestamp);
        });

        if (!abortController.signal.aborted)
        {
          setCoachingPoints(sortedPoints);
        }
      }
      catch (err)
      {
        if (!abortController.signal.aborted)
        {
          setError(err instanceof Error ? err.message : 'Failed to load coaching points');
          console.error('Error loading coaching points:', err);
        }
      }
      finally
      {
        if (!abortController.signal.aborted)
        {
          setLoading(false);
        }
      }

      return () => abortController.abort();
    }, [gameId]);

    const loadDrawingEvents = useCallback(
      async (pointId: string) =>
      {
        try
        {
          const session = await supabase.auth.getSession();

          if (!session.data.session?.access_token)
          {
            return;
          }

          const apiUrl = getApiUrl();
          const response = await fetch(`${apiUrl}/api/coaching-point-events/point/${pointId}`, {
            headers: {
              Authorization: `Bearer ${session.data.session.access_token}`,
              'Content-Type': 'application/json',
            },
          });

          if (response.ok)
          {
            const events: CoachingPointEvent[] = await response.json();
            // Find drawing events with timestamp=0
            const drawingEvents = events.filter((event) =>
              event.event_type === 'draw' && event.timestamp === 0 && event.event_data.drawings
            );

            if (drawingEvents.length > 0)
            {
              // Combine all drawings from timestamp=0 events
              const allDrawings = drawingEvents.flatMap((event) => event.event_data.drawings || []);
              onShowDrawings(allDrawings);
            }
            else
            {
              // Clear the canvas if no drawings exist for this coaching point
              onShowDrawings([]);
            }
          }
        }
        catch (err)
        {
          console.error('Error loading drawing events:', err);
        }
      },
      [onShowDrawings],
    );

    const handlePointClick = useCallback(
      async (point: CoachingPoint) =>
      {
        // FIRST: Stop any current playback and set the new coaching point
        // This ensures playback is stopped immediately before any video operations
        onSelectCoachingPoint(point);

        // Pause the video
        onPauseVideo();

        // Add a small delay to ensure the video is paused before seeking
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Seek to the timestamp
        onSeekToPoint(point.timestamp);

        // Load and show any drawings for this point
        await loadDrawingEvents(point.id);

        // Hide the flyout
        setIsExpanded(false);
      },
      [onPauseVideo, onSeekToPoint, loadDrawingEvents, onSelectCoachingPoint],
    );

    // Touch event handlers for mobile devices
    const handleTouchStart = useCallback((point: CoachingPoint, event: React.TouchEvent) => {
      const touch = event.touches[0];
      setTouchState({
        startX: touch.clientX,
        startY: touch.clientY,
        startTime: Date.now(),
        hasMoved: false,
      });
    }, []);

    const handleTouchMove = useCallback((event: React.TouchEvent) => {
      if (!touchState) return;

      const touch = event.touches[0];
      const deltaX = Math.abs(touch.clientX - touchState.startX);
      const deltaY = Math.abs(touch.clientY - touchState.startY);
      
      // Consider it a move if finger moved more than 10 pixels in any direction
      if (deltaX > 10 || deltaY > 10) {
        setTouchState(prev => prev ? { ...prev, hasMoved: true } : null);
      }
    }, [touchState]);

    const handleTouchEnd = useCallback((point: CoachingPoint, event: React.TouchEvent) => {
      if (!touchState) return;

      const touchDuration = Date.now() - touchState.startTime;
      
      // Only treat as a tap if:
      // 1. Touch duration is less than 500ms (not a long press)
      // 2. Finger didn't move significantly (not a scroll)
      if (touchDuration < 500 && !touchState.hasMoved) {
        // Prevent the subsequent click event
        event.preventDefault();
        event.stopPropagation();
        
        // Handle the point click
        handlePointClick(point);
      }

      setTouchState(null);
    }, [touchState, handlePointClick]);

    const handleDeletePoint = useCallback(
      (pointId: string, event: React.MouseEvent | React.TouchEvent) =>
      {
        // Stop event propagation to prevent triggering the point click
        event.stopPropagation();
        event.preventDefault();

        const point = coachingPoints.find(p => p.id === pointId);
        const pointTitle = point?.title || 'this coaching point';

        setDeleteConfirmation({
          isOpen: true,
          pointId,
          pointTitle,
          loading: false,
        });
      },
      [coachingPoints],
    );

    const handleDeleteConfirmationClose = () =>
    {
      setDeleteConfirmation({
        isOpen: false,
        pointId: null,
        pointTitle: '',
        loading: false,
      });
    };

    const handleDeleteConfirmationConfirm = async () =>
    {
      if (!deleteConfirmation.pointId) return;

      setDeleteConfirmation(prev => ({ ...prev, loading: true }));

      try
      {
        const session = await supabase.auth.getSession();

        if (!session.data.session?.access_token)
        {
          throw new Error('No access token');
        }

        const apiUrl = getApiUrl();
        const response = await fetch(`${apiUrl}/api/coaching-points/${deleteConfirmation.pointId}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${session.data.session.access_token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok)
        {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to delete coaching point');
        }

        // Remove the deleted point from the local state
        setCoachingPoints((prev) => prev.filter((point) => point.id !== deleteConfirmation.pointId));

        // Close confirmation dialog
        handleDeleteConfirmationClose();
      }
      catch (err)
      {
        setDeleteConfirmation(prev => ({ ...prev, loading: false }));
        console.error('Error deleting coaching point:', err);
        alert(err instanceof Error ? err.message : 'Failed to delete coaching point');
      }
    };

    const canDeletePoint = useCallback(
      (point: CoachingPoint): boolean =>
      {
        if (!user) return false;

        // User can delete if they are the author (regardless of role)
        if (point.author_id === user.id)
        {
          return true;
        }

        // Only coaches can delete any coaching point
        if (userRole === 'coach')
        {
          return true;
        }

        // Players, admins, and guardians cannot delete points they didn't create
        return false;
      },
      [user, userRole],
    );

    const formatTimestamp = (timestamp: string): string =>
    {
      const timestampNum = parseInt(timestamp);
      const date = new Date(timestampNum);
      const hours = String(date.getUTCHours()).padStart(2, '0');
      const minutes = String(date.getUTCMinutes()).padStart(2, '0');
      const seconds = String(date.getUTCSeconds()).padStart(2, '0');
      return `${hours}:${minutes}:${seconds}`;
    };

    const formatDate = (dateString: string): string =>
    {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    };

    // Get unique players and labels for filter options
    const getUniqueFilterOptions = useCallback(() =>
    {
      const players = new Set<string>();
      const labels = new Set<string>();

      coachingPoints.forEach((point) =>
      {
        point.coaching_point_tagged_players?.forEach((tp) =>
        {
          players.add(tp.player_profiles.name);
        });
        point.coaching_point_labels?.forEach((label) =>
        {
          labels.add(label.labels.name);
        });
      });

      return {
        players: Array.from(players).sort(),
        labels: Array.from(labels).sort(),
      };
    }, [coachingPoints]);

    // Memoize filter options
    useMemo(() =>
    {
      const players = new Set<string>();
      const labels = new Set<string>();

      coachingPoints.forEach((point) =>
      {
        point.coaching_point_tagged_players?.forEach((tp) =>
        {
          players.add(tp.player_profiles.name);
        });
        point.coaching_point_labels?.forEach((label) =>
        {
          labels.add(label.labels.name);
        });
      });

      return {
        players: Array.from(players).sort(),
        labels: Array.from(labels).sort(),
      };
    }, [coachingPoints]);

    // Memoize filtered results
    const filteredPoints = useMemo(() =>
    {
      return coachingPoints.filter((point) =>
      {
        // Title filter
        if (
          titleFilter &&
          !point.title.toLowerCase().includes(titleFilter.toLowerCase()) &&
          !point.feedback.toLowerCase().includes(titleFilter.toLowerCase())
        )
        {
          return false;
        }

        // Player filter
        if (selectedPlayerFilter)
        {
          const hasPlayer = point.coaching_point_tagged_players?.some(
            (tp) => tp.player_profiles.name === selectedPlayerFilter,
          );
          if (!hasPlayer) return false;
        }

        // Label filter
        if (selectedLabelFilter)
        {
          const hasLabel = point.coaching_point_labels?.some(
            (label) => label.labels.name === selectedLabelFilter,
          );
          if (!hasLabel) return false;
        }

        return true;
      });
    }, [coachingPoints, titleFilter, selectedPlayerFilter, selectedLabelFilter]);

    // Filter coaching points based on active filters
    const filteredCoachingPoints = useCallback(() =>
    {
      return filteredPoints;
    }, [filteredPoints]);

    // Clear all filters
    const clearFilters = useCallback(() =>
    {
      setTitleFilter('');
      setSelectedPlayerFilter('');
      setSelectedLabelFilter('');
    }, []);

    // Check if any filters are active
    const hasActiveFilters = titleFilter || selectedPlayerFilter || selectedLabelFilter;

    // Check if user can create coaching points (coaches only)
    const canCreateCoachingPoints = useCallback(() =>
    {
      return userRole === 'coach';
    }, [userRole]);

    // Simple toggle for expansion
    const toggleExpanded = useCallback(() =>
    {
      setIsExpanded(!isExpanded);
    }, [isExpanded]);

    useEffect(() =>
    {
      if (isExpanded && coachingPoints.length === 0)
      {
        loadCoachingPoints();
      }
    }, [isExpanded, coachingPoints.length, loadCoachingPoints]);

    // Refresh coaching points when refreshTrigger changes
    useEffect(() =>
    {
      if (refreshTrigger !== undefined)
      {
        loadCoachingPoints();
      }
    }, [refreshTrigger, loadCoachingPoints]);

    // Notify parent when expansion state changes
    useEffect(() =>
    {
      if (onExpandedChange)
      {
        onExpandedChange(isExpanded);
      }
    }, [isExpanded, onExpandedChange]);

    // Don't render the flyout at all when it's hidden
    if (!isVisible)
    {
      return null;
    }

    return (
      <div
        ref={flyoutRef}
        className={`coaching-points-flyout ${isExpanded ? 'expanded' : 'collapsed'}`}
      >
        <div className='flyout-header'>
          <div className='header-content'>
            <TransportControl
              isPlaying={isPlaying}
              currentTime={currentTime}
              duration={duration}
              currentPlaybackRate={currentPlaybackRate}
              onTogglePlayPause={onTogglePlayPause}
              onSeek={onSeek}
              onSeekTo={onSeekTo}
              onPlaybackRateChange={onPlaybackRateChange}
              disabled={isCoachingPointPlaybackActive}
              isFullscreen={isFullscreen}
              onToggleFullscreen={onToggleFullscreen}
            />

            {/* Analysis Controls - Only show for coaches and admins */}
            {canCreateCoachingPoints() && (
              <div className='analysis-controls'>
                <button
                  className='analysis-btn'
                  onClick={(e) =>
                  {
                    e.stopPropagation();
                    onCreateCoachingPoint();
                  }}
                  disabled={!isReady || isPlaying}
                  title={isPlaying ? 'Pause video to add coaching point' : 'Add coaching point'}
                >
                  <FaPlus />
                </button>
                <button
                  className={`analysis-btn ${isRecording ? 'recording' : ''}`}
                  onClick={(e) =>
                  {
                    e.stopPropagation();
                    onToggleRecording();
                  }}
                  disabled={!isReady || isPlaying}
                  title={isPlaying ? 'Pause video to record' : (isRecording ? 'Stop recording' : 'Start recording')}
                >
                  <FaCircle />
                  {isRecording && audioRecording.recordingTime > 0 && (
                    <span className='recording-time'>
                      {Math.floor(audioRecording.recordingTime / 1000 / 60)}:
                      {Math.floor((audioRecording.recordingTime / 1000) % 60).toString().padStart(2, '0')}
                    </span>
                  )}
                </button>
              </div>
            )}

            <div className='header-right' onClick={toggleExpanded}>
              <h3>Coaching Points</h3>
              <button
                className='expand-button'
                onClick={(e) =>
                {
                  e.stopPropagation();
                  toggleExpanded();
                }}
              >
                {isExpanded ? '▼' : '▲'}
              </button>
            </div>
          </div>
        </div>

        {isExpanded && (
          <div className='flyout-content'>
            {/* Filter Section */}
            {coachingPoints.length > 0 && (
              <div className='filters-section'>
                <div className='filters-grid'>
                  {/* Title/Content Filter */}
                  <div className='filter-group'>
                    <input
                      id='title-filter'
                      type='text'
                      value={titleFilter}
                      onChange={(e) => setTitleFilter(e.target.value)}
                      placeholder='Search in titles and feedback...'
                      className='filter-input'
                    />
                  </div>

                  {/* Player Filter */}
                  <div className='filter-group'>
                    <select
                      id='player-filter'
                      value={selectedPlayerFilter}
                      onChange={(e) => setSelectedPlayerFilter(e.target.value)}
                      className='filter-select'
                    >
                      <option value=''>All Players</option>
                      {getUniqueFilterOptions().players.map((player) => (
                        <option key={player} value={player}>
                          {player}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Label Filter */}
                  <div className='filter-group'>
                    <select
                      id='label-filter'
                      value={selectedLabelFilter}
                      onChange={(e) => setSelectedLabelFilter(e.target.value)}
                      className='filter-select'
                    >
                      <option value=''>All Labels</option>
                      {getUniqueFilterOptions().labels.map((label) => (
                        <option key={label} value={label}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Clear All Button */}
                  <div className='filter-group clear-filter-group'>
                    {hasActiveFilters && (
                      <button onClick={clearFilters} className='clear-filters-btn'>
                        Clear All
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {loading && (
              <div className='loading-state'>
                <div className='loading-spinner'>Loading coaching points...</div>
              </div>
            )}

            {error && (
              <div className='error-state'>
                <p>{error}</p>
                <button onClick={loadCoachingPoints} className='btn btn-secondary btn-sm'>
                  Retry
                </button>
              </div>
            )}

            {!loading && !error && coachingPoints.length === 0 && (
              <div className='empty-state'>
                <p>No coaching points have been created for this game yet.</p>
                {canCreateCoachingPoints() ?
                  <p>Pause the video and click "Add Coaching Point" to create one.</p> :
                  <p>Coaching points can be created by coaches and team administrators.</p>}
              </div>
            )}

            {!loading && !error && coachingPoints.length > 0 && filteredCoachingPoints().length === 0 && (
              <div className='empty-state'>
                <p>No coaching points match the current filters.</p>
                {hasActiveFilters && (
                  <button onClick={clearFilters} className='btn btn-secondary btn-sm'>
                    Clear Filters
                  </button>
                )}
              </div>
            )}

            {!loading && !error && filteredCoachingPoints().length > 0 && (
              <div className='coaching-points-list'>
                {filteredCoachingPoints().map((point) => (
                  <div
                    key={point.id}
                    className='coaching-point-item'
                    onClick={() => handlePointClick(point)}
                    onTouchStart={(e) => handleTouchStart(point, e)}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={(e) => handleTouchEnd(point, e)}
                  >
                    {canDeletePoint(point) && (
                      <button
                        className='delete-point-btn'
                        onClick={(e) => handleDeletePoint(point.id, e)}
                        onTouchEnd={(e) => handleDeletePoint(point.id, e)}
                        title='Delete coaching point'
                        aria-label='Delete coaching point'
                      >
                        ✕
                      </button>
                    )}
                    <div className='point-header'>
                      <div className='point-timestamp'>{formatTimestamp(point.timestamp)}</div>
                    </div>

                    <div className='point-content'>
                      <h4 className='point-title'>{point.title}</h4>
                      <p className='point-feedback'>{point.feedback}</p>

                      {/* Combined Players and Labels Container */}
                      {((point.coaching_point_tagged_players && point.coaching_point_tagged_players.length > 0) ||
                        (point.coaching_point_labels && point.coaching_point_labels.length > 0)) && (
                        <div className='point-tags-container'>
                          {/* Tagged Players */}
                          {point.coaching_point_tagged_players && point.coaching_point_tagged_players.length > 0 && (
                            <div className='point-tagged-players'>
                              {point.coaching_point_tagged_players.map((taggedPlayer) => (
                                <span key={taggedPlayer.id} className='player-tag'>
                                  {taggedPlayer.player_profiles.name}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Labels */}
                          {point.coaching_point_labels && point.coaching_point_labels.length > 0 && (
                            <div className='point-labels'>
                              {point.coaching_point_labels.map((labelAssignment) => (
                                <span key={labelAssignment.id} className='label-tag'>
                                  {labelAssignment.labels.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className='point-footer'>
                      <span className='point-author'>by {point.author?.name || 'Unknown'}</span>
                      <div className='point-date'>{formatDate(point.created_at)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <ConfirmationDialog
          isOpen={deleteConfirmation.isOpen}
          onClose={handleDeleteConfirmationClose}
          onConfirm={handleDeleteConfirmationConfirm}
          title='Delete Coaching Point'
          message={`Are you sure you want to delete "${deleteConfirmation.pointTitle}"? This action cannot be undone.`}
          confirmButtonText='Delete Coaching Point'
          variant='danger'
          loading={deleteConfirmation.loading}
        />
      </div>
    );
  },
);
