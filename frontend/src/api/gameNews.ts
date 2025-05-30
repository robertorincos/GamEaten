import axiosInstance from './axiosconfig';

// Types for Game News/Giveaways
export interface GameGiveaway {
  id: number;
  title: string;
  description: string;
  image: string;
  thumbnail: string;
  instructions: string;
  open_giveaway_url: string;
  published_date: string;
  type: string;
  platforms: string;
  end_date: string;
  users: number;
  status: string;
  worth: string;
  gamerpower_url: string;
  open_giveaway: string;
}

export interface GameNewsResponse {
  status: string;
  data: GameGiveaway[];
  count: number;
  filters?: {
    type: string;
    platform: string;
    sort_by: string;
  };
  min_value?: string;
}

export interface GameWorthSummaryResponse {
  status: string;
  data: {
    active_giveaways_number: number;
    worth_estimation_usd: string;
    min_value: string;
  };
  type: 'worth_summary';
}

export interface GameNewsFilters {
  type?: 'game' | 'loot' | 'beta' | '';
  platform?: 'pc' | 'steam' | 'epic-games-store' | 'ubisoft' | 'gog' | 'itchio' | 'ps4' | 'ps5' | 'xbox-one' | 'xbox-series-xs' | 'switch' | 'android' | 'ios' | 'vr' | 'battlenet' | '';
  sortBy?: 'date' | 'value' | 'popularity';
}

// Game News API Functions
export const gameNewsAPI = {
  /**
   * Get game giveaways and deals with optional filters
   */
  getGameNews: async (filters?: GameNewsFilters): Promise<GameNewsResponse> => {
    try {
      const params = new URLSearchParams();
      
      if (filters?.type) {
        params.append('type', filters.type);
      }
      if (filters?.platform) {
        params.append('platform', filters.platform);
      }
      if (filters?.sortBy) {
        params.append('sort-by', filters.sortBy);
      }
      
      const queryString = params.toString();
      const url = queryString ? `/api/game-news?${queryString}` : '/api/game-news';
      
      const response = await axiosInstance.get(url);
      return response.data;
    } catch (error: any) {
      console.error('Error fetching game news:', error);
      throw error;
    }
  },

  /**
   * Get giveaways worth summary for a specific minimum value
   * Returns summary data, not individual giveaways
   */
  getGiveawaysWorthSummary: async (minValue: number = 0): Promise<GameWorthSummaryResponse> => {
    try {
      const response = await axiosInstance.get(`/api/game-news/worth?min_value=${minValue}`);
      return response.data;
    } catch (error: any) {
      console.error('Error fetching giveaways worth summary:', error);
      throw error;
    }
  },

  /**
   * @deprecated Use getGiveawaysWorthSummary instead - this endpoint returns summary data, not individual giveaways
   */
  getValuableGiveaways: async (minValue: number = 0): Promise<GameWorthSummaryResponse> => {
    console.warn('getValuableGiveaways is deprecated - use getGiveawaysWorthSummary instead. This endpoint returns summary data, not individual giveaways.');
    return gameNewsAPI.getGiveawaysWorthSummary(minValue);
  },

  /**
   * Get giveaways by specific type
   */
  getGiveawaysByType: async (type: 'game' | 'loot' | 'beta'): Promise<GameNewsResponse> => {
    return gameNewsAPI.getGameNews({ type });
  },

  /**
   * Get giveaways by platform
   */
  getGiveawaysByPlatform: async (platform: GameNewsFilters['platform']): Promise<GameNewsResponse> => {
    return gameNewsAPI.getGameNews({ platform });
  },

  /**
   * Get latest game giveaways
   */
  getLatestGiveaways: async (): Promise<GameNewsResponse> => {
    return gameNewsAPI.getGameNews({ sortBy: 'date' });
  },

  /**
   * Get most valuable giveaways
   */
  getMostValuableGiveaways: async (): Promise<GameNewsResponse> => {
    return gameNewsAPI.getGameNews({ sortBy: 'value' });
  },

  /**
   * Get most popular giveaways
   */
  getMostPopularGiveaways: async (): Promise<GameNewsResponse> => {
    return gameNewsAPI.getGameNews({ sortBy: 'popularity' });
  }
};

export default gameNewsAPI; 