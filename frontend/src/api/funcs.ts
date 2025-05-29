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

export interface GifSearchQuery {
    query: string;
    limit?: number;
    offset?: number;
    rating?: 'y' | 'g' | 'pg' | 'pg-13' | 'r';
}

export interface GifData {
    id: string;
    title: string;
    url: string;
    images: {
        original: {
            url: string;
            width: string;
            height: string;
            size?: string;
        };
        preview: {
            url: string;
            width: string;
            height: string;
        };
        fixed_height: {
            url: string;
            width: string;
            height: string;
        };
        fixed_width: {
            url: string;
            width: string;
            height: string;
        };
        downsized: {
            url: string;
            width: string;
            height: string;
        };
    };
}

export interface GifSearchResponse {
    gifs: GifData[];
    pagination: {
        total_count: number;
        count: number;
        offset: number;
    };
    query: string;
}

export interface CommentData {
    id_game: number;
    comment?: string;
    gif_url?: string;
    comment_type?: 'text' | 'gif' | 'mixed';
}

export interface CommentUpdateData {
    new_comment: string;
}

export interface CommentQueryParams {
    id_game: number;
    busca: string;
    page?: number;
    size?: number;
    user_id?: number;
}

export interface GameSearchSuggestionsResponse {
  id: number;
  name: string;
}

export interface UserProfileData {
    id: number;
    username: string;
    follower_count: number;
    following_count: number;
    comment_count: number;
    is_following: boolean;
    is_own_profile: boolean;
}

export interface UserProfileResponse {
    status: string;
    user: UserProfileData;
}

export interface FollowResponse {
    status: string;
    is_following: boolean;
}

export interface UserListItem {
    id: number;
    username: string;
}

export interface UserListResponse {
    status: string;
    followers?: UserListItem[];
    following?: UserListItem[];
    pagination: {
        total: number;
        pages: number;
        current_page: number;
        per_page: number;
    };
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
        const response = await axiosInstance.post<number>('/api/search', searchQuery);
        
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
        const response = await axiosInstance.post<GameSearchSuggestionsResponse[]>('/api/suggestions', searchQuery);
        
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
export const getGameDetails = async ({ id }: { id: number }) => {
  try {
    // Change to POST request with data in body as required by the API
    const response = await axiosInstance.post('/api/game', { id });
    return response.data;
  } catch (error) {
    console.error('API Error - getGameDetails:', error);
    throw error;
  }
};

/**
 * Create a new comment
 */
export const createComment = async (commentData: CommentData): Promise<any> => {
    try {
        const response = await axiosInstance.post('/api/comment', commentData);
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
        const response = await axiosInstance.put(`/api/comment/${commentId}`, data);
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
        const response = await axiosInstance.delete(`/api/comment/${commentId}`);
        return response.data;
    } catch (error) {
        throw error;
    }
};

/**
 * Get comments based on query parameters
 */
export const getComments = async ({
  id_game,
  busca,
  page = 1,
  size = 20,
  user_id
}: CommentQueryParams) => {
  try {
    // Use GET request with query parameters instead of POST with body
    const response = await axiosInstance.get('/api/ver', {
      params: { 
        page, 
        size,
        id_game,
        busca,
        ...(user_id ? { user_id } : {})
      }
    });
    return response.data;
  } catch (error) {
    console.error('API Error - getComments:', error);
    throw error;
  }
};

/**
 * Check authentication status
 */
export const checkAuth = async (): Promise<any> => {
    try {
        const response = await axiosInstance.get('/api/auth');
        return response.data;
    } catch (error) {
        throw error;
    }
};

/**
 * Search for GIFs using Giphy API
 */
export const searchGifs = async (data: GifSearchQuery): Promise<GifSearchResponse> => {
  try {
    const response = await axiosInstance.post('/api/gifs/search', data);
    return response.data;
  } catch (error) {
    console.error('API Error - searchGifs:', error);
    throw error;
  }
};

/**
 * Get trending GIFs
 */
export const getTrendingGifs = async (params?: {
  limit?: number;
  offset?: number;
  rating?: string;
}): Promise<GifSearchResponse> => {
  try {
    const response = await axiosInstance.get('/api/gifs/trending', { params });
    return response.data;
  } catch (error) {
    console.error('API Error - getTrendingGifs:', error);
    throw error;
  }
};

/**
 * Get GIF categories
 */
export const getGifCategories = async (): Promise<any> => {
  try {
    const response = await axiosInstance.get('/api/gifs/categories');
    return response.data;
  } catch (error) {
    console.error('API Error - getGifCategories:', error);
    throw error;
  }
};

/**
 * Get user profile by username
 */
export const getUserProfile = async (username: string): Promise<UserProfileResponse> => {
    try {
        const response = await axiosInstance.get(`/api/user/${username}`);
        return response.data;
    } catch (error) {
        console.error('API Error - getUserProfile:', error);
        throw error;
    }
};

/**
 * Follow or unfollow a user
 */
export const followUser = async (username: string): Promise<FollowResponse> => {
    try {
        const response = await axiosInstance.post('/api/follow', { username });
        return response.data;
    } catch (error) {
        console.error('API Error - followUser:', error);
        throw error;
    }
};

/**
 * Get user followers list
 */
export const getUserFollowers = async (
    username: string, 
    page: number = 1, 
    size: number = 20
): Promise<UserListResponse> => {
    try {
        const response = await axiosInstance.get(`/api/user/${username}/followers`, {
            params: { page, size }
        });
        return response.data;
    } catch (error) {
        console.error('API Error - getUserFollowers:', error);
        throw error;
    }
};

/**
 * Get user following list
 */
export const getUserFollowing = async (
    username: string, 
    page: number = 1, 
    size: number = 20
): Promise<UserListResponse> => {
    try {
        const response = await axiosInstance.get(`/api/user/${username}/following`, {
            params: { page, size }
        });
        return response.data;
    } catch (error) {
        console.error('API Error - getUserFollowing:', error);
        throw error;
    }
};