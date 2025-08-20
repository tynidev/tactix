import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FaBackward, FaCompress, FaExpand, FaForward, FaPause, FaPlay } from 'react-icons/fa';
import { MdLock } from 'react-icons/md';
import { CONFIG } from '../../types/config';
import './TransportControl.css';

interface TransportControlProps
{
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  currentPlaybackRate: number;
  onTogglePlayPause: () => void;
  onSeek: (seconds: number) => void;
  onSeekTo: (time: number) => void;
  onPlaybackRateChange: (rate: number) => void;
  disabled?: boolean; // Disable all transport controls
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

const TransportControl: React.FC<TransportControlProps> = ({
  isPlaying,
  currentTime,
  duration,
  currentPlaybackRate,
  onTogglePlayPause,
  onSeek,
  onSeekTo,
  onPlaybackRateChange,
  disabled = false,
  isFullscreen = false,
  onToggleFullscreen,
}) =>
{
  const [isDragging, setIsDragging] = useState(false);
  const [dragTime, setDragTime] = useState(0);
  const [isSeekingFromClick, setIsSeekingFromClick] = useState(false);
  const [lastSeekTime, setLastSeekTime] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const [hoverTime, setHoverTime] = useState(0);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const timelineRef = useRef<HTMLDivElement>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Store the drag time in a ref to avoid stale closures
  const dragTimeRef = useRef(dragTime);
  dragTimeRef.current = dragTime;

  const formatTime = useCallback((seconds: number): string =>
  {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const calculateTimeFromPosition = useCallback((clientX: number): number =>
  {
    if (!timelineRef.current || duration === 0) return 0;

    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    return percentage * duration;
  }, [duration]);

  const handleTimelineClick = useCallback((e: React.MouseEvent) =>
  {
    if (disabled || isDragging || duration === 0) return;

    const newTime = calculateTimeFromPosition(e.clientX);

    // Batch state updates
    setIsSeekingFromClick(true);
    setLastSeekTime(newTime);
    setDragTime(newTime);

    onSeekTo(newTime);
  }, [disabled, isDragging, duration, calculateTimeFromPosition, onSeekTo]);

  const handleMouseDown = useCallback((e: React.MouseEvent) =>
  {
    if (disabled || duration === 0) return;

    const newTime = calculateTimeFromPosition(e.clientX);

    setDragTime(newTime);
    setIsDragging(true);

    e.preventDefault();
  }, [disabled, duration, calculateTimeFromPosition]);

  const handleMouseUp = useCallback(() =>
  {
    if (isDragging && duration > 0)
    {
      const seekTime = Math.max(0, Math.min(duration, dragTimeRef.current));

      // Batch state updates
      setIsSeekingFromClick(true);
      setLastSeekTime(seekTime);
      setIsDragging(false);

      onSeekTo(seekTime);
    }
  }, [isDragging, duration, onSeekTo]);

  const handleGlobalMouseMove = useCallback((e: MouseEvent) =>
  {
    if (isDragging && duration > 0)
    {
      const newTime = calculateTimeFromPosition(e.clientX);

      // Clear previous debounce timeout
      if (debounceTimeoutRef.current)
      {
        clearTimeout(debounceTimeoutRef.current);
      }

      // Update dragTime immediately for smooth visual feedback
      setDragTime(newTime);

      // Debounce expensive operations or additional updates
      debounceTimeoutRef.current = setTimeout(() =>
      {
        // Any additional operations that should be debounced can go here
        // For now, we just ensure the dragTimeRef is updated
        dragTimeRef.current = newTime;
      }, 16); // ~60fps
    }
  }, [isDragging, duration, calculateTimeFromPosition]);

  // Handle timeline hover for tooltip
  const handleTimelineMouseMove = useCallback((e: React.MouseEvent) =>
  {
    if (disabled || duration === 0) return;

    const newTime = calculateTimeFromPosition(e.clientX);
    const rect = timelineRef.current?.getBoundingClientRect();

    if (rect)
    {
      setHoverTime(newTime);
      setTooltipPosition({
        x: e.clientX,
        y: -30, // Position tooltip above the timeline
      });
    }
  }, [disabled, duration, calculateTimeFromPosition]);

  const handleTimelineMouseEnter = useCallback(() =>
  {
    if (!disabled && duration > 0)
    {
      setIsHovering(true);
    }
  }, [disabled, duration]);

  const handleTimelineMouseLeave = useCallback(() =>
  {
    setIsHovering(false);
  }, []);

  // Handle global mouse events for dragging
  useEffect(() =>
  {
    if (isDragging)
    {
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('mousemove', handleGlobalMouseMove);

      // Prevent text selection while dragging
      document.body.style.userSelect = 'none';

      return () =>
      {
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('mousemove', handleGlobalMouseMove);
        document.body.style.userSelect = '';

        // Clear any pending debounce timeout
        if (debounceTimeoutRef.current)
        {
          clearTimeout(debounceTimeoutRef.current);
          debounceTimeoutRef.current = null;
        }
      };
    }
  }, [isDragging, handleMouseUp, handleGlobalMouseMove]);

  // Update dragTime when currentTime changes
  useEffect(() =>
  {
    if (!isDragging && !isSeekingFromClick)
    {
      setDragTime(currentTime);
    }
  }, [currentTime, isDragging, isSeekingFromClick]);

  // Handle seek completion detection
  useEffect(() =>
  {
    if (isSeekingFromClick && Math.abs(currentTime - lastSeekTime) < 0.5)
    {
      setIsSeekingFromClick(false);
    }
  }, [currentTime, isSeekingFromClick, lastSeekTime]);

  // Cleanup debounce timeout on unmount
  useEffect(() =>
  {
    return () =>
    {
      if (debounceTimeoutRef.current)
      {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  // Memoize computed values
  const displayTime = useMemo(() => (isDragging || isSeekingFromClick) ? dragTime : currentTime, [
    isDragging,
    isSeekingFromClick,
    dragTime,
    currentTime,
  ]);

  const progressPercentage = useMemo(() => duration > 0 ? (displayTime / duration) * 100 : 0, [displayTime, duration]);

  // Memoize button click handlers
  const handleRewind = useCallback(() => onSeek(-CONFIG.video.seekAmount), [onSeek]);
  const handleForward = useCallback(() => onSeek(CONFIG.video.seekAmount), [onSeek]);

  const handleVerySlowSpeed = useCallback(() => onPlaybackRateChange(CONFIG.video.playbackRates.verySlow), [
    onPlaybackRateChange,
  ]);
  const handleSlowSpeed = useCallback(() => onPlaybackRateChange(CONFIG.video.playbackRates.slow), [
    onPlaybackRateChange,
  ]);
  const handleNormalSpeed = useCallback(() => onPlaybackRateChange(CONFIG.video.playbackRates.normal), [
    onPlaybackRateChange,
  ]);
  const handleFastSpeed = useCallback(() => onPlaybackRateChange(CONFIG.video.playbackRates.fast), [
    onPlaybackRateChange,
  ]);

  return (
    <div className={`transport-control ${disabled ? 'disabled' : ''}`}>
      <div className='transport-main'>
        {/* Transport Controls - Left */}
        <div className='transport-buttons'>
          <button
            className='transport-btn'
            onClick={handleRewind}
            disabled={disabled}
            title={disabled ? 'Transport controls disabled during coaching point playback' : 'Rewind (A/←)'}
          >
            <FaBackward size={15} />
          </button>
          <button
            className='transport-btn play-pause'
            onClick={onTogglePlayPause}
            disabled={disabled}
            title={disabled ? 'Transport controls disabled during coaching point playback' : 'Play/Pause (S/Space)'}
          >
            {isPlaying ? <FaPause size={15} /> : <FaPlay size={15} />}
          </button>
          <button
            className='transport-btn'
            onClick={handleForward}
            disabled={disabled}
            title={disabled ? 'Transport controls disabled during coaching point playback' : 'Forward (D/→)'}
          >
            <FaForward size={15} />
          </button>
        </div>

        {/* Timeline - Center */}
        <div className='timeline-container'>
          <span className='time-display'>{formatTime(displayTime)}</span>
          <div
            ref={timelineRef}
            className={`timeline ${disabled ? 'disabled' : ''}`}
            onClick={disabled ? undefined : handleTimelineClick}
            onMouseDown={disabled ? undefined : handleMouseDown}
            onMouseMove={disabled ? undefined : handleTimelineMouseMove}
            onMouseEnter={disabled ? undefined : handleTimelineMouseEnter}
            onMouseLeave={disabled ? undefined : handleTimelineMouseLeave}
            role='slider'
            aria-label='Video timeline'
            aria-valuemin={0}
            aria-valuemax={duration}
            aria-valuenow={displayTime}
            tabIndex={disabled ? -1 : 0}
            style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
          >
            <div className='timeline-track'>
              <div
                className='timeline-progress'
                style={{ width: `${progressPercentage}%` }}
              />
              <div
                className='timeline-playhead'
                style={{ left: `${progressPercentage}%` }}
              />
            </div>
            {disabled && (
              <div className='timeline-locked-icon'>
                <MdLock />
              </div>
            )}
            {isHovering && !disabled && !isDragging && (
              <div
                className='timeline-tooltip'
                style={{
                  left: `${tooltipPosition.x}px`,
                  top: `${tooltipPosition.y}px`,
                }}
              >
                {formatTime(hoverTime)}
              </div>
            )}
          </div>
          <span className='time-display'>{formatTime(duration)}</span>
        </div>

        {/* Speed Controls - Right */}
        <div className='speed-controls'>
          <button
            className={`speed-btn ${currentPlaybackRate === CONFIG.video.playbackRates.verySlow ? 'active' : ''}`}
            onClick={handleVerySlowSpeed}
            disabled={disabled}
            title={disabled ? 'Transport controls disabled during coaching point playback' : '0.25x Speed - Very Slow'}
          >
            ¼
          </button>
          <button
            className={`speed-btn ${currentPlaybackRate === CONFIG.video.playbackRates.slow ? 'active' : ''}`}
            onClick={handleSlowSpeed}
            disabled={disabled}
            title={disabled ? 'Transport controls disabled during coaching point playback' : '0.5x Speed - Slow'}
          >
            ½
          </button>
          <button
            className={`speed-btn ${currentPlaybackRate === CONFIG.video.playbackRates.normal ? 'active' : ''}`}
            onClick={handleNormalSpeed}
            disabled={disabled}
            title={disabled ? 'Transport controls disabled during coaching point playback' : '1x Speed - Normal'}
          >
            1×
          </button>
          <button
            className={`speed-btn ${currentPlaybackRate === CONFIG.video.playbackRates.fast ? 'active' : ''}`}
            onClick={handleFastSpeed}
            disabled={disabled}
            title={disabled ? 'Transport controls disabled during coaching point playback' : '2x Speed - Fast'}
          >
            2×
          </button>
          {onToggleFullscreen && (
            <button
              className='fullscreen-btn'
              onClick={onToggleFullscreen}
              disabled={disabled}
              title={disabled ?
                'Transport controls disabled during coaching point playback' :
                (isFullscreen ? 'Exit Fullscreen (F/Esc)' : 'Enter Fullscreen (F) - Note: Limited support on iOS')}
            >
              {isFullscreen ? <FaCompress /> : <FaExpand />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TransportControl;
