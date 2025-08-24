import { useCallback, useEffect, useState } from 'react';
import { getGuardianPlayers } from '../../../utils/api';

export interface GuardianPlayer
{
  id: string;
  name: string;
  jersey_number: string | null;
}

export interface UseGuardianPlayersReturn
{
  guardianPlayers: GuardianPlayer[];
  selectedPlayerId: string | null;
  setSelectedPlayerId: (id: string | null) => void;
  isLoadingGuardianPlayers: boolean;
  guardianPlayersError: string | null;
}

export function useGuardianPlayers(
  teamId?: string,
  userRole?: 'coach' | 'player' | 'admin' | 'guardian',
): UseGuardianPlayersReturn
{
  const [guardianPlayers, setGuardianPlayers] = useState<GuardianPlayer[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [isLoadingGuardianPlayers, setIsLoadingGuardianPlayers] = useState(false);
  const [guardianPlayersError, setGuardianPlayersError] = useState<string | null>(null);

  const load = useCallback(async () =>
  {
    if (userRole === 'player' || !teamId) return;

    try
    {
      setIsLoadingGuardianPlayers(true);
      setGuardianPlayersError(null);
      const players = await getGuardianPlayers(teamId);
      setGuardianPlayers(players);
      if (players.length > 0)
      {
        setSelectedPlayerId(players[0].id);
      }
    }
    catch (e)
    {
      console.error('Failed to load guardian players:', e);
      setGuardianPlayersError('Failed to load your players');
    }
    finally
    {
      setIsLoadingGuardianPlayers(false);
    }
  }, [teamId, userRole]);

  useEffect(() =>
  {
    load();
  }, [load]);

  return {
    guardianPlayers,
    selectedPlayerId,
    setSelectedPlayerId,
    isLoadingGuardianPlayers,
    guardianPlayersError,
  };
}
