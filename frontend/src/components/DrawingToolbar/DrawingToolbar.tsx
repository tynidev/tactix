import React, { useState } from 'react';
import { CONFIG, type DrawingMode } from '../../types/config';
import './DrawingToolbar.css';

interface DrawingToolbarProps {
  currentColor: string;
  currentMode: DrawingMode;
  onColorChange: (color: string) => void;
  onModeChange: (mode: DrawingMode) => void;
  onClearCanvas: () => void;
}

const DrawingToolbar: React.FC<DrawingToolbarProps> = ({
  currentColor,
  currentMode,
  onColorChange,
  onModeChange,
  onClearCanvas,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div className={`drawing-toolbar ${isCollapsed ? 'collapsed' : ''}`}>
      {/* Collapse/Expand Button */}
      <div className="drawing-group">
        <button
          className="drawing-btn collapse-btn"
          onClick={toggleCollapse}
          title={isCollapsed ? 'Expand toolbar' : 'Collapse toolbar'}
        >
          {isCollapsed ? '🎨' : '━'}
        </button>
      </div>

      {!isCollapsed && (
        <>
          <div className="drawing-separator" />

          {/* Color Group */}
          <div className="drawing-group">
            <button
              className={`drawing-btn color-btn color1-btn ${
                currentColor === CONFIG.drawing.colors.color1 ? 'active' : ''
              }`}
              onClick={() => onColorChange(CONFIG.drawing.colors.color1)}
              title="Color 1 (1)"
            />
            <button
              className={`drawing-btn color-btn color2-btn ${
                currentColor === CONFIG.drawing.colors.color2 ? 'active' : ''
              }`}
              onClick={() => onColorChange(CONFIG.drawing.colors.color2)}
              title="Color 2 (2)"
            />
            <button
              className={`drawing-btn color-btn color3-btn ${
                currentColor === CONFIG.drawing.colors.color3 ? 'active' : ''
              }`}
              onClick={() => onColorChange(CONFIG.drawing.colors.color3)}
              title="Color 3 (3)"
            />
          </div>

          <div className="drawing-separator" />

          {/* Tools Group */}
          <div className="drawing-group">
            <button
              className={`drawing-btn mode-btn ${currentMode === 'arrow' ? 'active' : ''}`}
              onClick={() => onModeChange('arrow')}
              title="Arrow Line (4)"
            >
              ↗️
            </button>
            <button
              className={`drawing-btn mode-btn ${currentMode === 'line' ? 'active' : ''}`}
              onClick={() => onModeChange('line')}
              title="Simple Line (5)"
            >
              📏
            </button>
            <button
              className={`drawing-btn mode-btn ${currentMode === 'rectangle' ? 'active' : ''}`}
              onClick={() => onModeChange('rectangle')}
              title="Rectangle (6)"
            >
              ⬜
            </button>
            <button
              className={`drawing-btn mode-btn ${currentMode === 'ellipse' ? 'active' : ''}`}
              onClick={() => onModeChange('ellipse')}
              title="Ellipse (7)"
            >
              ⭕
            </button>
          </div>

          <div className="drawing-separator" />

          {/* Actions Group */}
          <div className="drawing-group">
            <button
              className="drawing-btn action-btn"
              onClick={onClearCanvas}
              title="Clear (E/C)"
            >
              🗑️
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default DrawingToolbar;
