import { CONFIG } from '../types/config';

// Define base properties common to all drawing elements
interface Stroke {
  points: { x: number; y: number; }[];
  strokeColor: string;
  strokeStyle: 'solid' | 'dashed';
  strokeOpacity?: number; // Optional stroke opacity (0-1, undefined = 1.0)
}

// Define shape-specific properties for closed paths that can be filled
interface Shape extends Stroke {
  fillOpacity?: number; // Optional fill opacity (0-1, undefined = no fill)
  fillColor?: string; // Optional separate fill color
}

// Define specific drawing element types using discriminated unions
interface Line extends Stroke {
  type: 'stroke';
  hasArrowHead: boolean;
}

interface Rectangle extends Shape {
  type: 'rectangle';
  // Points are used to define the bounding rectangle for the rectangle
  // Exactly 2 points that define the top-left and bottom-right corners
}

interface Ellipse extends Shape {
  type: 'ellipse';
  // Points are used to define the bounding rectangle for the ellipse
  // Exactly 2 points that define the top-left and bottom-right corners
}

// Union type for all drawing elements
export type Drawing = Line | Rectangle | Ellipse;

// Type guards for better type narrowing
export const isShape = (element: Drawing): element is Rectangle | Ellipse => {
  return element.type === 'rectangle' || element.type === 'ellipse';
};

export const isStroke = (element: Drawing): element is Line => {
  return element.type === 'stroke';
};

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
 * Draws an arrow head at the end of a line.
 *
 * @param ctx - The canvas 2D rendering context
 * @param from - The point the arrow is coming from
 * @param to - The point where the arrow head should be drawn
 * @param color - The color of the arrow head
 * @param lineWidth - The width of the line (used to size the arrow head)
 * @param canvas - The canvas element to calculate scaled arrow length
 */
