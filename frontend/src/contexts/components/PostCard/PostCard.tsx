import { Card, CardContent, CardHeader, IconButton, Typography, Box, Avatar } from '@mui/material';
import FavoriteIcon from '@mui/icons-material/Favorite';
import ShareIcon from '@mui/icons-material/Share';
import CommentIcon from '@mui/icons-material/Comment';

const PostCard = () => {
  return (
    <Card sx={{ borderRadius: '16px' }}>
      <CardHeader
        avatar={<Avatar />}
        title="Username"
        subheader="Posted time"
      />
      <CardContent>
        <Typography variant="body1" gutterBottom>
          Post content goes here...
        </Typography>
        <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
          <IconButton>
            <FavoriteIcon />
          </IconButton>
          <IconButton>
            <ShareIcon />
          </IconButton>
          <IconButton>
            <CommentIcon />
          </IconButton>
        </Box>
      </CardContent>
    </Card>
  );
};

export default PostCard;