import { useCallback, useEffect, useRef, useState } from 'react';
import { CONFIG, type DrawingColor, type DrawingMode } from '../types/config';

// Define event types for drawing
type DrawingMouseEvent = React.MouseEvent<HTMLCanvasElement>;
type DrawingTouchEvent = React.TouchEvent<HTMLCanvasElement>;
type DrawingEvent = DrawingMouseEvent | DrawingTouchEvent;

// Define drawing command types with normalized coordinates
interface DrawingCommand
{
  type: 'stroke' | 'rectangle' | 'ellipse';
  points: { x: number; y: number; }[]; // Stored as percentages (0-1)
  color: DrawingColor;
  lineWidth: number;
  hasArrowHead: boolean;
}

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
 * Converts normalized percentage coordinates (0-1) back to pixel coordinates.
 * Used when redrawing stored commands at the current canvas size.
 *
 * @param point - The normalized coordinates (0-1) to convert
 * @param canvas - The canvas element to convert coordinates relative to
 * @returns Pixel coordinates scaled to current canvas size
 */
const denormalizePoint = (point: { x: number; y: number; }, canvas: HTMLCanvasElement) => ({
  x: point.x * canvas.width,
  y: point.y * canvas.height,
});

/**
 * Draws an arrow head at the end of a line.
 *
 * @param ctx - The canvas 2D rendering context
 * @param from - The point the arrow is coming from
 * @param to - The point where the arrow head should be drawn
 * @param color - The color of the arrow head
 * @param lineWidth - The width of the line (used to size the arrow head)
 */
const drawArrowHead = (
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number; },
  to: { x: number; y: number; },
  color: string,
  lineWidth: number,
) =>
{
  const arrowLength = Math.max(lineWidth * 4, 25); // Increased arrow head length

  // Calculate the angle of the line using only the last 10% for more accurate direction
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  // Calculate the point that's 90% along the line (10% from the end)
  const startPoint = {
    x: from.x + dx * 0.9,
    y: from.y + dy * 0.9,
  };

  // Use the last 10% of the line to calculate the arrow direction
  const angle = Math.atan2(to.y - startPoint.y, to.x - startPoint.x);

  // Calculate arrow head points directly from the end point
  const arrowPoint1 = {
    x: to.x - arrowLength * Math.cos(angle - Math.PI / 4),
    y: to.y - arrowLength * Math.sin(angle - Math.PI / 4),
  };

  const arrowPoint2 = {
    x: to.x - arrowLength * Math.cos(angle + Math.PI / 4),
    y: to.y - arrowLength * Math.sin(angle + Math.PI / 4),
  };

  // Also draw strokes to ensure connection with the line
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;

  // Draw lines from the arrow base to the tip to ensure solid connection
  ctx.beginPath();
  ctx.moveTo(arrowPoint1.x, arrowPoint1.y);
  ctx.lineTo(to.x, to.y);
  ctx.lineTo(arrowPoint2.x, arrowPoint2.y);
  ctx.stroke();
};

/**
 * Draws a rectangle from two corner points.
 *
 * @param ctx - The canvas 2D rendering context
 * @param startPoint - The starting corner point
 * @param endPoint - The ending corner point
 * @param color - The color of the rectangle
 * @param lineWidth - The width of the lines
 */
const drawRectangle = (
  ctx: CanvasRenderingContext2D,
  startPoint: { x: number; y: number; },
  endPoint: { x: number; y: number; },
  color: string,
  lineWidth: number,
) =>
{
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;

  const width = endPoint.x - startPoint.x;
  const height = endPoint.y - startPoint.y;

  ctx.beginPath();
  ctx.rect(startPoint.x, startPoint.y, width, height);
  ctx.stroke();
};

/**
 * Draws an ellipse from two corner points defining the bounding rectangle.
 *
 * @param ctx - The canvas 2D rendering context
 * @param startPoint - The starting corner point
 * @param endPoint - The ending corner point
 * @param color - The color of the ellipse
 * @param lineWidth - The width of the lines
 */
