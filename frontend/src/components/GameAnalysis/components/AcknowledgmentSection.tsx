import React from 'react';
import { FaCheck, FaSpinner } from 'react-icons/fa';
import type { GuardianPlayer } from '../hooks/useGuardianPlayers';

export interface AcknowledgmentProps
{
  userRole: 'coach' | 'player' | 'admin' | 'guardian' | string;
  guardianPlayers: GuardianPlayer[];
  selectedPlayerId: string | null;
  onSelectPlayer: (id: string | null) => void;
  isLoadingGuardianPlayers: boolean;
  guardianPlayersError: string | null;

  acknowledgmentError: string | null;
  acknowledgmentDate: string | null; // ISO string or null
  acknowledgedValue: boolean;
  notesValue: string;
  isSavingAcknowledgment: boolean;
  hasUnsavedChanges: boolean;
  saveSuccess: boolean;

  onAcknowledgedChange: (ack: boolean) => void;
  onNotesChange: (notes: string) => void;
  onSave: () => void;
}

export const AcknowledgmentSection: React.FC<AcknowledgmentProps> = ({
  userRole,
  guardianPlayers,
  selectedPlayerId,
  onSelectPlayer,
  isLoadingGuardianPlayers,
  guardianPlayersError,
  acknowledgmentError,
  acknowledgmentDate,
  acknowledgedValue,
  notesValue,
  isSavingAcknowledgment,
  hasUnsavedChanges,
  saveSuccess,
  onAcknowledgedChange,
  onNotesChange,
  onSave,
}) =>
{
  return (
    <div className='acknowledgment-section'>
      <h5>Acknowledgment:</h5>

      {/* Player Selection for non-player roles */}
      {userRole !== 'player' && guardianPlayers.length > 0 && (
        <div className='guardian-player-selection'>
          <label htmlFor='player-select'>Acknowledge for:</label>
          {isLoadingGuardianPlayers ?
            (
              <div className='loading-players'>
                <FaSpinner className='spinning' /> Loading your players...
              </div>
            ) :
            guardianPlayersError ?
            (
              <div className='players-error'>
                ❌ {guardianPlayersError}
              </div>
            ) :
            guardianPlayers.length === 1 ?
            (
              <div className='single-player-display'>
                <strong>
                  {guardianPlayers[0].name}
                  {guardianPlayers[0].jersey_number && ` (#${guardianPlayers[0].jersey_number})`}
                </strong>
              </div>
            ) :
            (
              <select
                id='player-select'
                value={selectedPlayerId || ''}
                onChange={(e) => onSelectPlayer(e.target.value || null)}
                disabled={isSavingAcknowledgment}
              >
                {guardianPlayers.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name}
                    {player.jersey_number && ` (#${player.jersey_number})`}
                  </option>
                ))}
              </select>
            )}
        </div>
      )}

      {acknowledgmentError && (
        <div className='acknowledgment-error'>
          ❌ {acknowledgmentError}
        </div>
      )}

      <div className='acknowledgment-controls'>
        <label className='acknowledgment-checkbox'>
          <input
            type='checkbox'
            checked={acknowledgedValue}
            onChange={(e) => onAcknowledgedChange(e.target.checked)}
            disabled={isSavingAcknowledgment}
          />
          <span className='checkmark'>{acknowledgedValue && <FaCheck />}</span>
          <span className='checkbox-label'>I have watched and understood this coaching point</span>
        </label>

        {acknowledgmentDate && (
          <div className='acknowledgment-date'>
            Acknowledged on {new Date(acknowledgmentDate).toLocaleString()}
          </div>
        )}
      </div>

      <div className='notes-section'>
        <label htmlFor='acknowledgment-notes'>Notes (optional):</label>
        <textarea
          id='acknowledgment-notes'
          value={notesValue}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder='What did you learn from this coaching point? (1024 characters max)'
          maxLength={1024}
          rows={3}
          disabled={isSavingAcknowledgment}
        />
        <div className='character-count'>{notesValue.length}/1024 characters</div>
      </div>

      {/* Save Button and Status */}
      <div className='save-section'>
        <button
          onClick={onSave}
          className={`btn ${hasUnsavedChanges ? 'btn-primary' : 'btn-secondary'}`}
          disabled={isSavingAcknowledgment || !hasUnsavedChanges}
          title={hasUnsavedChanges ? 'Save acknowledgment and notes' : 'No changes to save'}
        >
          {isSavingAcknowledgment ?
            (
              <>
                <FaSpinner className='spinning' /> Saving...
              </>
            ) :
            (
              <>
                <FaCheck /> Save
              </>
            )}
        </button>

        {hasUnsavedChanges && !isSavingAcknowledgment && (
          <div className='unsaved-changes'>⚠️ You have unsaved changes</div>
        )}

        {saveSuccess && <div className='save-success'>✅ Saved successfully!</div>}
      </div>
    </div>
  );
};

export default AcknowledgmentSection;
