import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import ThemeToggle from '../ThemeToggle/ThemeToggle';

interface NavigationProps {
  currentPage?: string;
  onNavigate?: (page: string) => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentPage = 'dashboard',
  onNavigate = () => {}
}) => {
  const { user, signOut } = useAuth();

  const handleNavigation = (page: string) => {
    onNavigate(page);
  };

  return (
    <nav className="header-nav">
      <div className="header-nav-content">
        <a href="#" className="nav-brand" onClick={() => handleNavigation('dashboard')}>
          TACTIX
        </a>
        
        <ul className="nav-items">
          <li>
            <a
              href="#"
              className={`nav-item ${currentPage === 'dashboard' ? 'active' : ''}`}
              onClick={(e) => {
                e.preventDefault();
                handleNavigation('dashboard');
              }}
            >
              Dashboard
            </a>
          </li>
          <li>
            <a
              href="#"
              className={`nav-item ${currentPage === 'games' ? 'active' : ''}`}
              onClick={(e) => {
                e.preventDefault();
                handleNavigation('games');
              }}
            >
              Games
            </a>
          </li>
        </ul>

        <div className="user-menu">
          <span className="user-info">
            Welcome, {user?.email?.split('@')[0] || 'User'}
          </span>
          <a
            href="#"
            className={`nav-item ${currentPage === 'profile' ? 'active' : ''}`}
            onClick={(e) => {
              e.preventDefault();
              handleNavigation('profile');
            }}
          >
            Profile
          </a>
          <ThemeToggle />
          <button onClick={signOut} className="btn btn-error btn-sm">
            Sign Out
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
