// Define base properties common to all drawing elements
interface Stroke
{
  points: { x: number; y: number; }[];
  strokeColor: string;
  strokeStyle: 'solid' | 'dashed';
  strokeOpacity?: number; // Optional stroke opacity (0-1, undefined = 1.0)
}

// Define shape-specific properties for closed paths that can be filled
interface Shape extends Stroke
{
  fillOpacity?: number; // Optional fill opacity (0-1, undefined = no fill)
  fillColor?: string; // Optional separate fill color
}

// Define specific drawing element types using discriminated unions
interface Line extends Stroke
{
  type: 'stroke';
  hasArrowHead: boolean;
}

interface Rectangle extends Shape
{
  type: 'rectangle';
  // Points are used to define the bounding rectangle for the rectangle
  // Exactly 2 points that define the top-left and bottom-right corners
}

interface Ellipse extends Shape
{
  type: 'ellipse';
  // Points are used to define the bounding rectangle for the ellipse
  // Exactly 2 points that define the top-left and bottom-right corners
}

// Union type for all drawing elements
export type Drawing = Line | Rectangle | Ellipse;

// Type for recording start event data
export interface RecordingStartEventData {
  // Video transport controls
  playbackSpeed: number;
  videoTimestamp: number;
  
  // Canvas state
  existingDrawings: Drawing[];
}

// Type guards for better type narrowing
export const isShape = (element: Drawing): element is Rectangle | Ellipse =>
{
  return element.type === 'rectangle' || element.type === 'ellipse';
};

export const isStroke = (element: Drawing): element is Line =>
{
  return element.type === 'stroke';
};
