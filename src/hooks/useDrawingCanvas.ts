import { useEffect, useState, useCallback, useRef } from 'react';
import { CONFIG, type DrawingColor } from '../types/config';

// Define event types for drawing
type DrawingMouseEvent = React.MouseEvent<HTMLCanvasElement>;
type DrawingTouchEvent = React.TouchEvent<HTMLCanvasElement>;
type DrawingEvent = DrawingMouseEvent | DrawingTouchEvent;

// Define drawing command types with normalized coordinates
interface DrawingCommand {
  type: 'stroke';
  points: { x: number; y: number }[]; // Stored as percentages (0-1)
  color: DrawingColor;
  lineWidth: number;
}

// Normalize coordinates to percentages for scaling
const normalizePoint = (point: { x: number; y: number }, canvas: HTMLCanvasElement) => ({
  x: point.x / canvas.width,
  y: point.y / canvas.height
});

const denormalizePoint = (point: { x: number; y: number }, canvas: HTMLCanvasElement) => ({
  x: point.x * canvas.width,
  y: point.y * canvas.height
});

export const useDrawingCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentColorRef = useRef<DrawingColor>('red');
  const drawingCommandsRef = useRef<DrawingCommand[]>([]);
  const currentStrokeRef = useRef<{ x: number; y: number }[]>([]);
  const resizeTimeoutRef = useRef<number>();
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentColor, setCurrentColor] = useState<DrawingColor>('red');
  const [lastPosition, setLastPosition] = useState({ x: 0, y: 0 });

  // Redraw all commands at current canvas size
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Set default properties
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Redraw all stored commands using denormalized coordinates
    drawingCommandsRef.current.forEach(command => {
      if (command.type === 'stroke' && command.points.length > 1) {
        ctx.strokeStyle = CONFIG.drawing.colors[command.color];
        ctx.lineWidth = command.lineWidth;
        
        ctx.beginPath();
        const firstPoint = denormalizePoint(command.points[0], canvas);
        ctx.moveTo(firstPoint.x, firstPoint.y);
        
        for (let i = 1; i < command.points.length; i++) {
          const point = denormalizePoint(command.points[i], canvas);
          ctx.lineTo(point.x, point.y);
        }
        
        ctx.stroke();
      }
    });
  }, []);

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas internal dimensions to match the display size
    const rect = canvas.getBoundingClientRect();
    
    // Only set dimensions if they're not already set or if they're different
    if (canvas.width !== rect.width || canvas.height !== rect.height) {
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

  const updateCanvasProperties = useCallback(() => {
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

  const debouncedResize = useCallback(() => {
    if (resizeTimeoutRef.current) {
      clearTimeout(resizeTimeoutRef.current);
    }
    
    resizeTimeoutRef.current = window.setTimeout(() => {
      setupCanvas();
    }, 100); // Debounce resize operations by 100ms
  }, [setupCanvas]);

  useEffect(() => {
    setupCanvas();
    
    const handleResize = () => debouncedResize();
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, []); // Only run once on mount

  // Track canvas size changes (when video dimensions change)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeObserver = new ResizeObserver(() => {
      // Use debounced resize for video dimension changes too
      debouncedResize();
    });

    resizeObserver.observe(canvas);

    return () => {
      resizeObserver.disconnect();
    };
  }, [debouncedResize]);

  // Separate effect for updating canvas properties when color changes
  useEffect(() => {
    updateCanvasProperties();
  }, [currentColor]); // Only depend on currentColor directly

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, []);

  const startDrawing = useCallback((e: DrawingEvent ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    
    let clientX: number, clientY: number;
    if ('touches' in e) {
      if (e.touches.length === 0) return;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    // Start a new stroke
    currentStrokeRef.current = [{ x, y }];
    setLastPosition({ x, y });
  }, []);

  const draw = useCallback((e: DrawingEvent ) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();
    
    let clientX: number, clientY: number;
    if ('touches' in e) {
      if (e.touches.length === 0) return;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const currentX = clientX - rect.left;
    const currentY = clientY - rect.top;

    try {
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
    } catch (error) {
      console.error('Drawing error:', error);
      setIsDrawing(false);
    }
  }, [isDrawing, lastPosition, currentColor]);

  const stopDrawing = useCallback(() => {
    if (isDrawing && currentStrokeRef.current.length > 1) {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Normalize points to percentages before storing
      const normalizedPoints = currentStrokeRef.current.map(point => 
        normalizePoint(point, canvas)
      );

      // Save the completed stroke as a command with normalized coordinates
      const command: DrawingCommand = {
        type: 'stroke',
        points: normalizedPoints,
        color: currentColor,
        lineWidth: CONFIG.drawing.lineWidth
      };
      
      drawingCommandsRef.current.push(command);
      currentStrokeRef.current = [];
    }
    
    setIsDrawing(false);
  }, [isDrawing, currentColor]);

  const clearCanvas = useCallback(() => {
    console.log('Clearing canvas');
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) {
      console.log('Canvas or context not available');
      return;
    }

    // Clear stored commands
    drawingCommandsRef.current = [];
    currentStrokeRef.current = [];
    
    // Clear visual canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    console.log('Canvas cleared');
  }, []);

  const changeColor = useCallback((color: DrawingColor) => {
    console.log('Changing color to:', color);
    currentColorRef.current = color; // Update ref immediately
    setCurrentColor(color);
    // Canvas properties will be updated automatically by the useEffect
  }, []);

  return {
    canvasRef,
    currentColor,
    isDrawing,
    startDrawing,
    draw,
    stopDrawing,
    clearCanvas,
    changeColor
  };
};
