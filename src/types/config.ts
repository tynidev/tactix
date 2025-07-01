export interface Config
{
  drawing: {
    defaultColor: string;
    lineWidth: number;
    colors: {
      color1: string;
      color2: string;
      color3: string;
    };
  };
  video: {
    defaultVideoId: string;
    seekAmount: number;
    playbackRates: {
      slow: number;
      normal: number;
      fast: number;
    };
  };
  keyboard: {
    colorKeys: string[];
    modeKeys: string[];
    eraseKeys: string[];
    playPauseKeys: string[];
    rewindKeys: string[];
    forwardKeys: string[];
    speedUpKeys: string[];
    speedDownKeys: string[];
  };
}

export const CONFIG: Config = {
  drawing: {
    defaultColor: '#EF4444',
    lineWidth: 8,
    colors: {
      color1: '#EF4444',
      color2: '#faf615',
      color3: '#3B82F6',
    },
  },
  video: {
    defaultVideoId: 'CoFBQyle37A',
    seekAmount: 10,
    playbackRates: {
      slow: 0.5,
      normal: 1,
      fast: 2,
    },
  },
  keyboard: {
    colorKeys: ['1', '2', '3'],
    modeKeys: ['4', '5', '6', '7'],
    eraseKeys: ['e', 'c'],
    playPauseKeys: [' '],
    rewindKeys: ['a', 'ArrowLeft'],
    forwardKeys: ['d', 'ArrowRight'],
    speedUpKeys: ['w', 'ArrowUp'],
    speedDownKeys: ['s', 'ArrowDown'],
  },
};

export type DrawingColor = 'color1' | 'color2' | 'color3';
export type DrawingMode = 'arrow' | 'line' | 'rectangle' | 'ellipse';
