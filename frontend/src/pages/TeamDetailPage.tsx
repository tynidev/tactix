import React, { useEffect, useState } from 'react';
import { FaCopy, FaSearch, FaSortAlphaDown, FaSortAlphaUp, FaSortNumericDown, FaSortNumericUp } from 'react-icons/fa';
import { Link, useParams } from 'react-router-dom';
import { getApiUrl } from '../utils/api';

interface TeamDetails
{
  id: string;
  name: string;
  created_at: string;
  user_role: string;
  member_counts: {
    players: number;
    coach: number;
    admin: number;
    guardian: number;
  };
  total_games: number;
  join_codes: JoinCode[];
}

interface JoinCode
{
  id: string;
  code: string;
  team_role: string;
  created_at: string;
  expires_at: string | null;
  is_active: boolean;
}

interface TeamMembers
{
  players: Player[];
  coaches: Member[];
  admins: Member[];
  guardians: Member[];
}

interface Player
{
  id: string;
  user_id: string | null;
  name: string;
  email: string | null;
  jersey_number: number | null;
  joined_at: string;
  profile_created_at: string;
  user_created_at: string | null;
}

interface Member
{
  id: string;
  user_id: string;
  name: string;
  email: string;
  role: string;
  joined_at: string;
  user_created_at: string;
}

type SortOption = 'name-asc' | 'name-desc' | 'date-newest' | 'date-oldest';

