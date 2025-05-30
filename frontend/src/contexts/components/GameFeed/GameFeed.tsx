import { Box, CircularProgress, Typography, useMediaQuery, useTheme } from '@mui/material';
import { useState, useEffect } from 'react';
import PostCard from '../PostCard/PostCard.tsx';
import { getReviews, getBulkGames, getGameDetails } from '../../../api/funcs.ts';
import { isAuthenticated } from '../../../api/auth.ts';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRetweet } from '@fortawesome/free-solid-svg-icons';

interface GameFeedProps {
  refresh?: boolean;
}

interface GameInfo {
  id: number;
  name: string;
  cover_url?: string;
  rating?: number;
}

interface Review {
  id: number;
  id_game: number;
  username: string;
  review_text: string;
  date_created: string;
  gif_url?: string;
  has_text: boolean;
  has_gif: boolean;
  comment_type?: 'text' | 'gif' | 'mixed';
  comment_count?: number;
  likes_count?: number;
  user_has_liked?: boolean;
  reposts_count?: number;
  user_has_reposted?: boolean;
  feed_type?: 'review' | 'repost';
  type?: 'repost';
  original_review?: Review;
  repost_text?: string;
  created_at?: string;
  game_info?: GameInfo; // Game info is now included in the response
}

const GameFeed = ({ refresh }: GameFeedProps) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [gameInfoCache, setGameInfoCache] = useState<Record<number, GameInfo>>({});
  const [error, setError] = useState<string | null>(null);

  const fetchReviews = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch reviews based on which tab we're on. Default to global feed.
      // For now, using 'ambos' to get all reviews
      const response = await getReviews({
        id_game: 0, // Not filtering by specific game for the feed
        busca: 'ambos', // Get all reviews
        page: 1,
        size: 20
      });
      
      if (response && response.comments) { // API still returns 'comments' key for backward compatibility
        setReviews(response.comments);
        
        // Extract unique game IDs from all reviews
        const allGameIds = new Set<number>();
        
        response.comments.forEach((review: Review) => {
          allGameIds.add(review.id_game);
          // Also check reposts
          if (review.type === 'repost' && review.original_review) {
            allGameIds.add(review.original_review.id_game);
          }
        });
        
        const uniqueGameIds = Array.from(allGameIds);
        
        // Try to get games in bulk first
        try {
          const bulkGames = await getBulkGames({ game_ids: uniqueGameIds });
          
          // Update cache with bulk response
          const newCache = { ...gameInfoCache, ...bulkGames };
          setGameInfoCache(newCache);
        } catch (bulkError) {
          console.error('Bulk fetch failed, falling back to individual requests:', bulkError);
          
          // Fallback: fetch games individually (original method)
          const newCache = { ...gameInfoCache };
          
          // Only fetch games we don't already have
          const missingGameIds = uniqueGameIds.filter(id => !newCache[id]);
          
          if (missingGameIds.length > 0) {
            const gamePromises = missingGameIds.slice(0, 10).map(async (gameId) => {
              try {
                const gameData = await getGameDetails({ id: gameId });
                if (gameData && gameData.length > 0 && gameData[0]) {
                  return {
                    id: gameId,
                    data: {
                      id: gameId,
                      name: gameData[0].name || `Game ${gameId}`,
                      cover_url: gameData[0].cover?.url,
                      rating: gameData[0].rating
                    }
                  };
                }
              } catch (err) {
                console.error(`Failed to fetch game ${gameId}:`, err);
              }
              return null;
            });
            
            const gameResults = await Promise.all(gamePromises);
            
            gameResults.forEach(result => {
              if (result && result.data) {
                newCache[result.id] = result.data;
              }
            });
          }
          
          setGameInfoCache(newCache);
        }
      }
    } catch (err) {
      console.error('Failed to fetch reviews:', err);
      setError('Failed to load reviews. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated()) {
      fetchReviews();
    } else {
      setLoading(false);
      setReviews([]);
    }
  }, [refresh]); // Re-fetch when refresh changes

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress sx={{ color: '#1da1f2' }} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  if (!isAuthenticated()) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="#8899a6">Please log in to see reviews</Typography>
      </Box>
    );
  }
  if (reviews.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="#8899a6">No reviews found. Be the first to share your gaming experience!</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {reviews.map((review) => {
        // Handle reposts differently
        if (review.type === 'repost' && review.original_review) {
          const originalReview = review.original_review;
          
          // Determine review type based on original content
          let reviewType: 'text' | 'gif' | 'mixed' = 'text';
          if (originalReview.has_text && originalReview.has_gif) {
            reviewType = 'mixed';
          } else if (originalReview.has_gif) {
            reviewType = 'gif';
          }

          // Get game name from multiple sources
          const gameName = originalReview.game_info?.name || 
                           gameInfoCache[originalReview.id_game]?.name || 
                           'Unknown Game';

          return (
            <Box key={`repost-${review.id}`} sx={{ mb: 2 }}>
              {/* Repost header */}
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                mb: 1, 
                color: '#8899a6',
                fontSize: '14px'
              }}>
                <FontAwesomeIcon icon={faRetweet} style={{ marginRight: '8px' }} />
                <Typography variant="body2" sx={{ color: '#8899a6' }}>
                  {review.username} reposted
                </Typography>
              </Box>
              
              {/* Repost text if any */}
              {review.repost_text && (
                <Box sx={{ 
                  mb: 2, 
                  p: 2, 
                  backgroundColor: '#1e2c3c', 
                  borderRadius: '12px',
                  border: '1px solid #2f3336'
                }}>
                  <Typography variant="body2" sx={{ color: 'white' }}>
                    {review.repost_text}
                  </Typography>
                </Box>
              )}
              
              {/* Original review */}
              <PostCard 
                key={originalReview.id}
                id={originalReview.id}
                username={originalReview.username}
                text={originalReview.review_text}
                date={originalReview.date_created}
                gameId={originalReview.id_game}
                gameName={gameName}
                gifUrl={originalReview.gif_url}
                commentType={reviewType}
                commentCount={originalReview.comment_count || 0}
                likesCount={originalReview.likes_count || 0}
                userHasLiked={originalReview.user_has_liked || false}
                repostsCount={originalReview.reposts_count || 0}
                userHasReposted={originalReview.user_has_reposted || false}
              />
            </Box>
          );
        } else {
          // Regular review
          // Determine review type based on content
          let reviewType: 'text' | 'gif' | 'mixed' = 'text';
          if (review.has_text && review.has_gif) {
            reviewType = 'mixed';
          } else if (review.has_gif) {
            reviewType = 'gif';
          }

          // Get game name from multiple sources
          const gameName = review.game_info?.name || 
                           gameInfoCache[review.id_game]?.name || 
                           'Unknown Game';

          return (
            <PostCard 
              key={review.id}
              id={review.id}
              username={review.username}
              text={review.review_text}
              date={review.date_created}
              gameId={review.id_game}
              gameName={gameName}
              gifUrl={review.gif_url}
              commentType={reviewType}
              commentCount={review.comment_count || 0}
              likesCount={review.likes_count || 0}
              userHasLiked={review.user_has_liked || false}
              repostsCount={review.reposts_count || 0}
              userHasReposted={review.user_has_reposted || false}
            />
          );
        }
      })}
    </Box>
  );
};

export default GameFeed;