import React, { useEffect, useRef } from 'react';
import './Modal.css';

interface ModalProps
{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  className = '',
  size = 'md',
}) =>
{
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() =>
  {
    const handleKeyDown = (e: KeyboardEvent) =>
    {
      if (e.key === 'Escape')
      {
        onClose();
      }
    };

    if (isOpen)
    {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }
    else
    {
      document.body.style.overflow = 'auto';
    }

    return () =>
    {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'auto';
    };
  }, [isOpen, onClose]);

  // Focus the modal only when it first opens
  useEffect(() =>
  {
    if (isOpen && modalRef.current)
    {
      modalRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBackdropMouseDown = (e: React.MouseEvent) =>
  {
    if (e.target === e.currentTarget)
    {
      onClose();
    }
  };

  return (
    <div className='modal-overlay' onMouseDown={handleBackdropMouseDown}>
      <div
        ref={modalRef}
        className={`modal-content modal-${size} ${className}`}
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        <div className='modal-header'>
          <h2 className='modal-title'>{title}</h2>
          <button
            onClick={onClose}
            className='modal-close-button'
            aria-label='Close modal'
          >
            ✕
          </button>
        </div>
        <div className='modal-body'>
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
