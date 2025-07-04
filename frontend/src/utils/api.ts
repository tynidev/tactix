/**
 * Get the API base URL from environment variables with fallback
 */
export const getApiUrl = (): string => {
  // In production, prefer the environment variable
  // Fallback to the production API URL if not set
  return 'https://tactix-hls7.onrender.com'
}

/**
 * Make an authenticated API request
 */
export const apiRequest = async (
  endpoint: string, 
  options: RequestInit = {}, 
  token?: string
): Promise<Response> => {
  const baseUrl = getApiUrl()
  const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  
  return fetch(url, {
    ...options,
    headers,
  })
}
