import React from 'react';
import type { CoachingPoint } from '../types/gameAnalysisTypes';
import { formatTime } from '../utils/time';

interface Props
{
  point: CoachingPoint;
}

const CoachingPointDetails: React.FC<Props> = ({ point }) =>
{
  return (
    <div className='coaching-point-details'>
      <h4 className='point-title'>{point.title}</h4>
      <div className='point-meta'>
        <span className='point-timestamp'>{formatTime(parseInt(point.timestamp) / 1000)}</span>
        <span className='point-author'>by {point.author?.name || 'Unknown'}</span>
      </div>
      <div className='point-feedback'>
        <h5>Feedback:</h5>
        <p>{point.feedback}</p>
      </div>

      {point.coaching_point_tagged_players && point.coaching_point_tagged_players.length > 0 && (
        <div>
          <h5 style={{ margin: '6px 0px 0px 0px' }}>Tagged Players:</h5>
          <div className='point-players'>
            <div className='player-tags'>
              {point.coaching_point_tagged_players.map((taggedPlayer) => (
                <span key={taggedPlayer.id} className='player-tag'>
                  {taggedPlayer.player_profiles.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {point.coaching_point_labels && point.coaching_point_labels.length > 0 && (
        <div>
          <h5 style={{ margin: '6px 0px 0px 0px' }}>Labels:</h5>
          <div className='point-labels'>
            <div className='label-tags'>
              {point.coaching_point_labels.map((labelAssignment) => (
                <span key={labelAssignment.id} className='label-tag'>
                  {labelAssignment.labels.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CoachingPointDetails;
