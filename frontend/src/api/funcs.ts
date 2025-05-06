import axiosInstance from './axiosconfig';

export interface GameSearchQuery {
    query: string;
}

export interface GameQuery {
    id: number;
}

export interface CommentData {
    id_game: number;
    comment: string;
}

export interface CommentUpdateData {
    new_comment: string;
}

export interface CommentQueryParams {
    id_game: number;
    busca: string;
    page?: number;
    size?: number;
}

/**
 * Search for a game by name
 */
export const searchGame = async (searchQuery: GameSearchQuery): Promise<number> => {
    try {
        const response = await axiosInstance.post<number>('/search', searchQuery);
        return response.data;
    } catch (error) {
        throw error;
    }
};

/**
 * Get detailed game information by ID
 */
export const getGameDetails = async (query: GameQuery): Promise<any> => {
    try {
        const response = await axiosInstance.get('/game', { data: query });
        return response.data;
    } catch (error) {
        throw error;
    }
};

/**
 * Create a new comment
 */
export const createComment = async (commentData: CommentData): Promise<any> => {
    try {
        const response = await axiosInstance.post('/comment', commentData);
        return response.data;
    } catch (error) {
        throw error;
    }
};

/**
 * Update an existing comment
 */
export const updateComment = async (commentId: number, data: CommentUpdateData): Promise<any> => {
    try {
        const response = await axiosInstance.put(`/comment/${commentId}`, data);
        return response.data;
    } catch (error) {
        throw error;
    }
};

/**
 * Delete a comment
 */
export const deleteComment = async (commentId: number): Promise<any> => {
    try {
        const response = await axiosInstance.delete(`/comment/${commentId}`);
        return response.data;
    } catch (error) {
        throw error;
    }
};

/**
 * Get comments based on query parameters
 */
export const getComments = async (params: CommentQueryParams): Promise<any> => {
    try {
        // Pass query parameters as URL params for GET request
        const queryParams: Record<string, any> = {};
        if (params.page) queryParams.page = params.page;
        if (params.size) queryParams.size = params.size;
        
        const response = await axiosInstance.get('/ver', {
            params: queryParams,
            data: {
                id_game: params.id_game,
                busca: params.busca
            }
        });
        return response.data;
    } catch (error) {
        throw error;
    }
};

/**
 * Check authentication status
 */
export const checkAuth = async (): Promise<any> => {
    try {
        const response = await axiosInstance.get('/auth');
        return response.data;
    } catch (error) {
        throw error;
    }
};