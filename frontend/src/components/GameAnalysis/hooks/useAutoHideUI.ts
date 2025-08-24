import { useCallback, useEffect, useRef, useState } from 'react';
import { CURSOR_HIDE_MS, FLYOUT_GRACE_MS, UI_HIDE_MS } from '../constants/ui';

const ACTIVITY_EVENTS: (keyof DocumentEventMap)[] = [
  'mousedown',
  'mousemove',
  'keydown',
  'scroll',
  'touchstart',
  'click',
];

export interface UseAutoHideUIReturn
{
  areBothUIElementsVisible: boolean;
  isCursorVisible: boolean;
  startInactivityTimer: () => void;
  triggerUserActivity: () => void;
  applyImmediateHideWithGrace: () => void;
}

export function useAutoHideUI(): UseAutoHideUIReturn
{
  const [areBothUIElementsVisible, setAreBothUIElementsVisible] = useState(true);
  const [isCursorVisible, setIsCursorVisible] = useState(true);

  const inactivityTimerRef = useRef<number | null>(null);
  const gracePeriodTimerRef = useRef<number | null>(null);
  const cursorTimerRef = useRef<number | null>(null);

  const clearTimers = useCallback(() =>
  {
    if (inactivityTimerRef.current)
    {
      window.clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    if (cursorTimerRef.current)
    {
      window.clearTimeout(cursorTimerRef.current);
      cursorTimerRef.current = null;
    }
    if (gracePeriodTimerRef.current)
    {
      window.clearTimeout(gracePeriodTimerRef.current);
      gracePeriodTimerRef.current = null;
    }
  }, []);

  const isDisabled = (ms: number | null) => ms === null || ms === Number.POSITIVE_INFINITY || ms === Infinity;

  const startInactivityTimer = useCallback(() =>
  {
    clearTimers();

    // Cursor timer (only if enabled)
    if (!isDisabled(CURSOR_HIDE_MS))
    {
      cursorTimerRef.current = window.setTimeout(() =>
      {
        setIsCursorVisible(false);
      }, CURSOR_HIDE_MS as number);
    }

    // UI timer (only if enabled)
    if (!isDisabled(UI_HIDE_MS))
    {
      inactivityTimerRef.current = window.setTimeout(() =>
      {
        setAreBothUIElementsVisible(false);
      }, UI_HIDE_MS as number);
    }
  }, [clearTimers]);

  const triggerUserActivity = useCallback(() =>
  {
    setAreBothUIElementsVisible(true);
    setIsCursorVisible(true);

    if (gracePeriodTimerRef.current)
    {
      window.clearTimeout(gracePeriodTimerRef.current);
      gracePeriodTimerRef.current = null;
    }

    startInactivityTimer();
  }, [startInactivityTimer]);

  const applyImmediateHideWithGrace = useCallback(() =>
  {
    // If either feature is disabled, respect that and avoid hiding that element
    if (!isDisabled(UI_HIDE_MS))
    {
      setAreBothUIElementsVisible(false);
    }
    if (!isDisabled(CURSOR_HIDE_MS))
    {
      setIsCursorVisible(false);
    }

    // Clear timers and start a grace period
    clearTimers();

    gracePeriodTimerRef.current = window.setTimeout(() =>
    {
      // End grace period; normal activity detection resumes with next activity
      gracePeriodTimerRef.current = null;
    }, FLYOUT_GRACE_MS);
  }, [clearTimers]);

  useEffect(() =>
  {
    const handler = () => triggerUserActivity();

    ACTIVITY_EVENTS.forEach((event) =>
    {
      document.addEventListener(event, handler, { passive: true } as AddEventListenerOptions);
    });

    // kick off timers initially (only schedule those enabled)
    startInactivityTimer();

    return () =>
    {
      ACTIVITY_EVENTS.forEach((event) =>
      {
        document.removeEventListener(event, handler as EventListener);
      });
      clearTimers();
    };
  }, [startInactivityTimer, triggerUserActivity, clearTimers]);

  return {
    areBothUIElementsVisible,
    isCursorVisible,
    startInactivityTimer,
    triggerUserActivity,
    applyImmediateHideWithGrace,
  };
}
