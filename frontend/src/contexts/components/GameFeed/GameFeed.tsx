import { Box } from '@mui/material';
import PostCard from '../PostCard/PostCard.tsx';

const GameFeed = () => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <PostCard />
      <PostCard />
      {/* Add more PostCards as needed */}
    </Box>
  );
};

export default GameFeed;