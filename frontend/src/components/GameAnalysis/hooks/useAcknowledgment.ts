import { useCallback, useEffect, useState } from 'react';
import { getCoachingPointAcknowledgment, updateCoachingPointAcknowledgment } from '../../../utils/api';

export interface AcknowledgmentState
{
  acknowledged: boolean;
  ack_at: string | null;
  notes: string | null;
}

export interface UseAcknowledgmentReturn
{
  acknowledgment: AcknowledgmentState;
  notesValue: string;
  acknowledgedValue: boolean;
  isSavingAcknowledgment: boolean;
  acknowledgmentError: string | null;
  hasUnsavedChanges: boolean;
  saveSuccess: boolean;
  handleAcknowledgmentChange: (acknowledged: boolean) => void;
  handleNotesChange: (notes: string) => void;
  handleSaveAcknowledgment: () => Promise<void>;
}

export function useAcknowledgment(params: {
  selectedCoachingPointId: string | null;
  userRole?: 'coach' | 'player' | 'admin' | 'guardian';
  selectedPlayerId: string | null;
}): UseAcknowledgmentReturn
{
  const { selectedCoachingPointId, userRole, selectedPlayerId } = params;

  const [acknowledgment, setAcknowledgment] = useState<AcknowledgmentState>({
    acknowledged: false,
    ack_at: null,
    notes: null,
  });
  const [notesValue, setNotesValue] = useState('');
  const [acknowledgedValue, setAcknowledgedValue] = useState(false);
  const [isSavingAcknowledgment, setIsSavingAcknowledgment] = useState(false);
  const [acknowledgmentError, setAcknowledmentError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // load
  useEffect(() =>
  {
    if (!selectedCoachingPointId) return;
    if (userRole !== 'player' && !selectedPlayerId)
    {
      // Non-player without selection: reset
      setAcknowledgment({ acknowledged: false, ack_at: null, notes: null });
      setNotesValue('');
      setAcknowledgedValue(false);
      return;
    }

    const load = async () =>
    {
      try
      {
        setAcknowledmentError(null);
        setSaveSuccess(false);
        setHasUnsavedChanges(false);

        const playerId = userRole !== 'player' ? selectedPlayerId || undefined : undefined;
        const ackData = await getCoachingPointAcknowledgment(selectedCoachingPointId, playerId);
        setAcknowledgment(ackData);
        setNotesValue(ackData.notes || '');
        setAcknowledgedValue(ackData.acknowledged);
      }
      catch (e)
      {
        console.error('Failed to load acknowledgment:', e);
        setAcknowledmentError('Failed to load acknowledgment data');
      }
    };

    load();
  }, [selectedCoachingPointId, userRole, selectedPlayerId]);

  // track unsaved
  useEffect(() =>
  {
    const hasChanges = acknowledgedValue !== acknowledgment.acknowledged || notesValue !== (acknowledgment.notes || '');
    setHasUnsavedChanges(hasChanges);
    if (hasChanges && saveSuccess) setSaveSuccess(false);
  }, [acknowledgedValue, notesValue, acknowledgment.acknowledged, acknowledgment.notes, saveSuccess]);

  const handleAcknowledgmentChange = useCallback((ack: boolean) => setAcknowledgedValue(ack), []);
  const handleNotesChange = useCallback((notes: string) => setNotesValue(notes), []);

  const handleSaveAcknowledgment = useCallback(async () =>
  {
    if (!selectedCoachingPointId) return;
    if (userRole !== 'player' && !selectedPlayerId)
    {
      setAcknowledmentError('Please select a player first');
      return;
    }

    try
    {
      setIsSavingAcknowledgment(true);
      setAcknowledmentError(null);
      setSaveSuccess(false);

      const playerId = userRole !== 'player' ? selectedPlayerId || undefined : undefined;
      const shouldAcknowledge = acknowledgedValue || !!(notesValue && notesValue.trim().length > 0);

      const result = await updateCoachingPointAcknowledgment(
        selectedCoachingPointId,
        shouldAcknowledge,
        notesValue || undefined,
        playerId,
      );

      setAcknowledgment(result);
      setAcknowledgedValue(result.acknowledged);
      setHasUnsavedChanges(false);
      setSaveSuccess(true);

      setTimeout(() => setSaveSuccess(false), 3000);
    }
    catch (e)
    {
      console.error('Failed to update acknowledgment:', e);
      setAcknowledmentError('Failed to save acknowledgment');
    }
    finally
    {
      setIsSavingAcknowledgment(false);
    }
  }, [selectedCoachingPointId, userRole, selectedPlayerId, acknowledgedValue, notesValue]);

  return {
    acknowledgment,
    notesValue,
    acknowledgedValue,
    isSavingAcknowledgment,
    acknowledgmentError,
    hasUnsavedChanges,
    saveSuccess,
    handleAcknowledgmentChange,
    handleNotesChange,
    handleSaveAcknowledgment,
  };
}
