import axiosInstance from './axiosconfig';

// Game search cache interface
interface CacheItem {
  id: number;
  timestamp: number;
}

interface GameSearchCache {
  [query: string]: CacheItem;
}

// Cache configuration
const CACHE_EXPIRY = 1000 * 60 * 30; // 30 minutes
let gameSearchCache: GameSearchCache = {};

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

export interface GameSearchSuggestionsResponse {
  id: number;
  name: string;
}

/**
 * Search for a game by name with caching
 */
export const searchGame = async (searchQuery: GameSearchQuery): Promise<number> => {
    try {
        const query = searchQuery.query.trim().toLowerCase();
        
        // Don't search empty queries
        if (!query) {
            throw new Error('Search query cannot be empty');
        }
        
        // Check cache first
        const cachedItem = gameSearchCache[query];
        const now = Date.now();
        
        if (cachedItem && (now - cachedItem.timestamp < CACHE_EXPIRY)) {
            console.log('Using cached result for:', query);
            return cachedItem.id;
        }
        
        // If not in cache or expired, make API call
        const response = await axiosInstance.post<number>('/search', searchQuery);
        
        if (typeof response.data === 'number') {
            // Update cache with the result
            gameSearchCache[query] = {
                id: response.data,
                timestamp: now
            };
            
            return response.data;
        } else {
            throw new Error('Invalid response format from game search API');
        }
    } catch (error) {
        console.error('Error searching for game:', error);
        throw error;
    }
};

/**
 * Get game search suggestions while typing
 */
export const searchGameSuggestions = async (searchQuery: GameSearchQuery): Promise<GameSearchSuggestionsResponse[]> => {
    try {
        const query = searchQuery.query.trim().toLowerCase();
        
        // Don't search empty or very short queries
        if (!query || query.length < 2) {
            return [];
        }
        
        // Check cache first (reuse existing cache mechanism)
        const cachedItem = gameSearchCache[query];
        const now = Date.now();
        
        if (cachedItem && (now - cachedItem.timestamp < CACHE_EXPIRY)) {
            console.log('Using cached suggestions for:', query);
            // Since we only have IDs in cache, this won't be as useful for suggestions
            // But we can still avoid redundant API calls
            return [{ id: cachedItem.id, name: query }];
        }
        
        // If not in cache or expired, make API call
        const response = await axiosInstance.post<GameSearchSuggestionsResponse[]>('/suggestions', searchQuery);
        
        if (Array.isArray(response.data)) {
            // Store first result in cache if available
            if (response.data.length > 0) {
                gameSearchCache[query] = {
                    id: response.data[0].id,
                    timestamp: now
                };
            }
            
            return response.data;
        } else {
            throw new Error('Invalid response format from game suggestions API');
        }
    } catch (error) {
        console.error('Error getting game suggestions:', error);
        return []; // Return empty array on error instead of throwing
    }
};

/**
 * Clear the game search cache
 */
export const clearGameSearchCache = (): void => {
    gameSearchCache = {};
    console.log('Game search cache cleared');
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
        // For GET requests with a body, we should use a POST request with a custom header
        const response = await axiosInstance.post('/ver', {
            id_game: params.id_game,
            busca: params.busca
        }, {
            params: {
                page: params.page,
                size: params.size
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