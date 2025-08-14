import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { recordCoachingPointView, updateViewCompletion } from '../utils/api';

interface ViewEvent
{
  eventId: string;
  viewCount: number;
}

interface UseCoachingPointViewReturn
{
  recordView: (pointId: string, hasAudio: boolean) => Promise<ViewEvent | null>;
  updateCompletion: (percentage: number) => Promise<void>;
  viewEventId: string | null;
  isTracking: boolean;
  error: string | null;
}

/**
 * Custom hook for tracking coaching point views and completion
 */
export const useCoachingPointView = (): UseCoachingPointViewReturn =>
{
  const { user } = useAuth();
  const [viewEventId, setViewEventId] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs for debouncing
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdatePercentageRef = useRef<number>(0);

  /**
   * Record a new view for a coaching point
   */
  const recordView = useCallback(async (pointId: string, hasAudio: boolean): Promise<ViewEvent | null> =>
  {
    if (!user)
    {
      setError('User not authenticated');
      return null;
    }

    try
    {
      setError(null);
      setIsTracking(true);

      // For points without audio, record 100% completion immediately
      const completionPercentage = hasAudio ? 0 : 100;

      const response = await recordCoachingPointView(pointId, completionPercentage);

      setViewEventId(response.eventId);
      lastUpdatePercentageRef.current = completionPercentage;

      return {
        eventId: response.eventId,
        viewCount: response.viewCount,
      };
    }
    catch (err)
    {
      console.error('Failed to record view:', err);
      setError('Failed to record view');
      setIsTracking(false);
      return null;
    }
  }, [user]);

  /**
   * Update completion percentage for the current view event
   * Debounced to avoid excessive API calls
   */
  const updateCompletion = useCallback(async (percentage: number): Promise<void> =>
  {
    if (!viewEventId || !isTracking) return;

    // Round to nearest integer
    const roundedPercentage = Math.round(percentage);

    // Skip if percentage hasn't changed significantly (less than 5% difference)
    if (Math.abs(roundedPercentage - lastUpdatePercentageRef.current) < 5 && roundedPercentage < 100)
    {
      return;
    }

    // Clear existing timeout
    if (updateTimeoutRef.current)
    {
      clearTimeout(updateTimeoutRef.current);
    }

    // Debounce updates (500ms delay, immediate for 100%)
    const delay = roundedPercentage === 100 ? 0 : 500;

    updateTimeoutRef.current = setTimeout(async () =>
    {
      try
      {
        await updateViewCompletion(viewEventId, roundedPercentage);
        lastUpdatePercentageRef.current = roundedPercentage;

        // Stop tracking if we've reached 100%
        if (roundedPercentage === 100)
        {
          setIsTracking(false);
        }
      }
      catch (err)
      {
        console.error('Failed to update completion:', err);
        setError('Failed to update view progress');
      }
    }, delay);
  }, [viewEventId, isTracking]);

  // Cleanup on unmount
  useEffect(() =>
  {
    return () =>
    {
      if (updateTimeoutRef.current)
      {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  return {
    recordView,
    updateCompletion,
    viewEventId,
    isTracking,
    error,
  };
};
