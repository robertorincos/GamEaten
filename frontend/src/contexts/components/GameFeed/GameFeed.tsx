import { Box, CircularProgress, Typography } from '@mui/material';
import { useState, useEffect } from 'react';
import PostCard from '../PostCard/PostCard.tsx';
import { getComments, getGameDetails } from '../../../api/funcs.ts';
import { isAuthenticated } from '../../../api/auth.ts';

interface GameFeedProps {
  refresh?: boolean;
}

interface Comment {
  id: number;
  id_game: number;
  username: string;
  comment: string;
  date_created: string;
}

interface GameInfo {
  id: number;
  name: string;
  cover?: string;
}

const GameFeed = ({ refresh }: GameFeedProps) => {
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<Comment[]>([]);
  const [gameInfoCache, setGameInfoCache] = useState<Record<number, GameInfo>>({});
  const [error, setError] = useState<string | null>(null);

  const fetchComments = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch comments based on which tab we're on. Default to global feed.
      // For now, using 'ambos' to get all comments
      const response = await getComments({
        id_game: 0, // Not filtering by specific game for the feed
        busca: 'ambos', // Get all comments
        page: 1,
        size: 20
      });
      
      if (response && response.comments) {
        setComments(response.comments);
        
        // Fetch game details for each unique game ID
        const uniqueGameIds: number[] = [...new Set<number>(response.comments.map((comment: Comment) => comment.id_game))];
        await Promise.all(
          uniqueGameIds.map(async (gameId: number) => {
            if (!gameInfoCache[gameId]) {
              try {
                const gameData = await getGameDetails({ id: gameId });
                if (gameData) {
                  setGameInfoCache(prev => ({
                    ...prev,
                    [gameId]: {
                      id: gameId,
                      name: gameData.name || 'Unknown Game',
                      cover: gameData.cover || undefined
                    }
                  }));
                }
              } catch (err) {
                console.error(`Failed to fetch details for game ${gameId}:`, err);
              }
            }
          })
        );
      }
    } catch (err) {
      console.error('Failed to fetch comments:', err);
      setError('Failed to load reviews. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated()) {
      fetchComments();
    } else {
      setLoading(false);
      setComments([]);
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

  if (comments.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="#8899a6">No reviews found. Be the first to share your gaming experience!</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {comments.map((comment) => (
        <PostCard 
          key={comment.id}
          id={comment.id}
          username={comment.username}
          text={comment.comment}
          date={comment.date_created}
          gameId={comment.id_game}
          gameName={gameInfoCache[comment.id_game]?.name || 'Loading...'}
          gameImage={gameInfoCache[comment.id_game]?.cover}
        />
      ))}
    </Box>
  );
};

export default GameFeed;