import React, { useEffect } from 'react';
import { Modal } from '../Modal/Modal';
import './ConfirmationDialog.css';

interface ConfirmationDialogProps
{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmButtonText?: string;
  cancelButtonText?: string;
  variant?: 'danger' | 'warning' | 'info';
  loading?: boolean;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmButtonText = 'Confirm',
  cancelButtonText = 'Cancel',
  variant = 'danger',
  loading = false,
}) =>
{
  useEffect(() =>
  {
    const handleKeyDown = (e: KeyboardEvent) =>
    {
      if (!isOpen) return;

      if (e.key === 'Enter' && !loading)
      {
        e.preventDefault();
        onConfirm();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onConfirm, loading]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size='sm'
      className='confirmation-dialog'
    >
      <div className='confirmation-content'>
        <div className={`confirmation-icon confirmation-icon-${variant}`}>
          {variant === 'danger' && '⚠️'}
          {variant === 'warning' && '⚠️'}
          {variant === 'info' && 'ℹ️'}
        </div>
        <p className='confirmation-message'>{message}</p>
        <div className='confirmation-actions'>
          <button
            onClick={onClose}
            className='btn btn-secondary'
            disabled={loading}
          >
            {cancelButtonText}
          </button>
          <button
            onClick={onConfirm}
            className={`btn btn-${variant} confirmation-confirm-btn`}
            disabled={loading}
          >
            {loading ? 'Processing...' : confirmButtonText}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmationDialog;
