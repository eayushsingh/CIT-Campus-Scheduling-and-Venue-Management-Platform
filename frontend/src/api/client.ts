import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000, // 10-second request timeout to prevent hanging forever
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT token to requests if available
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('cit_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle errors with clear messages and 401 redirects
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Attach user-friendly explanation for timeouts and network failures
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      error.userMessage = 'Server is waking up, retry in a few seconds.';
    } else if (!error.response || error.code === 'ERR_NETWORK') {
      error.userMessage = 'Could not connect to server. The backend may be spinning up (free-tier container). Please retry.';
    } else if (error.response?.data?.detail) {
      error.userMessage = typeof error.response.data.detail === 'string'
        ? error.response.data.detail
        : JSON.stringify(error.response.data.detail);
    } else if (error.response?.data?.message) {
      error.userMessage = error.response.data.message;
    } else {
      error.userMessage = 'An unexpected error occurred. Please try again.';
    }

    if (error.response?.status === 401) {
      localStorage.removeItem('cit_token');
      localStorage.removeItem('cit_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
