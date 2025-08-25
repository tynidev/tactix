import React from 'react';
import './HTML5Player.css';

interface HTML5PlayerProps
{
  className?: string;
  children?: React.ReactNode; // Allow transport control to be passed as children
}

const HTML5Player: React.FC<HTML5PlayerProps> = ({ className = '', children }) =>
{
  return (
    <div className={`html5-player-wrapper ${className}`}>
      <video
        id='html5-player'
        className='html5-video-element'
      />
      {children}
    </div>
  );
};

export default HTML5Player;
