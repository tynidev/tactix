import React, { useState } from 'react';
import '../styles/ui-kit.css';
import { apiRequest } from '../utils/api';

interface VeoParseResult
{
  originalUrl: string;
  videoUrl: string;
  posterUrl: string;
}

interface VeoParseError
{
  error: string;
  details?: string;
}

const VEOTestPage: React.FC = () =>
{
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VeoParseResult | null>(null);
  const [error, setError] = useState<VeoParseError | null>(null);

  const handleSubmit = async (e: React.FormEvent) =>
  {
    e.preventDefault();

    if (!url.trim())
    {
      setError({ error: 'Please enter a VEO URL' });
      return;
    }

    setLoading(true);
    setResult(null);
    setError(null);

    try
    {
      const response = await apiRequest('/api/veo/parse', {
        method: 'POST',
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await response.json();

      if (!response.ok)
      {
        setError({
          error: data.error || 'Failed to parse VEO URL',
          details: data.details,
        });
        return;
      }

      if (data.success && data.data)
      {
        setResult(data.data);
      }
      else
      {
        setError({ error: 'Unexpected response format' });
      }
    }
    catch (err)
    {
      setError({
        error: 'Network error',
        details: err instanceof Error ? err.message : 'Unknown error',
      });
    }
    finally
    {
      setLoading(false);
    }
  };

  const handleClear = () =>
  {
    setUrl('');
    setResult(null);
    setError(null);
  };

  return (
    <div className='page-container'>
      <div className='page-header'>
        <h1>VEO Video Parser Test</h1>
        <p>Test the VEO video URL parser by entering a VEO match URL below.</p>
      </div>

      <div className='content-section'>
        <form onSubmit={handleSubmit} className='form-container'>
          <div className='form-group'>
            <label htmlFor='veo-url'>VEO Match URL</label>
            <input
              id='veo-url'
              type='url'
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder='https://app.veo.co/matches/20250518-match-spartans-9a1f4d76/?highlight=...'
              className='form-input'
              disabled={loading}
            />
          </div>

          <div className='form-actions'>
            <button
              type='submit'
              className='btn btn-primary'
              disabled={loading || !url.trim()}
            >
              {loading ? 'Parsing...' : 'Parse Video'}
            </button>
            <button
              type='button'
              onClick={handleClear}
              className='btn btn-secondary'
              disabled={loading}
            >
              Clear
            </button>
          </div>
        </form>

        {error && (
          <div className='error-container'>
            <h3>Error</h3>
            <p className='error-message'>{error.error}</p>
            {error.details && <p className='error-details'>Details: {error.details}</p>}
          </div>
        )}

        {result && (
          <div className='results-container'>
            <h3>Parse Results</h3>

            <div className='result-item'>
              <h4>Original URL</h4>
              <p className='url-text'>{result.originalUrl}</p>
            </div>

            <div className='result-item'>
              <h4>Video URL</h4>
              <p className='url-text'>
                <a
                  href={result.videoUrl}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='video-link'
                >
                  {result.videoUrl}
                </a>
              </p>
            </div>

            <div className='result-item'>
              <h4>Poster URL</h4>
              {result.posterUrl ?
                (
                  <>
                    <p className='url-text'>
                      <a
                        href={result.posterUrl}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='poster-link'
                      >
                        {result.posterUrl}
                      </a>
                    </p>
                    <div className='poster-preview'>
                      <img
                        src={result.posterUrl}
                        alt='Video poster'
                        className='poster-image'
                        onError={(e) =>
                        {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                    </div>
                  </>
                ) :
                <p className='no-poster'>No poster URL found</p>}
            </div>

            <div className='result-item'>
              <h4>Test Video</h4>
              <video
                controls
                poster={result.posterUrl || undefined}
                className='test-video'
                preload='metadata'
              >
                <source src={result.videoUrl} type='video/mp4' />
                Your browser does not support the video tag.
              </video>
            </div>
          </div>
        )}
      </div>

      <style>
        {`
          .page-container {
            max-width: 800px;
            margin: 0 auto;
            padding: 2rem;
          }

          .page-header {
            margin-bottom: 2rem;
            text-align: center;
          }

          .page-header h1 {
            color: #007bff;
            margin-bottom: 0.5rem;
          }

          .page-header p {
            color: #666;
          }

          .content-section {
            background: #fff;
            border-radius: 8px;
            padding: 2rem;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          }

          .form-container {
            margin-bottom: 2rem;
          }

          .form-group {
            margin-bottom: 1rem;
          }

          .form-group label {
            display: block;
            margin-bottom: 0.5rem;
            font-weight: 600;
            color: #333;
          }

          .form-input {
            width: 100%;
            padding: 0.75rem;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 1rem;
          }

          .form-input:focus {
            outline: none;
            border-color: #007bff;
            box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
          }

          .form-actions {
            display: flex;
            gap: 1rem;
          }

          .btn {
            padding: 0.75rem 1.5rem;
            border: none;
            border-radius: 4px;
            font-size: 1rem;
            cursor: pointer;
            transition: background-color 0.2s;
          }

          .btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          .btn-primary {
            background-color: #007bff;
            color: white;
          }

          .btn-primary:hover:not(:disabled) {
            background-color: #0056b3;
          }

          .btn-secondary {
            background-color: #6c757d;
            color: white;
          }

          .btn-secondary:hover:not(:disabled) {
            background-color: #545b62;
          }

          .error-container {
            background-color: #f8d7da;
            border: 1px solid #f5c6cb;
            border-radius: 4px;
            padding: 1rem;
            margin-bottom: 2rem;
          }

          .error-container h3 {
            color: #721c24;
            margin: 0 0 0.5rem 0;
          }

          .error-message {
            color: #721c24;
            margin: 0;
          }

          .error-details {
            color: #721c24;
            margin: 0.5rem 0 0 0;
            font-size: 0.875rem;
            opacity: 0.8;
          }

          .results-container {
            background-color: #d4edda;
            border: 1px solid #c3e6cb;
            border-radius: 4px;
            padding: 1rem;
          }

          .results-container h3 {
            color: #155724;
            margin: 0 0 1rem 0;
          }

          .result-item {
            margin-bottom: 1.5rem;
          }

          .result-item:last-child {
            margin-bottom: 0;
          }

          .result-item h4 {
            color: #155724;
            margin: 0 0 0.5rem 0;
            font-size: 1rem;
          }

          .url-text {
            background-color: #f8f9fa;
            padding: 0.5rem;
            border-radius: 4px;
            font-family: monospace;
            font-size: 0.875rem;
            word-break: break-all;
            margin: 0;
          }

          .video-link, .poster-link {
            color: #007bff;
            text-decoration: none;
          }

          .video-link:hover, .poster-link:hover {
            text-decoration: underline;
          }

          .no-poster {
            color: #6c757d;
            font-style: italic;
            margin: 0;
          }

          .poster-preview {
            margin-top: 0.5rem;
          }

          .poster-image {
            max-width: 200px;
            max-height: 150px;
            border-radius: 4px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          }

          .test-video {
            width: 100%;
            max-width: 500px;
            border-radius: 4px;
          }
        `}
      </style>
    </div>
  );
};

export default VEOTestPage;
