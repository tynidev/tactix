import React from 'react';

export interface PlayerEngagementData
{
  name: string;
  scorePercent: number;
  ackRatePercent: number;
  completionPercent: number;
  taggedAckRatePercent?: number;
  taggedCompletionPercent?: number;
  variant?: 'default' | 'low';
  className?: string;
}

export const PlayerEngagementSummaryCard: React.FC<PlayerEngagementData> = ({
  name,
  scorePercent,
  ackRatePercent,
  completionPercent,
  taggedAckRatePercent,
  taggedCompletionPercent,
  variant = 'default',
  className = '',
}) =>
{
  return (
    <div className={`player-engagement-card ${variant === 'low' ? 'low' : ''} ${className}`.trim()}>
      <div className='player-name-line'>
        <div className='player-name' style={{ marginBottom: 0 }}>{name}</div>
        <div className='player-score'>Score {scorePercent}%</div>
      </div>
      <div className='player-metrics'>
        All Points: Ack {ackRatePercent}% · Completion {completionPercent}%
      </div>
      {(taggedAckRatePercent !== undefined || taggedCompletionPercent !== undefined) && (
        <div className='player-metrics'>
          Tagged: Ack {taggedAckRatePercent || 0}% · Completion {taggedCompletionPercent || 0}%
        </div>
      )}
    </div>
  );
};

export default PlayerEngagementSummaryCard;
