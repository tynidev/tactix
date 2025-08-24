import React from 'react';
import type { GuardianPlayer } from '../hooks/useGuardianPlayers';
import type { CoachingPoint } from '../types/gameAnalysisTypes';
import AcknowledgmentSection from './AcknowledgmentSection';
import CoachingPointDetails from './CoachingPointDetails';
import CoachingPointPlaybackControls from './CoachingPointPlaybackControls';
import CoachingPointSidebarHeader from './CoachingPointSidebarHeader';

interface Props
{
  point: CoachingPoint;
  isCoach: boolean;
  onEdit: () => void;
  onClose: () => void;
  // Acknowledgment
  userRole: string;
  guardianPlayers: GuardianPlayer[];
  selectedPlayerId: string | null;
  onSelectPlayer: (id: string | null) => void;
  isLoadingGuardianPlayers: boolean;
  guardianPlayersError: string | null;
  acknowledgmentError: string | null;
  acknowledgmentDate: string | null;
  acknowledgedValue: boolean;
  notesValue: string;
  isSavingAcknowledgment: boolean;
  hasUnsavedChanges: boolean;
  saveSuccess: boolean;
  onAcknowledgedChange: (value: boolean) => void;
  onNotesChange: (value: string) => void;
  onSave: () => void;
  // Playback
  showPlayback: boolean;
  playbackState: {
    isLoading: boolean;
    isPlaying: boolean;
    error: string | null;
    totalEvents: number;
    duration: number;
    currentTime: number;
    progress: number;
  };
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
}

const CoachingPointSidebar: React.FC<Props> = ({
  point,
  isCoach,
  onEdit,
  onClose,
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
  showPlayback,
  playbackState,
  onPlay,
  onPause,
  onStop,
}) =>
{
  return (
    <div className={`coaching-point-sidebar ${showPlayback && playbackState.isPlaying ? 'playback-active' : ''}`}>
      <CoachingPointSidebarHeader isCoach={isCoach} onEdit={onEdit} onClose={onClose} />
      <div className='sidebar-content'>
        <div>
          <CoachingPointDetails point={point} />

          {(userRole === 'player' || guardianPlayers.length > 0) && (
            <AcknowledgmentSection
              userRole={userRole}
              guardianPlayers={guardianPlayers}
              selectedPlayerId={selectedPlayerId}
              onSelectPlayer={onSelectPlayer}
              isLoadingGuardianPlayers={isLoadingGuardianPlayers}
              guardianPlayersError={guardianPlayersError}
              acknowledgmentError={acknowledgmentError}
              acknowledgmentDate={acknowledgmentDate}
              acknowledgedValue={acknowledgedValue}
              notesValue={notesValue}
              isSavingAcknowledgment={isSavingAcknowledgment}
              hasUnsavedChanges={hasUnsavedChanges}
              saveSuccess={saveSuccess}
              onAcknowledgedChange={onAcknowledgedChange}
              onNotesChange={onNotesChange}
              onSave={onSave}
            />
          )}

          {showPlayback && (
            <CoachingPointPlaybackControls
              state={playbackState}
              onPlay={onPlay}
              onPause={onPause}
              onStop={onStop}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default CoachingPointSidebar;
