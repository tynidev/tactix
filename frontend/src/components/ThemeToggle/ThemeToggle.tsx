import React, { useEffect, useState } from 'react';

export const ThemeToggle: React.FC = () =>
{
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() =>
  {
    // Load saved theme from localStorage or default to light
    const savedTheme = localStorage.getItem('tactix-theme') as 'light' | 'dark' || 'light';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  const toggleTheme = () =>
  {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('tactix-theme', newTheme);
  };

  return (
    <button
      className='theme-toggle'
      type='button'
      title='Toggle theme'
      aria-label='Toggle theme'
      onClick={toggleTheme}
    >
      <svg
        xmlns='http://www.w3.org/2000/svg'
        aria-hidden='true'
        width='1em'
        height='1em'
        className='theme-toggle__dark-inner'
        fill='currentColor'
        viewBox='0 0 32 32'
      >
        <path d='M16 9c3.9 0 7 3.1 7 7s-3.1 7-7 7' />
        <path d='M16 .5C7.4.5.5 7.4.5 16S7.4 31.5 16 31.5 31.5 24.6 31.5 16 24.6.5 16 .5zm0 28.1V23c-3.9 0-7-3.1-7-7s3.1-7 7-7V3.4C23 3.4 28.6 9 28.6 16S23 28.6 16 28.6z' />
      </svg>
    </button>
  );
};

export default ThemeToggle;
