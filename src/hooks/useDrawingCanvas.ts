import { useCallback, useEffect, useRef, useState } from 'react';
import { CONFIG, type DrawingColor, type DrawingMode } from '../types/config';
import { type Drawing, drawElement, drawRectangle, drawEllipse, drawArrowHead } from '../utils/drawingRenderer';

// Define event types for drawing
type DrawingMouseEvent = React.MouseEvent<HTMLCanvasElement>;
type DrawingTouchEvent = React.TouchEvent<HTMLCanvasElement>;
type DrawingEvent = DrawingMouseEvent | DrawingTouchEvent;

/**
 * Converts pixel coordinates to normalized percentages (0-1) relative to canvas dimensions.
 * This allows drawing commands to be resolution-independent and scale properly when canvas size changes.
 *
 * @param point - The pixel coordinates to normalize
 * @param canvas - The canvas element to normalize coordinates relative to
 * @returns Normalized coordinates as percentages (0-1)
 */
const normalizePoint = (point: { x: number; y: number; }, canvas: HTMLCanvasElement) => ({
  x: point.x / canvas.width,
  y: point.y / canvas.height,
});

/**
 * Calculates the scaled line width based on canvas dimensions.
 * Uses the smaller dimension to ensure proportional scaling regardless of aspect ratio.
 *
 * @param canvas - The canvas element to calculate line width for
 * @returns The calculated pixel line width
 */
const getScaledLineWidth = (canvas: HTMLCanvasElement): number => {
  const minDimension = Math.min(canvas.width, canvas.height);
  return minDimension * CONFIG.drawing.lineWidth;
};

/**
 * Custom hook for managing drawing functionality on a canvas element.
 * Provides drawing capabilities including color selection, stroke management,
 * canvas clearing, and automatic scaling when canvas dimensions change.
 *
 * Features:
 * - Resolution-independent drawing using normalized coordinates
 * - Automatic canvas setup and resizing
 * - Touch and mouse event support
 * - Drawing command history for redrawing after resize
 * - Color switching with immediate visual feedback
 *
 * @returns Object containing canvas ref, drawing state, and drawing functions
 */
