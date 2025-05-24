import axios from 'axios';

// Create a base axios instance
const axiosInstance = axios.create({
    baseURL: '/', // Flask default address
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
    },
});

axios.defaults.headers.common['Content-Type'] = 'application/json';

// Request interceptor to add authorization token
axiosInstance.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('authToken');
        // If token exists, add it to Authorization header
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor to handle common errors
axiosInstance.interceptors.response.use(
    (response) => {
        return response;
    },
    (error) => {
        // Handle specific error codes
        if (error.response) {
            const { status } = error.response;
            
            // Handle 401 Unauthorized errors (token expired, etc.)
            if (status === 401) {
                // Clear stored token
                localStorage.removeItem('authToken');
                // You could redirect to login page here
                // window.location.href = '/login';
            }
            
            // Return more detailed error information
            return Promise.reject({
                status: status,
                data: error.response.data,
                originalError: error
            });
        }
        
        return Promise.reject(error);
    }
);

export default axiosInstance;