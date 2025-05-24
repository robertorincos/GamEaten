import axiosInstance from './axiosconfig';

export interface LoginCredentials {
    email: string;
    pass: string;
}

export interface RegisterData {
    user: string;
    email: string;
    pass: string;
}

export interface AuthResponse {
    status: string;
    token?: string;
}

export interface UserResponse {
    status: string;
}

export interface PasswordChangeData {
    current_pass?: string;
    new: string;
}

/**
 * Login a user with their credentials
 */
export const login = async (credentials: LoginCredentials): Promise<AuthResponse> => {
    try {
        const response = await axiosInstance.post<AuthResponse>('/api/login', credentials);
        
        if (response.data.token) {
            // Store the token in localStorage
            localStorage.setItem('authToken', response.data.token);
        }
        
        return response.data;
    } catch (error) {
        throw error;
    }
};

/**
 * Register a new user
 */

/**
 * Logout current user - clear token
 */
export const logout = (): void => {
    localStorage.removeItem('authToken');
};

/**
 * Get current user info
 */
export const getCurrentUser = async (): Promise<UserResponse> => {
    try {
        const response = await axiosInstance.post<UserResponse>('/api/user');
        return response.data;
    } catch (error) {
        throw error;
    }
};

/**
 * Change user password
 */
export const changePassword = async (data: PasswordChangeData): Promise<any> => {
    try {
        const response = await axiosInstance.post('/api/change-password', data);
        return response.data;
    } catch (error) {
        throw error;
    }
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = (): boolean => {
    const token = localStorage.getItem('authToken');
    return !!token; // Returns true if token exists, false otherwise
};

export const register = async (userData: RegisterData): Promise<any> => {
    try {
        const response = await axiosInstance.post('/api/register', userData, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        return response.data;
    } catch (error) {
        throw error;
    }
};