export const drawArrowHead = (
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number; },
  to: { x: number; y: number; },
  color: string,
  lineWidth: number,
  canvas: HTMLCanvasElement,
) => {
  // Scale arrow length based on canvas dimensions, similar to line width scaling
  const minDimension = Math.min(canvas.width, canvas.height);
  const scaledArrowLength = minDimension * CONFIG.drawing.lineWidth * 5; // 5x the line width percentage
  const arrowLength = Math.max(scaledArrowLength, lineWidth * 3); // Fallback to lineWidth-based sizing

  // Calculate the angle of the line from start to end point for arrow orientation
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const angle = Math.atan2(dy, dx);

  // Pre-calculate sine and cosine values to avoid repeated calculations
  const cos45 = 0.7071067811865476; // Math.cos(Math.PI / 4)
  const sin45 = 0.7071067811865476; // Math.sin(Math.PI / 4)

  const cosAngle = Math.cos(angle);
  const sinAngle = Math.sin(angle);

  // Calculate arrow head points using rotation matrix
  const arrowPoint1 = {
    x: to.x - arrowLength * (cosAngle * cos45 + sinAngle * sin45),
    y: to.y - arrowLength * (sinAngle * cos45 - cosAngle * sin45),
  };
  const arrowPoint2 = {
    x: to.x - arrowLength * (cosAngle * cos45 - sinAngle * sin45),
    y: to.y - arrowLength * (sinAngle * cos45 + cosAngle * sin45),
  };

  // Set line properties
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
 * @param strokeColor - The color of the rectangle stroke
 * @param lineWidth - The width of the lines
 * @param lineStyle - The style of the lines ('solid' or 'dashed')
 * @param strokeOpacity - Optional stroke opacity (0-1, undefined = 1.0)
 * @param fillOpacity - Optional opacity for fill (0 = no fill, 1 = opaque)
 * @param fillColor - Optional separate fill color
 */
export const drawRectangle = (
  ctx: CanvasRenderingContext2D,
  startPoint: { x: number; y: number; },
  endPoint: { x: number; y: number; },
  strokeColor: string,
  lineWidth: number,
  lineStyle: 'solid' | 'dashed' = 'solid',
  strokeOpacity: number = 1.0,
  fillOpacity?: number,
  fillColor?: string,
) => {
  const width = endPoint.x - startPoint.x;
  const height = endPoint.y - startPoint.y;

  // Draw fill first (if specified)
  if (fillOpacity !== undefined && fillOpacity > 0) {
    const originalAlpha = ctx.globalAlpha;
    ctx.globalAlpha = fillOpacity;
    ctx.fillStyle = fillColor || strokeColor;
    ctx.fillRect(startPoint.x, startPoint.y, width, height);
    ctx.globalAlpha = originalAlpha; // Reset alpha
  }

  // Draw stroke
  const originalAlpha = ctx.globalAlpha;
  ctx.globalAlpha = strokeOpacity;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = lineWidth;
  
  // Set line dash pattern
  if (lineStyle === 'dashed') {
    ctx.setLineDash([lineWidth * 3, lineWidth * 2]);
  } else {
    ctx.setLineDash([]);
  }

  ctx.beginPath();
  ctx.rect(startPoint.x, startPoint.y, width, height);
  ctx.stroke();
  ctx.globalAlpha = originalAlpha; // Reset alpha
};

/**
 * Draws an ellipse from two corner points defining the bounding rectangle.
 *
 * @param ctx - The canvas 2D rendering context
 * @param startPoint - The starting corner point
 * @param endPoint - The ending corner point
 * @param strokeColor - The color of the ellipse stroke
 * @param lineWidth - The width of the lines
 * @param lineStyle - The style of the lines ('solid' or 'dashed')
 * @param strokeOpacity - Optional stroke opacity (0-1, undefined = 1.0)
 * @param fillOpacity - Optional opacity for fill (0 = no fill, 1 = opaque)
 * @param fillColor - Optional separate fill color
 */
export const drawEllipse = (
  ctx: CanvasRenderingContext2D,
  startPoint: { x: number; y: number; },
  endPoint: { x: number; y: number; },
  strokeColor: string,
  lineWidth: number,
  lineStyle: 'solid' | 'dashed' = 'solid',
  strokeOpacity: number = 1.0,
  fillOpacity?: number,
  fillColor?: string,
) => {
  const centerX = (startPoint.x + endPoint.x) / 2;
  const centerY = (startPoint.y + endPoint.y) / 2;
  const radiusX = Math.abs(endPoint.x - startPoint.x) / 2;
  const radiusY = Math.abs(endPoint.y - startPoint.y) / 2;

  // Draw fill first (if specified)
  if (fillOpacity !== undefined && fillOpacity > 0) {
    const originalAlpha = ctx.globalAlpha;
    ctx.globalAlpha = fillOpacity;
    ctx.fillStyle = fillColor || strokeColor;
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
    ctx.fill();
    ctx.globalAlpha = originalAlpha; // Reset alpha
  }

  // Draw stroke
  const originalAlpha = ctx.globalAlpha;
  ctx.globalAlpha = strokeOpacity;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = lineWidth;
  
  // Set line dash pattern
  if (lineStyle === 'dashed') {
    ctx.setLineDash([lineWidth * 3, lineWidth * 2]);
  } else {
    ctx.setLineDash([]);
  }

  ctx.beginPath();
  ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
  ctx.stroke();
  ctx.globalAlpha = originalAlpha; // Reset alpha
};

/**
 * Draws a drawing element on the canvas using type-safe polymorphism
 */
export const drawElement = (
  ctx: CanvasRenderingContext2D,
  element: Drawing,
  canvas: HTMLCanvasElement
): void => {
  const scaledLineWidth = getScaledLineWidth(canvas);
  const color = element.strokeColor;
  const strokeOpacity = element.strokeOpacity ?? 1.0;

  // TypeScript automatically narrows the type based on the discriminator
  switch (element.type) {
    case 'stroke':
      drawStrokeElement(ctx, element, color, scaledLineWidth, strokeOpacity, canvas);
      break;
    case 'rectangle':
      drawShapeElement(ctx, element, color, scaledLineWidth, strokeOpacity, canvas);
      break;
    case 'ellipse':
      drawShapeElement(ctx, element, color, scaledLineWidth, strokeOpacity, canvas);
      break;
    default:
      // TypeScript ensures this is exhaustive - will error if you miss a case
      const _exhaustive: never = element;
      throw new Error(`Unknown element type: ${(_exhaustive as any).type}`);
  }
};

const drawStrokeElement = (
  ctx: CanvasRenderingContext2D,
  element: Line, // TypeScript knows this is a Stroke
  color: string,
  lineWidth: number,
  strokeOpacity: number,
  canvas: HTMLCanvasElement
): void => {
  if (element.points.length < 2) return;

  // Set stroke opacity
  const originalAlpha = ctx.globalAlpha;
  ctx.globalAlpha = strokeOpacity;

  // Set line dash pattern
  if (element.strokeStyle === 'dashed') {
    ctx.setLineDash([lineWidth * 3, lineWidth * 2]);
  } else {
    ctx.setLineDash([]);
  }

  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  
  const firstPoint = denormalizePoint(element.points[0], canvas);
  ctx.moveTo(firstPoint.x, firstPoint.y);

  for (let i = 1; i < element.points.length; i++) {
    const point = denormalizePoint(element.points[i], canvas);
    ctx.lineTo(point.x, point.y);
  }

  ctx.stroke();
  ctx.globalAlpha = originalAlpha; // Reset alpha

  // Draw arrow head if needed
  if (element.hasArrowHead) {
    const totalPoints = element.points.length;
    const startIndex = Math.max(0, Math.floor(totalPoints * 0.9));
    const startPoint = denormalizePoint(element.points[startIndex], canvas);
    const lastPoint = denormalizePoint(element.points[element.points.length - 1], canvas);
    
    // Reset alpha for arrow head
    ctx.globalAlpha = strokeOpacity;
    drawArrowHead(ctx, startPoint, lastPoint, color, lineWidth, canvas);
    ctx.globalAlpha = originalAlpha; // Reset alpha
  }
};

const drawShapeElement = (
  ctx: CanvasRenderingContext2D,
  element: Rectangle | Ellipse, // TypeScript knows these are shapes
  color: string,
  lineWidth: number,
  strokeOpacity: number,
  canvas: HTMLCanvasElement
): void => {
  const startPoint = denormalizePoint(element.points[0], canvas);
  const endPoint = denormalizePoint(element.points[1], canvas);
  
  // Use fillColor directly if specified, otherwise use stroke color
  const fillColor = element.fillColor || color;

  switch (element.type) {
    case 'rectangle':
      drawRectangle(
        ctx, 
        startPoint, 
        endPoint, 
        color, 
        lineWidth, 
        element.strokeStyle, 
        strokeOpacity,
        element.fillOpacity, 
        fillColor
      );
      break;
    case 'ellipse':
      drawEllipse(
        ctx, 
        startPoint, 
        endPoint, 
        color, 
        lineWidth, 
        element.strokeStyle, 
        strokeOpacity,
        element.fillOpacity, 
        fillColor
      );
      break;
  }
};
