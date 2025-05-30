import axiosInstance from './axiosconfig';

// Game search cache interface
interface CacheItem {
  id: number;
  timestamp: number;
}

interface GameSearchCache {
  [query: string]: CacheItem;
}

// Game info cache interface
interface GameInfo {
  id: number;
  name: string;
  cover_url?: string;
  rating?: number;
}

interface GameInfoCache {
  [gameId: number]: {
    data: GameInfo;
    timestamp: number;
  };
}

// Cache configuration
const CACHE_EXPIRY = 1000 * 60 * 30; // 30 minutes
let gameSearchCache: GameSearchCache = {};
let gameInfoCache: GameInfoCache = {};

export interface GameSearchQuery {
    query: string;
}

export interface GameQuery {
    id: number;
}

export interface BulkGamesQuery {
    game_ids: number[];
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

export interface ReviewData {
    id_game: number;
    review_text?: string;
    gif_url?: string;
    comment_type?: 'text' | 'gif' | 'mixed';
}

export interface CommentData {
    review_id: number;
    parent_id?: number;
    comment?: string;
    gif_url?: string;
    comment_type?: 'text' | 'gif' | 'mixed';
}

export interface CommentUpdateData {
    new_comment: string;
}

export interface ReviewQueryParams {
    id_game: number;
    busca: string;
    page?: number;
    size?: number;
    user_id?: number;
}

export interface GameSearchSuggestionsResponse {
  id: number;
  name: string;
  cover_url?: string;
}

export interface UserProfileData {
    id: number;
    username: string;
    follower_count: number;
    following_count: number;
    review_count: number;
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

export interface UserSearchQuery {
    query: string;
    limit?: number;
}

export interface UserSearchResult {
    id: number;
    username: string;
    created_at: string;
    reviews_count: number;
    recent_game?: {
        id: number;
        name: string;
        cover_url?: string;
    };
    is_following: boolean;
    followers_count: number;
    following_count: number;
    relevance_score: number;
}

export interface UserSearchResponse {
    users: UserSearchResult[];
    total: number;
    query: string;
}

export interface SearchSuggestion {
    type: 'user' | 'game';
    id: number;
    title: string;
    subtitle: string;
    icon: 'user' | 'gamepad';
    cover_url?: string;
}

export interface SearchSuggestionsQuery {
    query: string;
    include_users?: boolean;
    include_games?: boolean;
}

export interface SearchSuggestionsResponse {
    suggestions: SearchSuggestion[];
    query: string;
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
 * Search for users by username
 */
export const searchUsers = async (searchQuery: { query: string }): Promise<{ id: number; username: string; profile_photo?: string; }[]> => {
    try {
        const query = searchQuery.query.trim();
        
        // Don't search empty or very short queries
        if (!query || query.length < 2) {
            return [];
        }
        
        // Make API call to search users
        const response = await axiosInstance.post('/api/search/users', { query });
        
        if (response.data && Array.isArray(response.data.users)) {
            return response.data.users;
        } else {
            return [];
        }
    } catch (error) {
        console.error('Error searching for users:', error);
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
    // Check cache first
    const cached = gameInfoCache[id];
    if (cached && Date.now() - cached.timestamp < CACHE_EXPIRY) {
      return [cached.data]; // Return in array format for backward compatibility
    }
    
    // Change to POST request with data in body as required by the API
    const response = await axiosInstance.post('/api/game', { id });
    
    // Cache the response
    if (response.data && response.data.length > 0) {
      gameInfoCache[id] = {
        data: response.data[0],
        timestamp: Date.now()
      };
    }
    
    return response.data;
  } catch (error) {
    console.error('API Error - getGameDetails:', error);
    throw error;
  }
};

/**
 * Bulk fetch multiple games efficiently
 */
export const getBulkGames = async ({ game_ids }: BulkGamesQuery): Promise<Record<number, GameInfo>> => {
  try {
    if (!game_ids || game_ids.length === 0) {
      return {};
    }

    // Check cache for already fetched games
    const cached: Record<number, GameInfo> = {};
    const missingIds: number[] = [];
    
    game_ids.forEach(id => {
      const cachedGame = gameInfoCache[id];
      if (cachedGame && Date.now() - cachedGame.timestamp < CACHE_EXPIRY) {
        cached[id] = cachedGame.data;
      } else {
        missingIds.push(id);
      }
    });

    // Fetch missing games from backend
    if (missingIds.length > 0) {
      const response = await axiosInstance.post('/api/games/bulk', { game_ids: missingIds });
      
      if (response.data && response.data.games) {
        // Cache the new games
        Object.entries(response.data.games).forEach(([gameId, gameData]) => {
          const id = parseInt(gameId);
          gameInfoCache[id] = {
            data: gameData as GameInfo,
            timestamp: Date.now()
          };
          cached[id] = gameData as GameInfo;
        });
      }
    }

    return cached;
  } catch (error) {
    console.error('API Error - getBulkGames:', error);
    // Return cached games even if fetch fails
    const cached: Record<number, GameInfo> = {};
    game_ids.forEach(id => {
      const cachedGame = gameInfoCache[id];
      if (cachedGame) {
        cached[id] = cachedGame.data;
      }
    });
    return cached;
  }
};

/**
 * Clear the game info cache
 */
export const clearGameInfoCache = (): void => {
    gameInfoCache = {};
    console.log('Game info cache cleared');
};

/**
 * Create a new review
 */
export const createReview = async (reviewData: ReviewData): Promise<any> => {
    try {
        const response = await axiosInstance.post('/api/review', reviewData);
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
        const response = await axiosInstance.post('/api/comment', commentData);
        return response.data;
    } catch (error) {
        throw error;
    }
};

/**
 * Get comments for a specific review
 */
export const getReviewComments = async (reviewId: number): Promise<any> => {
    try {
        const response = await axiosInstance.get(`/api/review/${reviewId}/comments`);
        return response.data;
    } catch (error) {
        console.error('API Error - getReviewComments:', error);
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
 * Get reviews based on query parameters
 */
export const getReviews = async ({
  id_game,
  busca,
  page = 1,
  size = 20,
  user_id
}: ReviewQueryParams) => {
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
    console.error('API Error - getReviews:', error);
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

/**
 * Like or unlike a review
 */
export const likeUnlikeReview = async (reviewId: number): Promise<{
    status: string;
    liked: boolean;
    like_count: number;
}> => {
    try {
        const response = await axiosInstance.post(`/api/review/${reviewId}/like`);
        return response.data;
    } catch (error) {
        console.error('API Error - likeUnlikeReview:', error);
        throw error;
    }
};

/**
 * Repost or un-repost a review
 */
export const repostUnrepostReview = async (reviewId: number, repostText?: string): Promise<{
    status: string;
    reposted: boolean;
    repost_count: number;
    repost_id?: number;
}> => {
    try {
        const data = repostText ? { repost_text: repostText } : {};
        const response = await axiosInstance.post(`/api/review/${reviewId}/repost`, data);
        return response.data;
    } catch (error) {
        console.error('API Error - repostUnrepostReview:', error);
        throw error;
    }
};

/**
 * Get reposts feed
 */
export const getReposts = async (page: number = 1, size: number = 20): Promise<{
    reposts: any[];
    pagination: {
        total: number;
        pages: number;
        current_page: number;
        per_page: number;
    };
}> => {
    try {
        const response = await axiosInstance.get('/api/reposts', {
            params: { page, size }
        });
        return response.data;
    } catch (error) {
        console.error('API Error - getReposts:', error);
        throw error;
    }
};

/**
 * Get unified search suggestions (users + games from cache)
 */
export const getSearchSuggestions = async (searchQuery: SearchSuggestionsQuery): Promise<SearchSuggestionsResponse> => {
    try {
        const response = await axiosInstance.post('/api/search/suggestions', searchQuery);
        return response.data;
    } catch (error) {
        console.error('API Error - getSearchSuggestions:', error);
        // Return empty suggestions on error instead of throwing
        return { suggestions: [], query: searchQuery.query };
    }
};

/**
 * Get the most reviewed games of the week with their latest review
 */
export const getMostReviewedGamesWeek = async (): Promise<{
    status: string;
    games: Array<{
        game: {
            id: number;
            name: string;
            cover_url?: string;
            rating?: number;
            summary?: string;
            release_date?: string;
            platforms?: string[];
            artwork_urls?: string[];
        };
        review_count: number;
        latest_review?: {
            id: number;
            username: string;
            profile_photo?: string;
            review_text: string;
            date_created: string;
            gif_url?: string;
            has_text: boolean;
            has_gif: boolean;
            comment_count: number;
            likes_count: number;
            user_has_liked: boolean;
            reposts_count: number;
            user_has_reposted: boolean;
        };
    }>;
    count: number;
    message?: string;
}> => {
    try {
        const response = await axiosInstance.get('/api/games/most-reviewed-week');
        return response.data;
    } catch (error) {
        console.error('API Error - getMostReviewedGamesWeek:', error);
        throw error;
    }
};

/**
 * Delete a review (only the owner can delete their review)
 */
export const deleteReview = async (reviewId: number): Promise<{
    status: string;
}> => {
    try {
        const response = await axiosInstance.delete(`/api/review/${reviewId}`);
        return response.data;
    } catch (error) {
        console.error('API Error - deleteReview:', error);
        throw error;
    }
};