const drawEllipse = (
  ctx: CanvasRenderingContext2D,
  startPoint: { x: number; y: number; },
  endPoint: { x: number; y: number; },
  color: string,
  lineWidth: number,
) =>
{
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;

  const centerX = (startPoint.x + endPoint.x) / 2;
  const centerY = (startPoint.y + endPoint.y) / 2;
  const radiusX = Math.abs(endPoint.x - startPoint.x) / 2;
  const radiusY = Math.abs(endPoint.y - startPoint.y) / 2;

  ctx.beginPath();
  ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
  ctx.stroke();
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
  const drawingCommandsRef = useRef<DrawingCommand[]>([]);
  const currentStrokeRef = useRef<{ x: number; y: number; }[]>([]);
  const resizeTimeoutRef = useRef<number>();
  const [isDrawing, setIsDrawing] = useState(false);
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

    console.log('Redrawing canvas with', drawingCommandsRef.current.length, 'commands');

    // Redraw all stored commands using denormalized coordinates
    drawingCommandsRef.current.forEach((command, index) =>
    {
      if (command.type === 'stroke' && command.points.length > 1)
      {
        ctx.strokeStyle = CONFIG.drawing.colors[command.color];
        ctx.lineWidth = command.lineWidth;

        ctx.beginPath();
        const firstPoint = denormalizePoint(command.points[0], canvas);
        ctx.moveTo(firstPoint.x, firstPoint.y);

        for (let i = 1; i < command.points.length; i++)
        {
          const point = denormalizePoint(command.points[i], canvas);
          ctx.lineTo(point.x, point.y);
        }

        ctx.stroke();

        // Draw arrow head at the end if the stroke has an arrow head
        if (command.hasArrowHead && command.points.length >= 2)
        {
          // Use the last 10% of points to calculate arrow direction
          const totalPoints = command.points.length;
          const startIndex = Math.max(0, Math.floor(totalPoints * 0.9));
          const startPoint = denormalizePoint(command.points[startIndex], canvas);
          const lastPoint = denormalizePoint(command.points[command.points.length - 1], canvas);
          drawArrowHead(ctx, startPoint, lastPoint, CONFIG.drawing.colors[command.color], command.lineWidth);
        }
      }
      else if (command.type === 'rectangle' && command.points.length === 2)
      {
        console.log('Redrawing rectangle', index, ':', command);
        const startPoint = denormalizePoint(command.points[0], canvas);
        const endPoint = denormalizePoint(command.points[1], canvas);
        drawRectangle(ctx, startPoint, endPoint, CONFIG.drawing.colors[command.color], command.lineWidth);
      }
      else if (command.type === 'ellipse' && command.points.length === 2)
      {
        console.log('Redrawing ellipse', index, ':', command);
        const startPoint = denormalizePoint(command.points[0], canvas);
        const endPoint = denormalizePoint(command.points[1], canvas);
        drawEllipse(ctx, startPoint, endPoint, CONFIG.drawing.colors[command.color], command.lineWidth);
      }
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
    ctx.lineWidth = CONFIG.drawing.lineWidth;
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
    ctx.lineWidth = CONFIG.drawing.lineWidth;
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

    setIsDrawing(true);
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
    if (!isDrawing) return;

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
          CONFIG.drawing.lineWidth,
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
          CONFIG.drawing.lineWidth,
        );

        // Update last position for the ellipse end point
        setLastPosition({ x: currentX, y: currentY });
      }
      else
      {
        // For line/arrow modes, continue with normal drawing
        // Add point to current stroke
        currentStrokeRef.current.push({ x: currentX, y: currentY });

        // Draw immediately on canvas
        ctx.strokeStyle = CONFIG.drawing.colors[currentColor];
        ctx.lineWidth = CONFIG.drawing.lineWidth;
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
      setIsDrawing(false);
    }
  }, [isDrawing, lastPosition, currentColor, rectangleStartPoint, ellipseStartPoint, redrawCanvas]);

  /**
   * Completes the current drawing stroke and saves it to the command history.
   * Normalizes coordinates to percentages for resolution independence.
   * Only saves strokes with more than one point (actual drawing occurred).
   */
  const stopDrawing = useCallback(() =>
  {
    if (!isDrawing) return;

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

      const command: DrawingCommand = {
        type: 'rectangle',
        points: [normalizedStartPoint, normalizedEndPoint],
        color: currentColor,
        lineWidth: CONFIG.drawing.lineWidth,
        hasArrowHead: false,
      };

      drawingCommandsRef.current.push(command);
      console.log('Rectangle saved:', command, 'Total commands:', drawingCommandsRef.current.length);
      setRectangleStartPoint(null);
    }
    // ELLIPSE:
    else if (currentModeRef.current === 'ellipse' && ellipseStartPoint)
    {
      // For ellipse mode, save the ellipse as a command
      const normalizedStartPoint = normalizePoint(ellipseStartPoint, canvas);
      const normalizedEndPoint = normalizePoint(lastPosition, canvas);

      const command: DrawingCommand = {
        type: 'ellipse',
        points: [normalizedStartPoint, normalizedEndPoint],
        color: currentColor,
        lineWidth: CONFIG.drawing.lineWidth,
        hasArrowHead: false,
      };

      drawingCommandsRef.current.push(command);
      console.log('Ellipse saved:', command, 'Total commands:', drawingCommandsRef.current.length);
      setEllipseStartPoint(null);
    }
    // LINE:
    else if (currentStrokeRef.current.length > 1)
    {
      // For line/arrow modes, save the stroke
      // Normalize points to percentages before storing
      const normalizedPoints = currentStrokeRef.current.map(point => normalizePoint(point, canvas));

      // Draw arrow head at the end of the current stroke only if in arrow mode
      if (currentModeRef.current === 'arrow' && currentStrokeRef.current.length >= 2)
      {
        // Use the last 10% of points to calculate arrow direction
        const totalPoints = currentStrokeRef.current.length;
        const startIndex = Math.max(0, Math.floor(totalPoints * 0.9));
        const startPoint = currentStrokeRef.current[startIndex];
        const lastPoint = currentStrokeRef.current[currentStrokeRef.current.length - 1];
        drawArrowHead(ctx, startPoint, lastPoint, CONFIG.drawing.colors[currentColor], CONFIG.drawing.lineWidth);
      }

      // Save the completed stroke as a command with normalized coordinates
      const command: DrawingCommand = {
        type: 'stroke',
        points: normalizedPoints,
        color: currentColor,
        lineWidth: CONFIG.drawing.lineWidth,
        hasArrowHead: currentModeRef.current === 'arrow',
      };

      drawingCommandsRef.current.push(command);
      currentStrokeRef.current = [];
    }

    setIsDrawing(false);
  }, [isDrawing, currentColor, rectangleStartPoint, ellipseStartPoint, lastPosition]);

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
    drawingCommandsRef.current = [];
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

  return {
    canvasRef,
    currentColor,
    currentMode,
    isDrawing,
    startDrawing,
    draw,
    stopDrawing,
    clearCanvas,
    changeColor,
    changeMode,
  };
};
