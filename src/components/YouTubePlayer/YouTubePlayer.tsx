import React from 'react';
import './YouTubePlayer.css';

interface YouTubePlayerProps {
  className?: string;
}

const YouTubePlayer: React.FC<YouTubePlayerProps> = ({ className = '' }) => {
  return (
    <div className={`video-container ${className}`}>
      <div id="youtube-player"></div>
    </div>
  );
};

export default YouTubePlayer;
