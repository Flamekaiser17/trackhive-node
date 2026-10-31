import axios from 'axios';

const PROD_API_URL = 'https://trackhive-api.onrender.com';
const isProdHost = typeof window !== 'undefined' && !window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1');

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || (isProdHost ? PROD_API_URL : 'http://localhost:5000'),
  headers: {
    'Content-Type': 'application/json',
  },
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Request Interceptor: Attach JWT token to every request
client.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle auth errors (401) and JWT Rotation
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (!error.response) return Promise.reject(error);

    const originalRequest = error.config;

    // ✅ FIXED CONDITION (includes instead of exact match)
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url.includes('/api/auth/refresh/')
    ) {
      
      originalRequest.headers = originalRequest.headers || {};
      
      if (isRefreshing) {
        return new Promise(function(resolve, reject) {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers['Authorization'] = 'Bearer ' + token;
          return client(originalRequest);
        }).catch(err => {
          return Promise.reject(err);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;
      const refreshToken = localStorage.getItem('refresh_token');

      if (!refreshToken) {
        localStorage.removeItem('access_token');
        window.dispatchEvent(new Event('auth_logout'));
        return Promise.reject(error);
      }

      try {
        // ✅ FIXED: use client instead of axios
        const { data } = await client.post('/api/auth/refresh/', {
          refresh: refreshToken
        });

        localStorage.setItem('access_token', data.access);
        if (data.refresh) localStorage.setItem('refresh_token', data.refresh);
        
        processQueue(null, data.access);
        
        originalRequest.headers['Authorization'] = 'Bearer ' + data.access;
        return client(originalRequest);
        
      } catch (err) {
        processQueue(err, null);
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.dispatchEvent(new Event('auth_logout'));
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default client;