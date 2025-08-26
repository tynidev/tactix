import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import ThemeToggle from '../ThemeToggle/ThemeToggle';

export const Navigation: React.FC = () =>
{
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  // const [hasCoachAccess, setHasCoachAccess] = useState(false);

  const isActive = (path: string) =>
  {
    if (path === '/games')
    {
      return location.pathname === '/' || location.pathname === '/games' || location.pathname.startsWith('/games');
    }
    return location.pathname.startsWith(path);
  };

  const toggleMobileMenu = () =>
  {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () =>
  {
    setIsMobileMenuOpen(false);
  };

  // Close mobile menu when route changes
  useEffect(() =>
  {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  // Detect if user has coach/admin access on any team to show Analytics tab
  // useEffect(() =>
  // {
  //   let cancelled = false;
  //   (async () =>
  //   {
  //     try
  //     {
  //       const { supabase } = await import('../../lib/supabase');
  //       const { data: { session } } = await supabase.auth.getSession();
  //       const token = session?.access_token;
  //       if (!token) return;

  //       const apiUrl = getApiUrl();
  //       const resp = await fetch(`${apiUrl}/api/teams`, {
  //         headers: {
  //           'Authorization': `Bearer ${token}`,
  //           'Content-Type': 'application/json',
  //         },
  //       });
  //       if (!resp.ok) return;

  //       const data = await resp.json();
  //       const coach = Array.isArray(data) && data.some((m: any) => m.role === 'coach' || m.role === 'admin');
  //       if (!cancelled) setHasCoachAccess(coach);
  //     }
  //     catch
  //     {
  //       // ignore
  //     }
  //   })();

  //   return () =>
  //   {
  //     cancelled = true;
  //   };
  // }, []);

  // Handle escape key to close menu
  useEffect(() =>
  {
    const handleEscape = (e: KeyboardEvent) =>
    {
      if (e.key === 'Escape')
      {
        setIsMobileMenuOpen(false);
      }
    };

    if (isMobileMenuOpen)
    {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden'; // Prevent background scroll
    }
    else
    {
      document.body.style.overflow = '';
    }

    return () =>
    {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  return (
    <nav className='header-nav'>
      <div className='header-nav-content'>
        <Link to='/games' className='nav-brand'>
          <img src='/tactix-logo.png' alt='TACTIX' />
        </Link>

        {/* Desktop Navigation */}
        <ul className='nav-items'>
          <li>
            <Link
              to='/dashboard'
              className={`nav-item ${isActive('/dashboard') ? 'active' : ''}`}
            >
              Dashboard
            </Link>
          </li>
          <li>
            <Link
              to='/teams'
              className={`nav-item ${isActive('/teams') ? 'active' : ''}`}
            >
              Teams
            </Link>
          </li>
          <li>
            <Link
              to='/games'
              className={`nav-item ${isActive('/games') ? 'active' : ''}`}
            >
              Games
            </Link>
          </li>
        </ul>

        {/* Desktop User Menu */}
        <div className='user-menu'>
          <span className='user-info'>
            Welcome, {user?.email?.split('@')[0] || 'User'}
          </span>
          <Link
            to='/profile'
            className={`nav-item ${isActive('/profile') ? 'active' : ''}`}
          >
            Profile
          </Link>
          <ThemeToggle />
          <button onClick={signOut} className='btn btn-error btn-sm'>
            Sign Out
          </button>
        </div>

        {/* Mobile Menu Toggle Button */}
        <button
          className='mobile-menu-toggle'
          onClick={toggleMobileMenu}
          aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={isMobileMenuOpen}
        >
          <span className={`hamburger-line ${isMobileMenuOpen ? 'hamburger-line-1-open' : ''}`}></span>
          <span className={`hamburger-line ${isMobileMenuOpen ? 'hamburger-line-2-open' : ''}`}></span>
          <span className={`hamburger-line ${isMobileMenuOpen ? 'hamburger-line-3-open' : ''}`}></span>
        </button>

        {/* Mobile Menu Dropdown */}
        <div className={`mobile-menu ${isMobileMenuOpen ? 'mobile-menu-open' : ''}`}>
          <div className='mobile-menu-backdrop' onClick={closeMobileMenu}></div>
          <div className='mobile-menu-content'>
            <ul className='mobile-nav-items'>
              <li>
                <Link
                  to='/dashboard'
                  className={`mobile-nav-item ${isActive('/dashboard') ? 'active' : ''}`}
                  onClick={closeMobileMenu}
                >
                  Dashboard
                </Link>
              </li>
              <li>
                <Link
                  to='/teams'
                  className={`mobile-nav-item ${isActive('/teams') ? 'active' : ''}`}
                  onClick={closeMobileMenu}
                >
                  Teams
                </Link>
              </li>
              <li>
                <Link
                  to='/games'
                  className={`mobile-nav-item ${isActive('/games') ? 'active' : ''}`}
                  onClick={closeMobileMenu}
                >
                  Games
                </Link>
              </li>
              <li>
                <Link
                  to='/profile'
                  className={`mobile-nav-item ${isActive('/profile') ? 'active' : ''}`}
                  onClick={closeMobileMenu}
                >
                  Profile
                </Link>
              </li>
              <li className='mobile-menu-divider'></li>
              <li className='mobile-user-info'>
                Welcome, {user?.email?.split('@')[0] || 'User'}
              </li>
              <li className='mobile-menu-actions'>
                <ThemeToggle />
                <button
                  onClick={() =>
                  {
                    signOut();
                    closeMobileMenu();
                  }}
                  className='btn btn-error btn-sm'
                >
                  Sign Out
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
