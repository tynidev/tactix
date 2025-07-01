import React from 'react';
import { type DrawingColor } from '../../types/config';
import './DrawingCanvas.css';

interface DrawingCanvasProps
{
  canvasRef: React.RefObject<HTMLCanvasElement>;
  currentColor: DrawingColor;
  startDrawing: (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => void;
  draw: (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => void;
  stopDrawing: () => void;
  videoDimensions: { width: number; height: number; top: number; left: number; } | null;
}

const DrawingCanvas: React.FC<DrawingCanvasProps> = ({
  canvasRef,
  startDrawing,
  draw,
  stopDrawing,
  videoDimensions,
}) =>
{
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) =>
  {
    startDrawing(e);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) =>
  {
    draw(e);
  };

  const handleMouseUp = () =>
  {
    stopDrawing();
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) =>
  {
    e.preventDefault();
    startDrawing(e);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) =>
  {
    e.preventDefault();
    draw(e);
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) =>
  {
    e.preventDefault();
    stopDrawing();
  };

  return (
    <canvas
      ref={canvasRef}
      id='drawing-canvas'
      className='drawing-canvas'
      style={videoDimensions ?
        {
          width: `${videoDimensions.width}px`,
          height: `${videoDimensions.height}px`,
          position: 'fixed',
          top: `${videoDimensions.top}px`,
          left: `${videoDimensions.left}px`,
          zIndex: 2,
          pointerEvents: 'auto',
        } :
        {
          display: 'none',
        }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseOut={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    />
  );
};

export default DrawingCanvas;
