import { Card, CardContent, CardHeader, IconButton, Typography, Box, Avatar, Divider } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHeart, faComment, faShare, faEllipsisH, faGamepad } from '@fortawesome/free-solid-svg-icons';
import { useState } from 'react';
import { format, parseISO, formatDistanceToNow } from 'date-fns';

interface PostCardProps {
  id: number;
  username: string;
  text: string;
  date: string;
  gameId: number;
  gameName: string;
  gameImage?: string;
}

const PostCard = ({ id, username, text, date, gameId, gameName, gameImage }: PostCardProps) => {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(Math.floor(Math.random() * 50)); // Random placeholder
  const [commentCount, setCommentCount] = useState(Math.floor(Math.random() * 10)); // Random placeholder
  
  // Format date
  const formatDate = (dateString: string) => {
    try {
      const parsedDate = parseISO(dateString);
      const timeAgo = formatDistanceToNow(parsedDate, { addSuffix: false });
      return timeAgo;
    } catch (error) {
      return 'recently';
    }
  };

  const handleLike = () => {
    if (liked) {
      setLikeCount(prev => prev - 1);
    } else {
      setLikeCount(prev => prev + 1);
    }
    setLiked(!liked);
  };

  const handleGoToGame = () => {
    window.location.href = `/game/${gameId}`;
  };

  return (
    <Card sx={{ 
      borderRadius: '16px', 
      backgroundColor: '#172331', 
      color: 'white',
      boxShadow: 'none',
      mb: 2,
      border: '1px solid #1e2c3c'
    }}>
      <CardHeader
        avatar={
          <Avatar sx={{ width: 48, height: 48, bgcolor: '#1da1f2' }}>
            {username.charAt(0).toUpperCase()}
          </Avatar>
        }
        action={
          <IconButton sx={{ color: '#8899a6' }}>
            <FontAwesomeIcon icon={faEllipsisH} />
          </IconButton>
        }
        title={
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{username}</Typography>
            <Typography variant="body2" sx={{ ml: 1, color: '#8899a6' }}>@{username.toLowerCase()}</Typography>
            <Typography variant="body2" sx={{ ml: 1, color: '#8899a6' }}>· {formatDate(date)}</Typography>
          </Box>
        }
        subheader={
          <Typography 
            variant="body2" 
            sx={{ 
              color: '#8899a6', 
              mt: 0.5, 
              cursor: 'pointer',
              '&:hover': { textDecoration: 'underline' }
            }}
            onClick={handleGoToGame}
          >
            <FontAwesomeIcon icon={faGamepad} style={{ marginRight: '5px' }} />
            {gameName}
          </Typography>
        }
        sx={{
          '& .MuiCardHeader-title': { display: 'block' },
          '& .MuiCardHeader-subheader': { color: '#8899a6' }
        }}
      />
      <CardContent sx={{ pt: 0 }}>
        <Typography variant="body1" sx={{ mb: 2, lineHeight: 1.5, whiteSpace: 'pre-line' }}>
          {text}
        </Typography>
        
        {gameImage && (
          <Box 
            sx={{ 
              height: '200px', 
              backgroundColor: '#1e2c3c', 
              borderRadius: '16px', 
              mb: 2,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundImage: `url(${gameImage})`,
              cursor: 'pointer'
            }}
            onClick={handleGoToGame}
          />
        )}
        
        <Divider sx={{ borderColor: '#1e2c3c', my: 1 }} />
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 1 }}>
          <Box 
            sx={{ 
              display: 'flex',
              alignItems: 'center',
              color: liked ? '#f91880' : '#8899a6', 
              '&:hover': { color: '#f91880' },
              cursor: 'pointer'
            }}
            onClick={handleLike}
          >
            <FontAwesomeIcon icon={faHeart} />
            <Typography variant="body2" fontSize="13px" sx={{ ml: 1 }}>{likeCount}</Typography>
          </Box>
          
          <Box 
            sx={{ 
              display: 'flex',
              alignItems: 'center',
              color: '#8899a6', 
              '&:hover': { color: '#1da1f2' },
              cursor: 'pointer'
            }}
            onClick={() => window.location.href = `/game/${gameId}#comments`}
          >
            <FontAwesomeIcon icon={faComment} />
            <Typography variant="body2" fontSize="13px" sx={{ ml: 1 }}>{commentCount}</Typography>
          </Box>
          
          <Box sx={{ 
            display: 'flex',
            alignItems: 'center',
            color: '#8899a6', 
            '&:hover': { color: '#00ba7c' },
            cursor: 'pointer'
          }}>
            <FontAwesomeIcon icon={faShare} />
            <Typography variant="body2" fontSize="13px" sx={{ ml: 1 }}>Share</Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default PostCard;