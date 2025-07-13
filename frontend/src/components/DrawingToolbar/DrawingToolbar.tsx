import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CONFIG, type DrawingMode } from '../../types/config';
import './DrawingToolbar.css';
import { FaEraser, FaLongArrowAltUp, FaMinus, FaPalette, FaPen, FaRegCircle, FaRegSquare } from 'react-icons/fa';

interface DrawingToolbarProps
{
  currentColor: string;
  currentMode: DrawingMode;
  onColorChange: (color: string) => void;
  onModeChange: (mode: DrawingMode) => void;
  onClearCanvas: () => void;
  onUndoLastDrawing: () => void;
}

const DrawingToolbar: React.FC<DrawingToolbarProps> = ({
  currentColor,
  currentMode,
  onColorChange,
  onModeChange,
  onClearCanvas,
  onUndoLastDrawing,
}) =>
{
  const [isCollapsed, setIsCollapsed] = useState(false);
  const lastClickTimeRef = useRef<number>(0);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const toggleCollapse = useCallback(() =>
  {
    setIsCollapsed(prev => !prev);
  }, []);

  const handleColorChange = useCallback((color: string) =>
  {
    onColorChange(color);
  }, [onColorChange]);

  const handleModeChange = useCallback((mode: DrawingMode) =>
  {
    onModeChange(mode);
  }, [onModeChange]);

  const handleEraseClick = useCallback(() =>
  {
    const currentTime = Date.now();
    const timeDifference = currentTime - lastClickTimeRef.current;

    // Clear any existing timeout
    if (clickTimeoutRef.current)
    {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }

    // Check if this is a double-click (within 300ms)
    if (timeDifference < 300 && timeDifference > 0)
    {
      // Double-click: clear canvas
      onClearCanvas();
      lastClickTimeRef.current = 0; // Reset to prevent triple-click issues
    }
    else
    {
      // Single click: wait to see if there's a second click
      lastClickTimeRef.current = currentTime;
      clickTimeoutRef.current = setTimeout(() =>
      {
        // Timeout expired, this was a single click: undo last drawing
        onUndoLastDrawing();
        lastClickTimeRef.current = 0;
        clickTimeoutRef.current = null;
      }, 300);
    }
  }, [onClearCanvas, onUndoLastDrawing]);

  // Cleanup effect to clear timeout on unmount
  useEffect(() =>
  {
    return () =>
    {
      if (clickTimeoutRef.current)
      {
        clearTimeout(clickTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className={`drawing-toolbar ${isCollapsed ? 'collapsed' : ''}`}>
      {/* Collapse/Expand Button */}
      <div className='drawing-group'>
        <button
          className='drawing-btn collapse-btn'
          onClick={toggleCollapse}
          title={isCollapsed ? 'Expand toolbar' : 'Collapse toolbar'}
        >
          {isCollapsed ? <FaPalette /> : <FaMinus />}
        </button>
      </div>

      {!isCollapsed && (
        <>
          <div className='drawing-separator' />

          {/* Color Group */}
          <div className='drawing-group'>
            <button
              className={`drawing-btn color-btn color1-btn ${
                currentColor === CONFIG.drawing.colors.color1 ? 'color-active' : ''
              }`}
              onClick={() => handleColorChange(CONFIG.drawing.colors.color1)}
              title='Color 1 (1)'
            />
            <button
              className={`drawing-btn color-btn color2-btn ${
                currentColor === CONFIG.drawing.colors.color2 ? 'color-active' : ''
              }`}
              onClick={() => handleColorChange(CONFIG.drawing.colors.color2)}
              title='Color 2 (2)'
            />
            <button
              className={`drawing-btn color-btn color3-btn ${
                currentColor === CONFIG.drawing.colors.color3 ? 'color-active' : ''
              }`}
              onClick={() => handleColorChange(CONFIG.drawing.colors.color3)}
              title='Color 3 (3)'
            />
          </div>

          <div className='drawing-separator' />

          {/* Tools Group */}
          <div className='drawing-group'>
            <button
              className={`drawing-btn mode-btn ${currentMode === 'arrow' ? 'tool-active' : ''}`}
              onClick={() => handleModeChange('arrow')}
              title='Arrow Line (4)'
            >
              <FaLongArrowAltUp />
            </button>
            <button
              className={`drawing-btn mode-btn ${currentMode === 'line' ? 'tool-active' : ''}`}
              onClick={() => handleModeChange('line')}
              title='Simple Line (5)'
            >
              <FaPen />
            </button>
            <button
              className={`drawing-btn mode-btn ${currentMode === 'rectangle' ? 'tool-active' : ''}`}
              onClick={() => handleModeChange('rectangle')}
              title='Rectangle (6)'
            >
              <FaRegSquare />
            </button>
            <button
              className={`drawing-btn mode-btn ${currentMode === 'ellipse' ? 'tool-active' : ''}`}
              onClick={() => handleModeChange('ellipse')}
              title='Ellipse (7)'
            >
              <FaRegCircle />
            </button>
          </div>

          <div className='drawing-separator' />

          {/* Actions Group */}
          <div className='drawing-group'>
            <button
              className='drawing-btn action-btn'
              onClick={handleEraseClick}
              title='Undo (single click) / Clear (double click)'
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