export const TeamDetailPage: React.FC = () =>
{
  const { teamId } = useParams<{ teamId: string; }>();
  const [teamDetails, setTeamDetails] = useState<TeamDetails | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMembers | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Search and filter states
  const [playerSearch, setPlayerSearch] = useState('');
  const [coachSearch, setCoachSearch] = useState('');
  const [adminSearch, setAdminSearch] = useState('');
  const [guardianSearch, setGuardianSearch] = useState('');

  // Sort states
  const [playerSort, setPlayerSort] = useState<SortOption>('name-asc');
  const [coachSort, setCoachSort] = useState<SortOption>('name-asc');
  const [adminSort, setAdminSort] = useState<SortOption>('name-asc');
  const [guardianSort, setGuardianSort] = useState<SortOption>('name-asc');

  useEffect(() =>
  {
    document.body.className = 'dashboard-mode';
    if (teamId)
    {
      fetchTeamDetails();
      fetchTeamMembers();
    }

    return () =>
    {
      document.body.className = '';
    };
  }, [teamId]);

  const fetchTeamDetails = async () =>
  {
    try
    {
      const token = (await import('../lib/supabase')).supabase.auth.getSession();
      const session = await token;

      if (!session.data.session?.access_token)
      {
        throw new Error('No access token');
      }

      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/teams/${teamId}`, {
        headers: {
          'Authorization': `Bearer ${session.data.session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok)
      {
        if (response.status === 403)
        {
          setError('You are not a member of this team');
          return;
        }
        throw new Error('Failed to fetch team details');
      }

      const data = await response.json();
      setTeamDetails(data);
    }
    catch (err)
    {
      setError('Failed to load team details');
      console.error('Error fetching team details:', err);
    }
  };

  const fetchTeamMembers = async () =>
  {
    try
    {
      const token = (await import('../lib/supabase')).supabase.auth.getSession();
      const session = await token;

      if (!session.data.session?.access_token)
      {
        throw new Error('No access token');
      }

      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/teams/${teamId}/members`, {
        headers: {
          'Authorization': `Bearer ${session.data.session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok)
      {
        throw new Error('Failed to fetch team members');
      }

      const data = await response.json();
      setTeamMembers(data);
    }
    catch (err)
    {
      setError('Failed to load team members');
      console.error('Error fetching team members:', err);
    }
    finally
    {
      setLoading(false);
    }
  };

  const copyToClipboard = async (code: string) =>
  {
    try
    {
      const fullUrl = `${window.location.origin}/auth?teamCode=${code}`;
      await navigator.clipboard.writeText(fullUrl);
      // Could show a temporary toast message here
      alert('Join link copied to clipboard!');
    }
    catch (err)
    {
      console.error('Failed to copy to clipboard:', err);
      // Fallback for older browsers
      const fullUrl = `${window.location.origin}/auth?teamCode=${code}`;
      const textArea = document.createElement('textarea');
      textArea.value = fullUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('Join link copied to clipboard!');
    }
  };

  const getJoinCodesByRole = (role: string) =>
  {
    return teamDetails?.join_codes.filter(code => code.team_role === role) || [];
  };

  const isJoinCodeVisible = (role: string) =>
  {
    if (!teamDetails) return false;

    // Player & Guardian codes: Always visible to everyone
    if (role === 'player' || role === 'guardian')
    {
      return true;
    }

    // Coach & Admin codes: Only visible to coaches and admins
    return teamDetails.user_role === 'coach' || teamDetails.user_role === 'admin';
  };

  const sortMembers = (members: (Player | Member)[], sortOption: SortOption): (Player | Member)[] =>
  {
    const sorted = [...members];

    switch (sortOption)
    {
      case 'name-asc':
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
      case 'name-desc':
        return sorted.sort((a, b) => b.name.localeCompare(a.name));
      case 'date-newest':
        return sorted.sort((a, b) => new Date(b.joined_at).getTime() - new Date(a.joined_at).getTime());
      case 'date-oldest':
        return sorted.sort((a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime());
      default:
        return sorted;
    }
  };

  const filterMembers = (members: (Player | Member)[], searchTerm: string): (Player | Member)[] =>
  {
    if (!searchTerm) return members;

    return members.filter(member =>
      member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const renderSortButton = (currentSort: SortOption, setSort: (sort: SortOption) => void) => (
    <div className='sort-controls' style={{ display: 'flex', gap: 'var(--space-xs)' }}>
      <button
        className={`btn btn-sm ${currentSort.startsWith('name') ? 'btn-primary' : 'btn-secondary'}`}
        onClick={() =>
          setSort(currentSort === 'name-asc' ? 'name-desc' : 'name-asc')}
        title='Sort by name'
      >
        {currentSort === 'name-asc' ? <FaSortAlphaDown /> : <FaSortAlphaUp />}
      </button>
      <button
        className={`btn btn-sm ${currentSort.startsWith('date') ? 'btn-primary' : 'btn-secondary'}`}
        onClick={() =>
          setSort(currentSort === 'date-newest' ? 'date-oldest' : 'date-newest')}
        title='Sort by join date'
      >
        {currentSort === 'date-newest' ? <FaSortNumericDown /> : <FaSortNumericUp />}
      </button>
    </div>
  );

  const renderAllJoinCodes = () =>
  {
    const roles = ['guardian', 'player', 'coach', 'admin'];
    const visibleRoles = roles.filter(role => isJoinCodeVisible(role) && getJoinCodesByRole(role).length > 0);

    if (visibleRoles.length === 0) return null;

    return (
      <div style={{ marginBottom: 'var(--space-2xl)' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 'var(--space-lg)',
          }}
        >
          {visibleRoles.map(role =>
          {
            const codes = getJoinCodesByRole(role);
            return (
              <div key={role}>
                <h4 style={{ textTransform: 'capitalize', marginBottom: 'var(--space-sm)', fontSize: '1rem' }}>
                  {role} Join Codes
                </h4>
                {codes.map(code => (
                  <div
                    key={code.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 'var(--space-sm)',
                      backgroundColor: 'var(--color-bg-secondary)',
                      borderRadius: 'var(--radius-md)',
                      marginBottom: 'var(--space-sm)',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '1.2em',
                          fontWeight: 'bold',
                          color: 'var(--color-accent-primary)',
                        }}
                      >
                        {code.code}
                      </div>
                      <small style={{ color: 'var(--color-text-secondary)' }}>
                        {code.expires_at ?
                          `Expires: ${new Date(code.expires_at).toLocaleDateString()}` :
                          'Never expires'}
                      </small>
                    </div>
                    <button
                      onClick={() => copyToClipboard(code.code)}
                      className='btn btn-secondary btn-sm'
                      title='Copy join code'
                    >
                      <FaCopy />
                    </button>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderMemberSection = (
    title: string,
    members: (Player | Member)[],
    searchTerm: string,
    setSearchTerm: (term: string) => void,
    sortOption: SortOption,
    setSortOption: (sort: SortOption) => void,
  ) =>
  {
    const filteredMembers = filterMembers(members, searchTerm);
    const sortedMembers = sortMembers(filteredMembers, sortOption);

    return (
      <div className='member-section' style={{ marginBottom: 'var(--space-xl)' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 'var(--space-md)',
          }}
        >
          <h3>{title} ({members.length})</h3>
          <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
            {renderSortButton(sortOption, setSortOption)}
            <div style={{ position: 'relative' }}>
              <FaSearch
                style={{
                  position: 'absolute',
                  left: 'var(--space-sm)',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--color-text-muted)',
                  fontSize: '14px',
                }}
              />
              <input
                type='text'
                placeholder={`Search ${title.toLowerCase()}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className='form-input'
                style={{
                  paddingLeft: 'var(--space-xl)',
                  width: '200px',
                  fontSize: '14px',
                }}
              />
            </div>
          </div>
        </div>

        <div className='members-list'>
          {sortedMembers.length === 0 ?
            (
              <div
                style={{
                  textAlign: 'center',
                  padding: 'var(--space-lg)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                {searchTerm ? `No ${title.toLowerCase()} match your search` : `No ${title.toLowerCase()} yet`}
              </div>
            ) :
            (
              <div style={{ display: 'grid', gap: 'var(--space-sm)' }}>
                {sortedMembers.map((member) => (
                  <div
                    key={member.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: 'var(--space-md)',
                      backgroundColor: 'var(--color-bg-card)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: '600', marginBottom: 'var(--space-xs)' }}>
                        {member.name}
                        {'jersey_number' in member && member.jersey_number && (
                          <span
                            style={{
                              marginLeft: 'var(--space-sm)',
                              padding: '2px 6px',
                              backgroundColor: 'var(--color-accent-primary)',
                              color: 'white',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '12px',
                              fontWeight: 'bold',
                            }}
                          >
                            #{member.jersey_number}
                          </span>
                        )}
                      </div>
                      {member.email && (
                        <div
                          style={{
                            fontSize: '14px',
                            color: 'var(--color-text-secondary)',
                            marginBottom: 'var(--space-xs)',
                          }}
                        >
                          {member.email}
                        </div>
                      )}
                      <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                        Joined: {new Date(member.joined_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div>
      </div>
    );
  };

  if (loading)
  {
    return <div className='loading'>Loading team details...</div>;
  }

  if (error)
  {
    return (
      <main className='dashboard-main'>
        <div className='alert alert-error'>{error}</div>
        <Link to='/teams' className='btn btn-primary'>
          Back to Teams
        </Link>
      </main>
    );
  }

  if (!teamDetails || !teamMembers)
  {
    return <div className='loading'>Loading...</div>;
  }

  return (
    <main className='dashboard-main'>
      {/* Breadcrumb Navigation */}
      <div style={{ marginBottom: 'var(--space-lg)' }}>
        <nav style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
          <Link to='/teams' style={{ color: 'var(--color-accent-primary)', textDecoration: 'none' }}>
            Teams
          </Link>
          <span style={{ margin: '0 var(--space-sm)' }}>/</span>
          <span>{teamDetails.name}</span>
        </nav>
      </div>

      {/* Team Header */}
      <div className='section-header'>
        <div>
          <h1 className='section-title'>{teamDetails.name}</h1>
          <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
            Created: {new Date(teamDetails.created_at).toLocaleDateString()} • Your role:{' '}
            <span style={{ color: 'var(--color-accent-primary)', fontWeight: '600', textTransform: 'capitalize' }}>
              {teamDetails.user_role}
            </span>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          <Link to={`/games/${teamId}`} className='btn btn-primary'>
            View Games
          </Link>
        </div>
      </div>

      {/* Team Stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 'var(--space-lg)',
          marginBottom: 'var(--space-2xl)',
        }}
      >
        <div
          className='stat'
          style={{
            padding: 'var(--space-lg)',
            backgroundColor: 'var(--color-bg-card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-color)',
          }}
        >
          <div className='stat-value'>{teamMembers.players.length}</div>
          <div className='stat-label'>Players</div>
        </div>
        <div
          className='stat'
          style={{
            padding: 'var(--space-lg)',
            backgroundColor: 'var(--color-bg-card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-color)',
          }}
        >
          <div className='stat-value'>{teamMembers.coaches.length}</div>
          <div className='stat-label'>Coaches</div>
        </div>
        <div
          className='stat'
          style={{
            padding: 'var(--space-lg)',
            backgroundColor: 'var(--color-bg-card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-color)',
          }}
        >
          <div className='stat-value'>{teamMembers.admins.length}</div>
          <div className='stat-label'>Admins</div>
        </div>
        <div
          className='stat'
          style={{
            padding: 'var(--space-lg)',
            backgroundColor: 'var(--color-bg-card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-color)',
          }}
        >
          <div className='stat-value'>{teamMembers.guardians.length}</div>
          <div className='stat-label'>Guardians</div>
        </div>
        <div
          className='stat'
          style={{
            padding: 'var(--space-lg)',
            backgroundColor: 'var(--color-bg-card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-color)',
          }}
        >
          <div className='stat-value'>{teamDetails.total_games}</div>
          <div className='stat-label'>Games</div>
        </div>
      </div>

      {/* Join Codes Section */}
      {renderAllJoinCodes()}

      {/* Team Members Sections */}
      <div className='team-members'>
        {renderMemberSection(
          'Players',
          teamMembers.players,
          playerSearch,
          setPlayerSearch,
          playerSort,
          setPlayerSort,
        )}

        {renderMemberSection(
          'Coaches',
          teamMembers.coaches,
          coachSearch,
          setCoachSearch,
          coachSort,
          setCoachSort,
        )}

        {renderMemberSection(
          'Admins',
          teamMembers.admins,
          adminSearch,
          setAdminSearch,
          adminSort,
          setAdminSort,
        )}

        {renderMemberSection(
          'Guardians',
          teamMembers.guardians,
          guardianSearch,
          setGuardianSearch,
          guardianSort,
          setGuardianSort,
        )}
      </div>
    </main>
  );
};
