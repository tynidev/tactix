import React from 'react';
import './YouTubePlayer.css';

interface YouTubePlayerProps
{
  className?: string;
}

const YouTubePlayer: React.FC<YouTubePlayerProps> = ({ className = '' }) =>
{
  return (
    <div className={`youtube-player-wrapper ${className}`}>
      <div id='youtube-player'></div>
    </div>
  );
};

export default YouTubePlayer;
