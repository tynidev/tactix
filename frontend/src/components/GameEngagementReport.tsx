import React, { useEffect, useState } from 'react';
import { getApiUrl, getValidAccessToken } from '../utils/api';

interface GameEngagementRow
{
  player_id: string;
  player_name: string;
  points_viewed: number;
  total_views: number;
  view_percentage: number;
  avg_completion_percentage: number;
  points_ackd: number;
  points_note_written: number;
  earliest_view: string | null;
  latest_view: string | null;
}

interface GameEngagementReportProps
{
  gameId: string;
  teamId: string;
}

const GameEngagementReport: React.FC<GameEngagementReportProps> = ({ gameId, teamId }) =>
{
  const [data, setData] = useState<GameEngagementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() =>
  {
    if (!gameId || !teamId) return;

    const fetchData = async () =>
    {
      try
      {
        const token = await getValidAccessToken();
        if (!token)
        {
          setError('Not authenticated');
          setLoading(false);
          return;
        }

        const response = await fetch(`${getApiUrl()}/api/analytics/game-engagement/${gameId}?teamId=${teamId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok)
        {
          throw new Error('Failed to fetch report');
        }

        const result = await response.json();
        setData(result);
      }
      catch (err)
      {
        setError(err instanceof Error ? err.message : 'An error occurred');
      }
      finally
      {
        setLoading(false);
      }
    };

    fetchData();
  }, [gameId, teamId]);

  if (loading) return <div className='loading'>Loading report...</div>;
  if (error) return <div className='alert alert-error'>Error: {error}</div>;

  const fmtPercent = (v: number) => `${(v * 100).toFixed(1)}%`;
  const fmtDateTime = (v: string | null) => (v ? new Date(v).toLocaleString() : '—');

  return (
    <div className='game-report'>
      <div className='game-report-head'>
        <div>Player</div>
        <div className='text-right'>Points Viewed</div>
        <div className='text-right'>Total Views</div>
        <div className='text-right'>View %</div>
        <div className='text-right'>Avg Completion</div>
        <div className='text-right'>Ack’d</div>
        <div className='text-right'>Notes</div>
        <div>Earliest View</div>
        <div>Latest View</div>
      </div>
      <div className='game-report-body'>
        {data.map(row => (
          <div key={row.player_id} className='game-report-row'>
            <div className='gr-player'>{row.player_name}</div>
            <div className='text-right'>{row.points_viewed}</div>
            <div className='text-right'>{row.total_views}</div>
            <div className='text-right gr-strong'>{fmtPercent(row.view_percentage)}</div>
            <div className='text-right gr-strong'>{fmtPercent(row.avg_completion_percentage)}</div>
            <div className='text-right'>{row.points_ackd}</div>
            <div className='text-right'>{row.points_note_written}</div>
            <div className='gr-date'>{fmtDateTime(row.earliest_view)}</div>
            <div className='gr-date'>{fmtDateTime(row.latest_view)}</div>
          </div>
        ))}
        {data.length === 0 && <div className='empty-block'>No data</div>}
      </div>
    </div>
  );
};

export default GameEngagementReport;
