import React from 'react';
import { FaArrowLeft } from 'react-icons/fa';
import type { Game } from '../types/gameAnalysisTypes';

interface Props
{
  game: Game;
  isFlyoutExpanded?: boolean;
}

const GameHeader: React.FC<Props> = ({ game, isFlyoutExpanded }) =>
{
  return (
    <div className='game-header' data-game-id={game.id}>
      <button
        onClick={() => window.history.back()}
        className={`circular-back-button ${isFlyoutExpanded ? 'under-flyout' : ''}`}
        title='Back'
      >
        <FaArrowLeft />
      </button>
      {/* Optional: show game info here if desired */}
      {/* <div className="game-info">{game.title || game.id}</div> */}
    </div>
  );
};

export default GameHeader;
