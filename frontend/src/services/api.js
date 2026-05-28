import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('iot_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// When the backend returns 401 (expired or invalid token), notify AuthContext
// so it can clear state and redirect to /login — regardless of which page
// triggered the request.
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      window.dispatchEvent(new Event('iot:unauthorized'));
    }
    return Promise.reject(error);
  }
);

export default api;
