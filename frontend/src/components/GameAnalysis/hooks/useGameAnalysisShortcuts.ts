import { useMemo } from 'react';
import { useKeyboardShortcuts } from '../../../hooks/useKeyboardShortcuts';

interface VideoControls
{
  togglePlayPause: () => void;
  seekVideo: (deltaSeconds: number) => void;
  handlePlaybackRateChange: (rate: number) => void;
}

interface DrawingControls
{
  changeColor: (color: any) => void;
  changeMode: (mode: any) => void;
  clearCanvas: () => void;
  undoLastDrawing: () => void;
}

interface UseShortcutsArgs
{
  videoPlayer: any;
  video: VideoControls;
  drawing: DrawingControls;
  ui: {
    showCoachingPointModal: boolean;
    isFlyoutExpanded: boolean;
    isPlaybackActive: boolean;
    hasSelectedCoachingPoint: boolean;
  };
}

export function useGameAnalysisShortcuts({
  videoPlayer,
  video,
  drawing,
  ui,
}: UseShortcutsArgs)
{
  const disabled = useMemo(
    () =>
      ui.showCoachingPointModal ||
      ui.isFlyoutExpanded ||
      ui.isPlaybackActive ||
      ui.hasSelectedCoachingPoint,
    [ui.showCoachingPointModal, ui.isFlyoutExpanded, ui.isPlaybackActive, ui.hasSelectedCoachingPoint],
  );

  useKeyboardShortcuts({
    videoPlayer,
    togglePlayPause: video.togglePlayPause,
    seekVideo: video.seekVideo,
    setPlaybackRate: video.handlePlaybackRateChange,
    changeColor: drawing.changeColor,
    changeMode: drawing.changeMode,
    clearCanvas: drawing.clearCanvas,
    undoLastDrawing: drawing.undoLastDrawing,
    disabled,
  });
}
