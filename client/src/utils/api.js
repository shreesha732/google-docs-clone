// Custom API fetch helper to easily handle backend REST requests

const getBaseUrl = () => {
  return import.meta.env.VITE_API_URL || '';
};

export const apiRequest = async (endpoint, options = {}, authContext = null) => {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}${endpoint}`;

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  // Attach auth authorization token if authContext is supplied
  if (authContext) {
    try {
      const token = await authContext.getToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    } catch (e) {
      console.warn('Failed to retrieve authentication token:', e);
    }
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.error || `HTTP error! Status: ${response.status}`;
    const err = new Error(errorMsg);
    err.status = response.status;
    throw err;
  }

  return data;
};
