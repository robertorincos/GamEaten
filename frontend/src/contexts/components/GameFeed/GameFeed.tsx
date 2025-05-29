import { Box, CircularProgress, Typography } from '@mui/material';
import { useState, useEffect } from 'react';
import PostCard from '../PostCard/PostCard.tsx';
import { getReviews, getGameDetails } from '../../../api/funcs.ts';
import { isAuthenticated } from '../../../api/auth.ts';

interface GameFeedProps {
  refresh?: boolean;
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
}

interface GameInfo {
  id: number;
  name: string;
  // Removed cover property to avoid unnecessary API calls
}

const GameFeed = ({ refresh }: GameFeedProps) => {
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [gameInfoCache, setGameInfoCache] = useState<Record<number, GameInfo>>({});
  const [error, setError] = useState<string | null>(null);
  const [highlightedReview, setHighlightedReview] = useState<number | null>(null);

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
        // Fetch game details for each unique game ID (only names, no images for efficiency)
        const uniqueGameIds = [...new Set(response.comments.map((review: { id_game: any; }) => review.id_game))];
        
        // Create a batch of promises for all game detail requests
        const gameDetailPromises = uniqueGameIds.map(async (gameId) => {
          if (!gameInfoCache[gameId as number]) {
            try {
              const gameData = await getGameDetails({ id: gameId as number });
              
              // Check if we received valid game data
              if (gameData && gameData.length > 0 && gameData[0]) {
                const game = gameData[0];
                
                return {
                  id: gameId as number,
                  data: {
                    id: gameId as number,
                    name: game.name || 'Unknown Game'
                  }
                };
              }
            } catch (err) {
              console.error(`Failed to fetch details for game ${gameId}:`, err);
            }
          }
          return null;
        });
        
        // Wait for all game detail requests to complete
        const gameResults = await Promise.all(gameDetailPromises);
        
        // Update the cache with all fetched game data
        const newCache = { ...gameInfoCache };
        gameResults.forEach(result => {
          if (result && result.data) {
            // Cast the ID to number when using as an index
            newCache[result.id as number] = result.data;
          }
        });
        
        setGameInfoCache(newCache);      }
    } catch (err) {
      console.error('Failed to fetch reviews:', err);
      setError('Failed to load reviews. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleReviewClick = (reviewId: number) => {
    setHighlightedReview(highlightedReview === reviewId ? null : reviewId);
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
        // Determine review type based on content
        let reviewType: 'text' | 'gif' | 'mixed' = 'text';
        if (review.has_text && review.has_gif) {
          reviewType = 'mixed';
        } else if (review.has_gif) {
          reviewType = 'gif';
        }

        return (
          <PostCard 
            key={review.id}
            id={review.id}
            username={review.username}
            text={review.review_text}
            date={review.date_created}
            gameId={review.id_game}
            gameName={gameInfoCache[review.id_game]?.name || 'Loading...'}
            gifUrl={review.gif_url}
            commentType={reviewType}
            commentCount={review.comment_count || 0}
            isHighlighted={highlightedReview === review.id}
            onReviewClick={() => handleReviewClick(review.id)}
          />
        );
      })}
    </Box>
  );
};

export default GameFeed;