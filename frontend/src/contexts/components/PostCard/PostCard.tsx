import { Card, CardContent, CardHeader, IconButton, Typography, Box, Avatar, Divider } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHeart, faComment, faShare, faEllipsisH } from '@fortawesome/free-solid-svg-icons';

const PostCard = () => {
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
        avatar={<Avatar sx={{ width: 48, height: 48 }} />}
        action={
          <IconButton sx={{ color: '#8899a6' }}>
            <FontAwesomeIcon icon={faEllipsisH} />
          </IconButton>
        }
        title={
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Username</Typography>
            <Typography variant="body2" sx={{ ml: 1, color: '#8899a6' }}>@username</Typography>
            <Typography variant="body2" sx={{ ml: 1, color: '#8899a6' }}>· 2h</Typography>
          </Box>
        }
        subheader={
          <Typography variant="body2" sx={{ color: '#8899a6', mt: 0.5 }}>
            Playing Game Name
          </Typography>
        }
        sx={{
          '& .MuiCardHeader-title': { display: 'block' },
          '& .MuiCardHeader-subheader': { color: '#8899a6' }
        }}
      />
      <CardContent sx={{ pt: 0 }}>
        <Typography variant="body1" sx={{ mb: 2, lineHeight: 1.5 }}>
          Just reached level 50 in this amazing game! The boss fight was incredibly challenging but the loot was worth it. Has anyone else tried the new expansion yet? #gaming #victory
        </Typography>
        
        <Box 
          sx={{ 
            height: '200px', 
            backgroundColor: '#1e2c3c', 
            borderRadius: '16px', 
            mb: 2,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Typography variant="body2" color="#8899a6">
            Game screenshot
          </Typography>
        </Box>
        
        <Divider sx={{ borderColor: '#1e2c3c', my: 1 }} />
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 1 }}>
          <Box sx={{ 
            display: 'flex',
            alignItems: 'center',
            color: '#8899a6', 
            '&:hover': { color: '#f91880' },
            cursor: 'pointer'
          }}>
            <FontAwesomeIcon icon={faHeart} />
            <Typography variant="body2" fontSize="13px" sx={{ ml: 1 }}>24</Typography>
          </Box>
          
          <Box sx={{ 
            display: 'flex',
            alignItems: 'center',
            color: '#8899a6', 
            '&:hover': { color: '#1da1f2' },
            cursor: 'pointer'
          }}>
            <FontAwesomeIcon icon={faComment} />
            <Typography variant="body2" fontSize="13px" sx={{ ml: 1 }}>5</Typography>
          </Box>
          
          <Box sx={{ 
            display: 'flex',
            alignItems: 'center',
            color: '#8899a6', 
            '&:hover': { color: '#00ba7c' },
            cursor: 'pointer'
          }}>
            <FontAwesomeIcon icon={faShare} />
            <Typography variant="body2" fontSize="13px" sx={{ ml: 1 }}>2</Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default PostCard;