export const useDrawingCanvas = () =>
{
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentColorRef = useRef<DrawingColor>('color1');
  const currentModeRef = useRef<DrawingMode>('arrow');
  const drawingElementsRef = useRef<Drawing[]>([]);
  const currentStrokeRef = useRef<{ x: number; y: number; }[]>([]);
  const resizeTimeoutRef = useRef<number>();
  const isDrawingRef = useRef<boolean>(false);
  const [currentColor, setCurrentColor] = useState<DrawingColor>('color1');
  const [currentMode, setCurrentMode] = useState<DrawingMode>('arrow');
  const [lastPosition, setLastPosition] = useState({ x: 0, y: 0 });
  const [rectangleStartPoint, setRectangleStartPoint] = useState<{ x: number; y: number; } | null>(null);
  const [ellipseStartPoint, setEllipseStartPoint] = useState<{ x: number; y: number; } | null>(null);

  /**
   * Redraws all stored drawing commands on the canvas at the current canvas size.
   * Uses denormalized coordinates to scale drawings appropriately when canvas dimensions change.
   * This function is called after canvas resizes to maintain drawing fidelity.
   */
  const redrawCanvas = useCallback(() =>
  {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Set default properties
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    console.log('Redrawing canvas with', drawingElementsRef.current.length, 'elements');

    // Redraw all stored elements using the new drawing system
    drawingElementsRef.current.forEach((element) => {
      drawElement(ctx, element, canvas);
    });
  }, []);

  /**
   * Sets up the canvas with proper dimensions and drawing properties.
   * Ensures canvas internal dimensions match display size for crisp rendering.
   * Only updates dimensions when they differ from current size to avoid unnecessary redraws.
   */
  const setupCanvas = useCallback(() =>
  {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas internal dimensions to match the display size
    const rect = canvas.getBoundingClientRect();

    // Only set dimensions if they're not already set or if they're different
    if (canvas.width !== rect.width || canvas.height !== rect.height)
    {
      canvas.width = rect.width;
      canvas.height = rect.height;

      // Redraw all commands after canvas resize
      redrawCanvas();
    }

    // Set initial drawing properties
    ctx.strokeStyle = CONFIG.drawing.colors[currentColorRef.current];
    ctx.lineWidth = getScaledLineWidth(canvas);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [redrawCanvas]);

  /**
   * Updates canvas drawing properties (color, line width, etc.) without clearing the canvas.
   * Called when drawing settings change to ensure new strokes use updated properties.
   */
  const updateCanvasProperties = useCallback(() =>
  {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set drawing properties without clearing the canvas
    ctx.strokeStyle = CONFIG.drawing.colors[currentColor];
    ctx.lineWidth = getScaledLineWidth(canvas);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    console.log('Canvas properties updated. Current color:', currentColor, 'Stroke style:', ctx.strokeStyle);
  }, [currentColor]);

  /**
   * Debounced canvas resize handler to prevent excessive resize operations.
   * Delays canvas setup by 100ms after the last resize event to improve performance.
   */
  const debouncedResize = useCallback(() =>
  {
    if (resizeTimeoutRef.current)
    {
      clearTimeout(resizeTimeoutRef.current);
    }

    resizeTimeoutRef.current = window.setTimeout(() =>
    {
      setupCanvas();
    }, 100); // Debounce resize operations by 100ms
  }, [setupCanvas]);

  useEffect(() =>
  {
    setupCanvas();

    const handleResize = () => debouncedResize();
    window.addEventListener('resize', handleResize);

    return () =>
    {
      window.removeEventListener('resize', handleResize);
      if (resizeTimeoutRef.current)
      {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, []); // Only run once on mount

  // Track canvas size changes (when video dimensions change)
  useEffect(() =>
  {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeObserver = new ResizeObserver(() =>
    {
      // Use debounced resize for video dimension changes too
      debouncedResize();
    });

    resizeObserver.observe(canvas);

    return () =>
    {
      resizeObserver.disconnect();
    };
  }, [debouncedResize]);

  // Separate effect for updating canvas properties when color changes
  useEffect(() =>
  {
    updateCanvasProperties();
  }, [currentColor]); // Only depend on currentColor directly

  // Cleanup effect
  useEffect(() =>
  {
    return () =>
    {
      if (resizeTimeoutRef.current)
      {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, []);

  /**
   * Initiates a drawing stroke when mouse/touch input begins.
   * Records the starting position and prepares for continuous drawing.
   *
   * @param e - Mouse or touch event containing position information
   */
  const startDrawing = useCallback((e: DrawingEvent) =>
  {
    const canvas = canvasRef.current;
    if (!canvas) return;

    isDrawingRef.current = true;
    const rect = canvas.getBoundingClientRect();

    let clientX: number, clientY: number;
    if ('touches' in e)
    {
      if (e.touches.length === 0) return;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    }
    else
    {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    if (currentModeRef.current === 'rectangle')
    {
      // For rectangle mode, just store the starting point
      setRectangleStartPoint({ x, y });
    }
    else if (currentModeRef.current === 'ellipse')
    {
      // For ellipse mode, just store the starting point
      setEllipseStartPoint({ x, y });
    }
    else
    {
      // For line/arrow modes, start a new stroke
      currentStrokeRef.current = [{ x, y }];
    }

    setLastPosition({ x, y });
  }, []);

  /**
   * Continues drawing by adding points to the current stroke and rendering on canvas.
   * Called during mouse/touch move events while drawing is active.
   * Draws line segments between the last position and current position.
   *
   * @param e - Mouse or touch event containing current position information
   */
  const draw = useCallback((e: DrawingEvent) =>
  {
    if (!isDrawingRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();

    let clientX: number, clientY: number;
    if ('touches' in e)
    {
      if (e.touches.length === 0) return;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    }
    else
    {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const currentX = clientX - rect.left;
    const currentY = clientY - rect.top;

    try
    {
      if (currentModeRef.current === 'rectangle' && rectangleStartPoint)
      {
        // For rectangle mode, clear and redraw everything including the preview rectangle
        redrawCanvas();

        // Draw preview rectangle
        drawRectangle(
          ctx,
          rectangleStartPoint,
          { x: currentX, y: currentY },
          CONFIG.drawing.colors[currentColor],
          getScaledLineWidth(canvas),
        );

        // Update last position for the rectangle end point
        setLastPosition({ x: currentX, y: currentY });
      }
      else if (currentModeRef.current === 'ellipse' && ellipseStartPoint)
      {
        // For ellipse mode, clear and redraw everything including the preview ellipse
        redrawCanvas();

        // Draw preview ellipse
        drawEllipse(
          ctx,
          ellipseStartPoint,
          { x: currentX, y: currentY },
          CONFIG.drawing.colors[currentColor],
          getScaledLineWidth(canvas),
        );

        // Update last position for the ellipse end point
        setLastPosition({ x: currentX, y: currentY });
      }
      else
      {
        // For line/arrow modes, continue with normal drawing
        const DISTANCE_THRESHOLD = 4;

        // Calculate distance from the last recorded point in the stroke
        let shouldAddPoint = false;
        if (currentStrokeRef.current.length === 0)
        {
          // Always add the first point
          shouldAddPoint = true;
        }
        else
        {
          const lastRecordedPoint = currentStrokeRef.current[currentStrokeRef.current.length - 1];
          const distance = Math.sqrt(
            Math.pow(currentX - lastRecordedPoint.x, 2) +
              Math.pow(currentY - lastRecordedPoint.y, 2),
          );
          shouldAddPoint = distance >= DISTANCE_THRESHOLD;
        }

        // Only add point to stroke if it meets the distance threshold
        if (shouldAddPoint)
        {
          currentStrokeRef.current.push({ x: currentX, y: currentY });
        }

        // Always draw the line segment for smooth visual feedback
        ctx.strokeStyle = CONFIG.drawing.colors[currentColor];
        ctx.lineWidth = getScaledLineWidth(canvas);
        ctx.beginPath();
        ctx.moveTo(lastPosition.x, lastPosition.y);
        ctx.lineTo(currentX, currentY);
        ctx.stroke();

        setLastPosition({ x: currentX, y: currentY });
      }
    }
    catch (error)
    {
      console.error('Drawing error:', error);
      isDrawingRef.current = false;
    }
  }, [lastPosition, currentColor, rectangleStartPoint, ellipseStartPoint, redrawCanvas]);

  /**
   * Completes the current drawing stroke and saves it to the command history.
   * Normalizes coordinates to percentages for resolution independence.
   * Only saves strokes with more than one point (actual drawing occurred).
   */
  const stopDrawing = useCallback(() =>
  {
    if (!isDrawingRef.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    // RECTANGLE:
    if (currentModeRef.current === 'rectangle' && rectangleStartPoint)
    {
      // For rectangle mode, save the rectangle as a command
      const normalizedStartPoint = normalizePoint(rectangleStartPoint, canvas);
      const normalizedEndPoint = normalizePoint(lastPosition, canvas);

      const command: Drawing = {
        type: 'rectangle',
        points: [normalizedStartPoint, normalizedEndPoint],
        color: currentColor,
        lineStyle: 'solid', // For now, defaulting to solid for rectangles
        strokeOpacity: 1.0, // Default stroke opacity
        fillOpacity: undefined, // No fill by default - could be made configurable
      };

      drawingElementsRef.current.push(command);
      console.log('Rectangle saved:', command, 'Total commands:', drawingElementsRef.current.length);
      setRectangleStartPoint(null);
    }
    // ELLIPSE:
    else if (currentModeRef.current === 'ellipse' && ellipseStartPoint)
    {
      // For ellipse mode, save the ellipse as a command
      const normalizedStartPoint = normalizePoint(ellipseStartPoint, canvas);
      const normalizedEndPoint = normalizePoint(lastPosition, canvas);

      const command: Drawing = {
        type: 'ellipse',
        points: [normalizedStartPoint, normalizedEndPoint],
        color: currentColor,
        lineStyle: 'solid', // For now, defaulting to solid for ellipses
        strokeOpacity: 1.0, // Default stroke opacity
        fillOpacity: undefined, // No fill by default - could be made configurable
      };

      drawingElementsRef.current.push(command);
      console.log('Ellipse saved:', command, 'Total commands:', drawingElementsRef.current.length);
      setEllipseStartPoint(null);
    }
    // LINE:
    else if (currentStrokeRef.current.length > 1)
    {
      // Check if lastPosition is different from the last stored point
      const lastStoredPoint = currentStrokeRef.current[currentStrokeRef.current.length - 1];
      const distance = Math.sqrt(
        Math.pow(lastPosition.x - lastStoredPoint.x, 2) +
          Math.pow(lastPosition.y - lastStoredPoint.y, 2),
      );

      // If lastPosition is more than 1 pixel away from last stored point, add it
      let pointsForStorage = [...currentStrokeRef.current];
      if (distance > 1)
      {
        pointsForStorage.push(lastPosition);
      }

      // For line/arrow modes, save the stroke
      // Normalize points to percentages before storing (including the final position)
      const normalizedPoints = pointsForStorage.map(point => normalizePoint(point, canvas));

      // Draw arrow head at the end of the current stroke only if in arrow mode
      if (currentModeRef.current === 'arrow' && pointsForStorage.length >= 2)
      {
        // Use the last 10% of points to calculate arrow direction
        const totalPoints = pointsForStorage.length;
        const startIndex = Math.max(0, Math.floor(totalPoints * 0.9));
        const startPoint = pointsForStorage[startIndex];
        // Always use lastPosition as the true end point for arrow head placement
        drawArrowHead(
          ctx,
          startPoint,
          lastPosition,
          CONFIG.drawing.colors[currentColor],
          getScaledLineWidth(canvas),
          canvas,
        );
      }

      // Save the completed stroke as a command with normalized coordinates
      const command: Drawing = {
        type: 'stroke',
        points: normalizedPoints,
        color: currentColor,
        hasArrowHead: currentModeRef.current === 'arrow',
        lineStyle: 'solid', // For now, defaulting to solid for strokes
        strokeOpacity: 1.0, // Default stroke opacity
      };

      drawingElementsRef.current.push(command);
      currentStrokeRef.current = [];
    }

    isDrawingRef.current = false;
  }, [currentColor, rectangleStartPoint, ellipseStartPoint, lastPosition]);

  /**
   * Clears all drawings from the canvas and resets the command history.
   * Removes both the visual representation and stored drawing commands.
   * Provides a clean slate for new drawings.
   */
  const clearCanvas = useCallback(() =>
  {
    console.log('Clearing canvas');
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx)
    {
      console.log('Canvas or context not available');
      return;
    }

    // Clear stored commands
    drawingElementsRef.current = [];
    currentStrokeRef.current = [];

    // Clear rectangle and ellipse drawing state
    setRectangleStartPoint(null);
    setEllipseStartPoint(null);

    // Clear visual canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    console.log('Canvas cleared');
  }, []);

  /**
   * Changes the current drawing color for new strokes.
   * Updates both the ref (for immediate use) and state (for UI updates).
   * Canvas properties are automatically updated via useEffect.
   *
   * @param color - The new color to use for drawing strokes
   */
  const changeColor = useCallback((color: DrawingColor) =>
  {
    console.log('Changing color to:', color);
    currentColorRef.current = color; // Update ref immediately
    setCurrentColor(color);
    // Canvas properties will be updated automatically by the useEffect
  }, []);

  /**
   * Changes the current drawing mode (arrow or line) for new strokes.
   * Updates both the ref (for immediate use) and state (for UI updates).
   *
   * @param mode - The new mode to use for drawing strokes
   */
  const changeMode = useCallback((mode: DrawingMode) =>
  {
    console.log('Changing mode to:', mode);
    currentModeRef.current = mode; // Update ref immediately
    setCurrentMode(mode);
  }, []);

  /**
   * Undoes the last drawing command by removing it from the command history
   * and redrawing the canvas without it.
   */
  const undoLastDrawing = useCallback(() =>
  {
    if (drawingElementsRef.current.length === 0)
    {
      console.log('No drawings to undo');
      return;
    }

    // Remove the last drawing command
    const removedCommand = drawingElementsRef.current.pop();
    console.log('Undoing last drawing:', removedCommand, 'Remaining commands:', drawingElementsRef.current.length);

    // Redraw the canvas without the removed command
    redrawCanvas();
  }, [redrawCanvas]);

  return {
    canvasRef,
    currentColor,
    currentMode,
    startDrawing,
    draw,
    stopDrawing,
    clearCanvas,
    changeColor,
    changeMode,
    undoLastDrawing,
  };
};
