import React from 'react';
import { CONFIG, type DrawingColor } from '../../types/config';
import './Toolbar.css';

interface ToolbarProps {
  currentColor: DrawingColor;
  isPlaying: boolean;
  currentPlaybackRate: number;
  onColorChange: (color: DrawingColor) => void;
  onClearCanvas: () => void;
  onTogglePlayPause: () => void;
  onSeek: (seconds: number) => void;
  onPlaybackRateChange: (rate: number) => void;
}

const Toolbar: React.FC<ToolbarProps> = ({
  currentColor,
  isPlaying,
  currentPlaybackRate,
  onColorChange,
  onClearCanvas,
  onTogglePlayPause,
  onSeek,
  onPlaybackRateChange
}) => {
  return (
    <div id="toolbar">
      {/* Speed Controls Group */}
      <div className="toolbar-group">
        <button
          className={`toolbar-btn btn-circular speed-btn ${currentPlaybackRate === CONFIG.video.playbackRates.slow ? 'active' : ''}`}
          onClick={() => onPlaybackRateChange(CONFIG.video.playbackRates.slow)}
          title="½x Speed"
        >
          ½x
        </button>
        <button
          className={`toolbar-btn btn-circular speed-btn ${currentPlaybackRate === CONFIG.video.playbackRates.normal ? 'active' : ''}`}
          onClick={() => onPlaybackRateChange(CONFIG.video.playbackRates.normal)}
          title="Normal Speed"
        >
          1x
        </button>
        <button
          className={`toolbar-btn btn-circular speed-btn ${currentPlaybackRate === CONFIG.video.playbackRates.fast ? 'active' : ''}`}
          onClick={() => onPlaybackRateChange(CONFIG.video.playbackRates.fast)}
          title="2x Speed"
        >
          2x
        </button>
      </div>

      <div className="toolbar-separator"></div>

      {/* Video Controls Group */}
      <div className="toolbar-group">
        <button
          className="toolbar-btn btn-circular control-btn"
          onClick={() => onSeek(-CONFIG.video.seekAmount)}
          title="Rewind (A/←)"
        >
          ⏪
        </button>
        <button
          className="toolbar-btn btn-circular control-btn"
          onClick={onTogglePlayPause}
          title="Play/Pause (S/Space)"
        >
          {isPlaying ? '⏸️' : '▶️'}
        </button>
        <button
          className="toolbar-btn btn-circular control-btn"
          onClick={() => onSeek(CONFIG.video.seekAmount)}
          title="Forward (D/→)"
        >
          ⏩
        </button>
      </div>

      <div className="toolbar-separator"></div>

      {/* Drawing Tools Group */}
      <div className="toolbar-group">
        <button
          className={`toolbar-btn btn-circular color-btn red-btn ${currentColor === 'red' ? 'active' : ''}`}
          onClick={() => {
            console.log('Red button clicked');
            onColorChange('red');
          }}
          title="Red (1)"
        />
        <button
          className={`toolbar-btn btn-circular color-btn green-btn ${currentColor === 'green' ? 'active' : ''}`}
          onClick={() => {
            console.log('Green button clicked');
            onColorChange('green');
          }}
          title="Yellow (2)"
        />
        <button
          className={`toolbar-btn btn-circular color-btn blue-btn ${currentColor === 'blue' ? 'active' : ''}`}
          onClick={() => {
            console.log('Blue button clicked');
            onColorChange('blue');
          }}
          title="Blue (3)"
        />
        <button
          className="toolbar-btn btn-circular control-btn"
          onClick={() => {
            console.log('Clear button clicked');
            onClearCanvas();
          }}
          title="Clear (E/C)"
        >
          🗑️
        </button>
      </div>
    </div>
  );
};

export default Toolbar;
