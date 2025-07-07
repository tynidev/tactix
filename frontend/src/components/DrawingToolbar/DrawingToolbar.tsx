import React, { useState, useCallback } from 'react';
import { CONFIG, type DrawingMode } from '../../types/config';
import './DrawingToolbar.css';
import { 
  FaPalette, 
  FaRegSquare, 
  FaRegCircle, 
  FaEraser,
  FaMinus,
  FaPen,
  FaLongArrowAltUp
} from 'react-icons/fa';

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

  const toggleCollapse = useCallback(() => {
    setIsCollapsed(prev => !prev);
  }, []);

  const handleColorChange = useCallback((color: string) => {
    onColorChange(color);
  }, [onColorChange]);

  const handleModeChange = useCallback((mode: DrawingMode) => {
    onModeChange(mode);
  }, [onModeChange]);

  return (
    <div className={`drawing-toolbar ${isCollapsed ? 'collapsed' : ''}`}>
      {/* Collapse/Expand Button */}
      <div className="drawing-group">
        <button
          className="drawing-btn collapse-btn"
          onClick={toggleCollapse}
          title={isCollapsed ? 'Expand toolbar' : 'Collapse toolbar'}
        >
          {isCollapsed ? <FaPalette /> : <FaMinus />}
        </button>
      </div>

      {!isCollapsed && (
        <>
          <div className="drawing-separator" />

          {/* Color Group */}
          <div className="drawing-group">
            <button
              className={`drawing-btn color-btn color1-btn ${
                currentColor === CONFIG.drawing.colors.color1 ? 'color-active' : ''
              }`}
              onClick={() => handleColorChange(CONFIG.drawing.colors.color1)}
              title="Color 1 (1)"
            />
            <button
              className={`drawing-btn color-btn color2-btn ${
                currentColor === CONFIG.drawing.colors.color2 ? 'color-active' : ''
              }`}
              onClick={() => handleColorChange(CONFIG.drawing.colors.color2)}
              title="Color 2 (2)"
            />
            <button
              className={`drawing-btn color-btn color3-btn ${
                currentColor === CONFIG.drawing.colors.color3 ? 'color-active' : ''
              }`}
              onClick={() => handleColorChange(CONFIG.drawing.colors.color3)}
              title="Color 3 (3)"
            />
          </div>

          <div className="drawing-separator" />

          {/* Tools Group */}
          <div className="drawing-group">
            <button
              className={`drawing-btn mode-btn ${currentMode === 'arrow' ? 'tool-active' : ''}`}
              onClick={() => handleModeChange('arrow')}
              title="Arrow Line (4)"
            >
              <FaLongArrowAltUp />
            </button>
            <button
              className={`drawing-btn mode-btn ${currentMode === 'line' ? 'tool-active' : ''}`}
              onClick={() => handleModeChange('line')}
              title="Simple Line (5)"
            >
              <FaPen />
            </button>
            <button
              className={`drawing-btn mode-btn ${currentMode === 'rectangle' ? 'tool-active' : ''}`}
              onClick={() => handleModeChange('rectangle')}
              title="Rectangle (6)"
            >
              <FaRegSquare />
            </button>
            <button
              className={`drawing-btn mode-btn ${currentMode === 'ellipse' ? 'tool-active' : ''}`}
              onClick={() => handleModeChange('ellipse')}
              title="Ellipse (7)"
            >
              <FaRegCircle />
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
              <FaEraser />
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default DrawingToolbar;
