import React, { useState } from 'react';
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

export const VeoTestParserPage: React.FC = () =>
{
  const [url, setUrl] = useState('https://app.veo.co/matches/20250518-match-spartans-9a1f4d76');
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

      if (!response.ok)
      {
        const errorData = await response.json();
        setError(errorData);
        return;
      }

      const data = await response.json();
      setResult(data.data);
    }
    catch (err)
    {
      console.error('VEO parse error:', err);
      setError({
        error: 'Failed to parse VEO URL',
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
    <main className='dashboard-main'>
      <div className='section-header'>
        <h1 className='section-title'>VEO Parser Test</h1>
      </div>

      <div className='card' style={{ maxWidth: '800px', margin: '0 auto' }}>
        <h2 className='mt-0 mb-lg'>Test VEO Video URL Parser</h2>

        <form onSubmit={handleSubmit} style={{ marginBottom: 'var(--space-lg)' }}>
          <div className='form-group'>
            <label htmlFor='veo-url' className='form-label'>
              VEO Match URL
            </label>
            <input
              id='veo-url'
              type='url'
              className='form-input'
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder='https://app.veo.co/matches/...'
              disabled={loading}
              style={{ marginBottom: 'var(--space-md)' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
            <button
              type='submit'
              className='btn btn-primary'
              disabled={loading || !url.trim()}
            >
              {loading ? 'Parsing...' : 'Parse URL'}
            </button>
            <button
              type='button'
              className='btn btn-secondary'
              onClick={handleClear}
              disabled={loading}
            >
              Clear
            </button>
          </div>
        </form>

        {loading && (
          <div className='alert alert-info'>
            <strong>Parsing VEO URL...</strong>
            <br />
            This may take a few seconds as we extract video information from the page.
          </div>
        )}

        {error && (
          <div className='alert alert-error'>
            <strong>Error:</strong> {error.error}
            {error.details && (
              <>
                <br />
                <small>{error.details}</small>
              </>
            )}
          </div>
        )}

        {result && (
          <div className='alert alert-success'>
            <h3 className='mt-0 mb-md'>Parse Successful!</h3>

            <div style={{ marginBottom: 'var(--space-md)' }}>
              <strong>Original URL:</strong>
              <br />
              <code style={{ wordBreak: 'break-all' }}>{result.originalUrl}</code>
            </div>

            <div style={{ marginBottom: 'var(--space-md)' }}>
              <strong>Video URL:</strong>
              <br />
              <code style={{ wordBreak: 'break-all' }}>{result.videoUrl}</code>
              <br />
              <a
                href={result.videoUrl}
                target='_blank'
                rel='noopener noreferrer'
                className='btn btn-sm btn-secondary'
                style={{ marginTop: 'var(--space-xs)' }}
              >
                Open Video
              </a>
            </div>

            {result.posterUrl && (
              <div style={{ marginBottom: 'var(--space-md)' }}>
                <strong>Poster URL:</strong>
                <br />
                <code style={{ wordBreak: 'break-all' }}>{result.posterUrl}</code>
                <br />
                <a
                  href={result.posterUrl}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='btn btn-sm btn-secondary'
                  style={{ marginTop: 'var(--space-xs)' }}
                >
                  View Poster
                </a>
              </div>
            )}

            {result.videoUrl && (
              <div style={{ marginTop: 'var(--space-lg)' }}>
                <strong>Video Preview:</strong>
                <video
                  controls
                  style={{
                    width: '100%',
                    maxHeight: '400px',
                    marginTop: 'var(--space-sm)',
                    borderRadius: 'var(--border-radius)',
                  }}
                  poster={result.posterUrl || undefined}
                >
                  <source src={result.videoUrl} type='video/mp4' />
                  Your browser does not support the video tag.
                </video>
              </div>
            )}
          </div>
        )}

        <div className='alert alert-info' style={{ marginTop: 'var(--space-lg)' }}>
          <h4 className='mt-0 mb-sm'>How it works:</h4>
          <ol style={{ marginBottom: 0, paddingLeft: 'var(--space-lg)' }}>
            <li>First attempts fast regex-based parsing of the HTML</li>
            <li>If that fails, uses Playwright to render the JavaScript and extract video URLs</li>
            <li>Returns both the direct video URL and poster image URL</li>
          </ol>
        </div>
      </div>
    </main>
  );
};
