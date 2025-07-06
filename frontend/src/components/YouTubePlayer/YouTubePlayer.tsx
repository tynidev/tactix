import React from 'react';
import './YouTubePlayer.css';

interface YouTubePlayerProps
{
  className?: string;
  children?: React.ReactNode; // Allow transport control to be passed as children
}

const YouTubePlayer: React.FC<YouTubePlayerProps> = ({ className = '', children }) =>
{
  return (
    <div className={`youtube-player-wrapper ${className}`}>
      <div id='youtube-player'></div>
      {children}
    </div>
  );
};

export default YouTubePlayer;
