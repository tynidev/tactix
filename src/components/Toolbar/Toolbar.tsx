import React from 'react';
import { CONFIG, type DrawingMode } from '../../types/config';
import './Toolbar.css';

interface ToolbarProps
{
  currentColor: string;
  currentMode: DrawingMode;
  isPlaying: boolean;
  currentPlaybackRate: number;
  onColorChange: (color: string) => void;
  onModeChange: (mode: DrawingMode) => void;
  onClearCanvas: () => void;
  onTogglePlayPause: () => void;
  onSeek: (seconds: number) => void;
  onPlaybackRateChange: (rate: number) => void;
}

const Toolbar: React.FC<ToolbarProps> = ({
  currentColor,
  currentMode,
  isPlaying,
  currentPlaybackRate,
  onColorChange,
  onModeChange,
  onClearCanvas,
  onTogglePlayPause,
  onSeek,
  onPlaybackRateChange,
}) =>
{
  return (
    <div id='toolbar'>
      {/* Speed Controls Group */}
      <div className='toolbar-group'>
        <button
          className={`toolbar-btn btn-circular speed-btn ${
            currentPlaybackRate === CONFIG.video.playbackRates.slow ? 'active' : ''
          }`}
          onClick={() => onPlaybackRateChange(CONFIG.video.playbackRates.slow)}
          title='0.5x Speed'
        >
          0.5x
        </button>
        <button
          className={`toolbar-btn btn-circular speed-btn ${
            currentPlaybackRate === CONFIG.video.playbackRates.normal ? 'active' : ''
          }`}
          onClick={() => onPlaybackRateChange(CONFIG.video.playbackRates.normal)}
          title='Normal Speed'
        >
          1x
        </button>
        <button
          className={`toolbar-btn btn-circular speed-btn ${
            currentPlaybackRate === CONFIG.video.playbackRates.fast ? 'active' : ''
          }`}
          onClick={() => onPlaybackRateChange(CONFIG.video.playbackRates.fast)}
          title='2x Speed'
        >
          2x
        </button>
      </div>

      <div className='toolbar-separator'></div>

      {/* Video Controls Group */}
      <div className='toolbar-group'>
        <button
          className='toolbar-btn btn-circular control-btn'
          onClick={() => onSeek(-CONFIG.video.seekAmount)}
          title='Rewind (A/←)'
        >
          ⏪
        </button>
        <button
          className='toolbar-btn btn-circular control-btn'
          onClick={onTogglePlayPause}
          title='Play/Pause (S/Space)'
        >
          {isPlaying ? '⏸️' : '▶️'}
        </button>
        <button
          className='toolbar-btn btn-circular control-btn'
          onClick={() => onSeek(CONFIG.video.seekAmount)}
          title='Forward (D/→)'
        >
          ⏩
        </button>
      </div>

      <div className='toolbar-separator'></div>

      {/* Drawing Tools Group */}
      <div className='toolbar-group'>
        <button
          className={`toolbar-btn btn-circular color-btn color1-btn ${currentColor === CONFIG.drawing.colors.color1 ? 'active' : ''}`}
          onClick={() =>
          {
            console.log('Color1 button clicked');
            onColorChange(CONFIG.drawing.colors.color1);
          }}
          title='Color1 (1)'
        />
        <button
          className={`toolbar-btn btn-circular color-btn color2-btn ${currentColor === CONFIG.drawing.colors.color2 ? 'active' : ''}`}
          onClick={() =>
          {
            console.log('Color2 button clicked');
            onColorChange(CONFIG.drawing.colors.color2);
          }}
          title='Color2 (2)'
        />
        <button
          className={`toolbar-btn btn-circular color-btn color3-btn ${currentColor === CONFIG.drawing.colors.color3 ? 'active' : ''}`}
          onClick={() =>
          {
            console.log('Color3 button clicked');
            onColorChange(CONFIG.drawing.colors.color3);
          }}
          title='Color3 (3)'
        />
        <button
          className={`toolbar-btn btn-circular mode-btn ${currentMode === 'arrow' ? 'active' : ''}`}
          onClick={() =>
          {
            console.log('Arrow mode button clicked');
            onModeChange('arrow');
          }}
          title='Arrow Line (4)'
        >
          ↗️
        </button>
        <button
          className={`toolbar-btn btn-circular mode-btn ${currentMode === 'line' ? 'active' : ''}`}
          onClick={() =>
          {
            console.log('Line mode button clicked');
            onModeChange('line');
          }}
          title='Simple Line (5)'
        >
          📏
        </button>
        <button
          className={`toolbar-btn btn-circular mode-btn ${currentMode === 'rectangle' ? 'active' : ''}`}
          onClick={() =>
          {
            console.log('Rectangle mode button clicked');
            onModeChange('rectangle');
          }}
          title='Rectangle (6)'
        >
          ⬜
        </button>
        <button
          className={`toolbar-btn btn-circular mode-btn ${currentMode === 'ellipse' ? 'active' : ''}`}
          onClick={() =>
          {
            console.log('Ellipse mode button clicked');
            onModeChange('ellipse');
          }}
          title='Ellipse (7)'
        >
          ⭕
        </button>
        <button
          className='toolbar-btn btn-circular control-btn'
          onClick={() =>
          {
            console.log('Clear button clicked');
            onClearCanvas();
          }}
          title='Clear (E/C)'
        >
          🗑️
        </button>
      </div>
    </div>
  );
};

export default Toolbar;
