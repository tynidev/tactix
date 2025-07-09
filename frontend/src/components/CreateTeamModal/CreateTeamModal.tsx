import React, { useEffect, useState } from 'react';
import { getApiUrl } from '../../utils/api';
import { Modal } from '../Modal';
import './CreateTeamModal.css';

interface CreateTeamModalProps
{
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  teamToEdit?: {
    id: string;
    name: string;
  } | null;
}

export const CreateTeamModal: React.FC<CreateTeamModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  teamToEdit = null,
}) =>
{
  const [teamName, setTeamName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const isEditing = Boolean(teamToEdit);

  // Reset form when modal opens/closes or when teamToEdit changes
  useEffect(() =>
  {
    if (isOpen)
    {
      setTeamName(teamToEdit?.name || '');
      setError('');
      setSuccess('');
    }
    else
    {
      setTeamName('');
      setError('');
      setSuccess('');
    }
  }, [isOpen, teamToEdit]);

  const handleSubmit = async (e: React.FormEvent) =>
  {
    e.preventDefault();

    if (!teamName.trim())
    {
      setError('Team name is required');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try
    {
      const token = (await import('../../lib/supabase')).supabase.auth.getSession();
      const session = await token;

      if (!session.data.session?.access_token)
      {
        throw new Error('No access token');
      }

      const apiUrl = getApiUrl();
      const url = isEditing ? `${apiUrl}/api/teams/${teamToEdit!.id}` : `${apiUrl}/api/teams`;
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${session.data.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: teamName.trim() }),
      });

      if (!response.ok)
      {
        throw new Error(isEditing ? 'Failed to update team' : 'Failed to create team');
      }

      const successMessage = isEditing ? 'Team updated successfully!' : 'Team created successfully!';
      setSuccess(successMessage);

      // Call onSuccess after a short delay to show success message
      setTimeout(() =>
      {
        onSuccess();
        handleClose();
      }, 1500);
    }
    catch (err)
    {
      setError(err instanceof Error ? err.message : (isEditing ? 'Failed to update team' : 'Failed to create team'));
    }
    finally
    {
      setLoading(false);
    }
  };

  const handleClose = () =>
  {
    setTeamName('');
    setError('');
    setSuccess('');
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) =>
  {
    if (e.key === 'Enter' && !loading && teamName.trim())
    {
      handleSubmit(e as any);
    }
  };

  const title = isEditing ? 'Edit Team' : 'Create Team';

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      size='sm'
      className='create-team-modal'
    >
      <form onSubmit={handleSubmit} className='form'>
        {error && <div className='alert alert-error'>{error}</div>}
        {success && <div className='alert alert-success'>{success}</div>}

        <div className='form-group'>
          <label htmlFor='team-name' className='form-label'>
            Team Name *
          </label>
          <input
            id='team-name'
            type='text'
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            className='form-input'
            placeholder='Enter team name'
            maxLength={100}
            onKeyDown={handleKeyDown}
            autoFocus
            disabled={loading}
          />
          <div className='form-help'>
            Choose a name that's easy to recognize for your players and coaches.
          </div>
        </div>

        <div className='form-actions'>
          <button
            type='button'
            onClick={handleClose}
            className='btn btn-secondary'
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type='submit'
            className='btn btn-primary'
            disabled={loading || !teamName.trim()}
          >
            {loading ?
              (isEditing ? 'Updating...' : 'Creating...') :
              (isEditing ? 'Update Team' : 'Create Team')}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default CreateTeamModal;
