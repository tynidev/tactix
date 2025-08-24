import React from 'react';
import { FaEdit } from 'react-icons/fa';

interface Props
{
  isCoach: boolean;
  onEdit: () => void;
  onClose: () => void;
}

const CoachingPointSidebarHeader: React.FC<Props> = ({ isCoach, onEdit, onClose }) =>
{
  return (
    <div className='sidebar-header'>
      <h3>Coaching Point Details</h3>
      <div className='sidebar-actions'>
        {isCoach && (
          <button
            onClick={onEdit}
            className='btn btn-primary btn-md'
            title='Edit coaching point'
            style={{ height: '37px', marginRight: '4px' }}
          >
            <FaEdit />
          </button>
        )}
        <button onClick={onClose} className='btn btn-secondary btn-md' title='Close details'>
          ✕
        </button>
      </div>
    </div>
  );
};

export default CoachingPointSidebarHeader;
