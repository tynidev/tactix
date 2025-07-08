import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getApiUrl } from '../../utils/api';
import TransportControl from '../TransportControl/TransportControl';
import type { Drawing } from '../../types/drawing';
import './CoachingPointsFlyout.css';
import { supabase } from '../../lib/supabase';

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
  onSelectCoachingPoint: (point: CoachingPoint | null) => void;
  refreshTrigger?: number; // Optional prop to trigger refresh
  onExpandedChange?: (isExpanded: boolean) => void; // Callback to notify parent of expansion state
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
}

export const CoachingPointsFlyout = React.memo<CoachingPointsFlyoutProps>(
  ({
    gameId,
    onSeekToPoint,
    onShowDrawings,
    onPauseVideo,
    onSelectCoachingPoint,
    refreshTrigger,
    onExpandedChange,
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
  }) => {
    const { user } = useAuth();
    const [isExpanded, setIsExpanded] = useState(false);
    const [coachingPoints, setCoachingPoints] = useState<CoachingPoint[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Filter states
    const [titleFilter, setTitleFilter] = useState('');
    const [selectedPlayerFilter, setSelectedPlayerFilter] = useState('');
    const [selectedLabelFilter, setSelectedLabelFilter] = useState('');

    const loadCoachingPoints = useCallback(async () => {
      const abortController = new AbortController();

      setLoading(true);
      setError('');

      try {
        const session = await supabase.auth.getSession();

        if (!session.data.session?.access_token) {
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

        if (!response.ok) {
          throw new Error('Failed to load coaching points');
        }

        const points = await response.json();
        const sortedPoints = points.sort((a: CoachingPoint, b: CoachingPoint) => {
          return parseInt(a.timestamp) - parseInt(b.timestamp);
        });

        if (!abortController.signal.aborted) {
          setCoachingPoints(sortedPoints);
        }
      } catch (err) {
        if (!abortController.signal.aborted) {
          setError(err instanceof Error ? err.message : 'Failed to load coaching points');
          console.error('Error loading coaching points:', err);
        }
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }

      return () => abortController.abort();
    }, [gameId]);

    const loadDrawingEvents = useCallback(
      async (pointId: string) => {
        try {
          const session = await supabase.auth.getSession();

          if (!session.data.session?.access_token) {
            return;
          }

          const apiUrl = getApiUrl();
          const response = await fetch(`${apiUrl}/api/coaching-point-events/point/${pointId}`, {
            headers: {
              Authorization: `Bearer ${session.data.session.access_token}`,
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            const events: CoachingPointEvent[] = await response.json();
            // Find drawing events with timestamp=0
            const drawingEvents = events.filter((event) =>
              event.event_type === 'draw' && event.timestamp === 0 && event.event_data.drawings
            );

            if (drawingEvents.length > 0) {
              // Combine all drawings from timestamp=0 events
              const allDrawings = drawingEvents.flatMap((event) => event.event_data.drawings || []);
              onShowDrawings(allDrawings);
            }
          }
        } catch (err) {
          console.error('Error loading drawing events:', err);
        }
      },
      [onShowDrawings]
    );

    const handlePointClick = useCallback(
      async (point: CoachingPoint) => {
        // Pause the video first
        onPauseVideo();

        // Add a small delay to ensure the video is paused before seeking
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Seek to the timestamp
        onSeekToPoint(point.timestamp);

        // Load and show any drawings for this point
        await loadDrawingEvents(point.id);

        // Pass the selected coaching point to parent
        onSelectCoachingPoint(point);

        // Hide the flyout
        setIsExpanded(false);
      },
      [onPauseVideo, onSeekToPoint, loadDrawingEvents, onSelectCoachingPoint]
    );

    const handleDeletePoint = useCallback(
      async (pointId: string, event: React.MouseEvent) => {
        // Stop event propagation to prevent triggering the point click
        event.stopPropagation();

        if (
          !confirm(
            'Are you sure you want to delete this coaching point? This action cannot be undone.'
          )
        ) {
          return;
        }

        try {
          const session = await supabase.auth.getSession();

          if (!session.data.session?.access_token) {
            throw new Error('No access token');
          }

          const apiUrl = getApiUrl();
          const response = await fetch(`${apiUrl}/api/coaching-points/${pointId}`, {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${session.data.session.access_token}`,
              'Content-Type': 'application/json',
            },
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to delete coaching point');
          }

          // Remove the deleted point from the local state
          setCoachingPoints((prev) => prev.filter((point) => point.id !== pointId));
        } catch (err) {
          console.error('Error deleting coaching point:', err);
          alert(err instanceof Error ? err.message : 'Failed to delete coaching point');
        }
      },
      []
    );

    const canDeletePoint = useCallback(
      (point: CoachingPoint): boolean => {
        if (!user) return false;

        // User can delete if they are the author
        if (point.author_id === user.id) {
          return true;
        }

        // For coaches and admins, we'll show the button and let the backend handle the permission check
        // This is a reasonable approach since the delete operation will fail gracefully if unauthorized
        // We could make an additional API call to check roles, but that would be overkill for this feature
        return true; // Show delete button for all users, backend will enforce proper permissions
      },
      [user]
    );

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
        minute: '2-digit',
      });
    };

    // Get unique players and labels for filter options
    const getUniqueFilterOptions = useCallback(() => {
      const players = new Set<string>();
      const labels = new Set<string>();

      coachingPoints.forEach((point) => {
        point.coaching_point_tagged_players?.forEach((tp) => {
          players.add(tp.player_profiles.name);
        });
        point.coaching_point_labels?.forEach((label) => {
          labels.add(label.labels.name);
        });
      });

      return {
        players: Array.from(players).sort(),
        labels: Array.from(labels).sort(),
      };
    }, [coachingPoints]);

    // Memoize filter options
    useMemo(() => {
      const players = new Set<string>();
      const labels = new Set<string>();

      coachingPoints.forEach((point) => {
        point.coaching_point_tagged_players?.forEach((tp) => {
          players.add(tp.player_profiles.name);
        });
        point.coaching_point_labels?.forEach((label) => {
          labels.add(label.labels.name);
        });
      });

      return {
        players: Array.from(players).sort(),
        labels: Array.from(labels).sort(),
      };
    }, [coachingPoints]);

    // Memoize filtered results
    const filteredPoints = useMemo(() => {
      return coachingPoints.filter((point) => {
        // Title filter
        if (
          titleFilter &&
          !point.title.toLowerCase().includes(titleFilter.toLowerCase()) &&
          !point.feedback.toLowerCase().includes(titleFilter.toLowerCase())
        ) {
          return false;
        }

        // Player filter
        if (selectedPlayerFilter) {
          const hasPlayer = point.coaching_point_tagged_players?.some(
            (tp) => tp.player_profiles.name === selectedPlayerFilter
          );
          if (!hasPlayer) return false;
        }

        // Label filter
        if (selectedLabelFilter) {
          const hasLabel = point.coaching_point_labels?.some(
            (label) => label.labels.name === selectedLabelFilter
          );
          if (!hasLabel) return false;
        }

        return true;
      });
    }, [coachingPoints, titleFilter, selectedPlayerFilter, selectedLabelFilter]);

    // Filter coaching points based on active filters
    const filteredCoachingPoints = useCallback(() => {
      return filteredPoints;
    }, [filteredPoints]);

    // Clear all filters
    const clearFilters = useCallback(() => {
      setTitleFilter('');
      setSelectedPlayerFilter('');
      setSelectedLabelFilter('');
    }, []);

    // Check if any filters are active
    const hasActiveFilters = titleFilter || selectedPlayerFilter || selectedLabelFilter;

    useEffect(() => {
      if (isExpanded && coachingPoints.length === 0) {
        loadCoachingPoints();
      }
    }, [isExpanded, coachingPoints.length, loadCoachingPoints]);

    // Refresh coaching points when refreshTrigger changes
    useEffect(() => {
      if (refreshTrigger !== undefined) {
        loadCoachingPoints();
      }
    }, [refreshTrigger, loadCoachingPoints]);

    // Notify parent when expansion state changes
    useEffect(() => {
      if (onExpandedChange) {
        onExpandedChange(isExpanded);
      }
    }, [isExpanded, onExpandedChange]);

    return (
      <div className={`coaching-points-flyout ${isExpanded ? 'expanded' : 'collapsed'}`}>
        <div className="flyout-header">
          <div className="header-content">
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
            />

            <div className="header-right" onClick={() => setIsExpanded(!isExpanded)}>
              <h3>Coaching Points</h3>
              <button
                className="expand-button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
              >
                {isExpanded ? '▼' : '▲'}
              </button>
            </div>
          </div>
        </div>

        {isExpanded && (
          <div className="flyout-content">
            {/* Filter Section */}
            {coachingPoints.length > 0 && (
              <div className="filters-section">
                <div className="filters-grid">
                  {/* Title/Content Filter */}
                  <div className="filter-group">
                    <input
                      id="title-filter"
                      type="text"
                      value={titleFilter}
                      onChange={(e) => setTitleFilter(e.target.value)}
                      placeholder="Search in titles and feedback..."
                      className="filter-input"
                    />
                  </div>

                  {/* Player Filter */}
                  <div className="filter-group">
                    <select
                      id="player-filter"
                      value={selectedPlayerFilter}
                      onChange={(e) => setSelectedPlayerFilter(e.target.value)}
                      className="filter-select"
                    >
                      <option value="">All Players</option>
                      {getUniqueFilterOptions().players.map((player) => (
                        <option key={player} value={player}>
                          {player}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Label Filter */}
                  <div className="filter-group">
                    <select
                      id="label-filter"
                      value={selectedLabelFilter}
                      onChange={(e) => setSelectedLabelFilter(e.target.value)}
                      className="filter-select"
                    >
                      <option value="">All Labels</option>
                      {getUniqueFilterOptions().labels.map((label) => (
                        <option key={label} value={label}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Clear All Button */}
                  <div className="filter-group clear-filter-group">
                    {hasActiveFilters && (
                      <button onClick={clearFilters} className="clear-filters-btn">
                        Clear All
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

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

            {!loading && !error && coachingPoints.length > 0 && filteredCoachingPoints().length === 0 && (
              <div className="empty-state">
                <p>No coaching points match the current filters.</p>
                {hasActiveFilters && (
                  <button onClick={clearFilters} className="btn btn-secondary btn-sm">
                    Clear Filters
                  </button>
                )}
              </div>
            )}

            {!loading && !error && filteredCoachingPoints().length > 0 && (
              <div className="coaching-points-list">
                {filteredCoachingPoints().map((point) => (
                  <div
                    key={point.id}
                    className="coaching-point-item"
                    onClick={() => handlePointClick(point)}
                  >
                    {canDeletePoint(point) && (
                      <button
                        className="delete-point-btn"
                        onClick={(e) => handleDeletePoint(point.id, e)}
                        title="Delete coaching point"
                        aria-label="Delete coaching point"
                      >
                        ✕
                      </button>
                    )}
                    <div className="point-header">
                      <div className="point-timestamp">{formatTimestamp(point.timestamp)}</div>
                    </div>

                    <div className="point-content">
                      <h4 className="point-title">{point.title}</h4>
                      <p className="point-feedback">{point.feedback}</p>

                      {/* Combined Players and Labels Container */}
                      {((point.coaching_point_tagged_players && point.coaching_point_tagged_players.length > 0) ||
                        (point.coaching_point_labels && point.coaching_point_labels.length > 0)) && (
                        <div className="point-tags-container">
                          {/* Tagged Players */}
                          {point.coaching_point_tagged_players && point.coaching_point_tagged_players.length > 0 && (
                            <div className="point-tagged-players">
                              {point.coaching_point_tagged_players.map((taggedPlayer) => (
                                <span key={taggedPlayer.id} className="player-tag">
                                  {taggedPlayer.player_profiles.name}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Labels */}
                          {point.coaching_point_labels && point.coaching_point_labels.length > 0 && (
                            <div className="point-labels">
                              {point.coaching_point_labels.map((labelAssignment) => (
                                <span key={labelAssignment.id} className="label-tag">
                                  {labelAssignment.labels.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="point-footer">
                      <span className="point-author">by {point.author?.name || 'Unknown'}</span>
                      <div className="point-date">{formatDate(point.created_at)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
);
