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
    total_savings_message: string;
  };
  type: 'total_savings_summary';
}

export interface CompleteGameNewsResponse {
  status: string;
  giveaways: {
    data: GameGiveaway[];
    count: number;
    filters: {
      type: string;
      platform: string;
      sort_by: string;
    };
  };
  worth_summary: {
    active_giveaways_number: number;
    worth_estimation_usd: string;
    total_savings_message: string;
  };
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
   * Get giveaways worth summary - now automatically calculates total savings
   * No longer requires minValue parameter
   */
  getGiveawaysWorthSummary: async (): Promise<GameWorthSummaryResponse> => {
    try {
      const response = await axiosInstance.get('/api/game-news/worth');
      return response.data;
    } catch (error: any) {
      console.error('Error fetching total savings summary:', error);
      throw error;
    }
  },

  /**
   * Get both giveaways and worth summary in a single efficient call
   */
  getCompleteGameNews: async (filters?: GameNewsFilters): Promise<CompleteGameNewsResponse> => {
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
      const url = queryString ? `/api/game-news/complete?${queryString}` : '/api/game-news/complete';
      
      const response = await axiosInstance.get(url);
      return response.data;
    } catch (error: any) {
      console.error('Error fetching complete game news:', error);
      throw error;
    }
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