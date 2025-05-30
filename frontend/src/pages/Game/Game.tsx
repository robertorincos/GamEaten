import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Box, 
  Typography, 
  Avatar, 
  IconButton, 
  Paper, 
  InputBase, 
  List, 
  ListItem, 
  ListItemText, 
  CircularProgress,
  Tabs,
  Tab,
  Chip,
  Button,
  TextField,
  useMediaQuery,
  useTheme,
  Drawer,
  AppBar,
  Toolbar,
  Menu,
  MenuItem,
  Fab
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faHome, 
  faGift, 
  faSearch,
  faSignOutAlt,
  faGamepad,
  faUser,
  faSpinner,
  faStar,
  faCalendarAlt,
  faDesktop,
  faBookmark,
  faPencilAlt,
  faBars,
  faEllipsisV,
  faTrophy
} from '@fortawesome/free-solid-svg-icons';
import { getCurrentUser, isAuthenticated, logout } from '../../api/auth';
import { getGameDetails, searchGame, searchGameSuggestions, searchUsers, createReview, getReviews } from '../../api/funcs';
import ReviewDialog from '../../contexts/components/Review/review';
import PostCard from '../../contexts/components/PostCard/PostCard';

// Game interface based on API response
interface Platform {
  id: number;
  name: string;
}

interface Artwork {
  id: number;
  image_id: string;
  url: string;
  width: number;
  height: number;
}

interface Cover {
  id: number;
  image_id: string;
  url: string;
}

interface ReleaseDate {
  id: number;
  human: string;
}

interface GameDetails {
  id: number;
  name: string;
  summary: string;
  rating?: number;
  cover?: Cover;
  artworks?: Artwork[];
  platforms?: Platform[];
  release_dates?: ReleaseDate[];
}

interface Comment {
  id: number;
  id_game: number;
  username: string;
  user_id?: number;
  profile_photo?: string;
  review_text: string;
  date_created: string;
  gif_url?: string;
  has_text: boolean;
  has_gif: boolean;
  comment_count?: number;
  likes_count?: number;
  user_has_liked?: boolean;
  reposts_count?: number;
  user_has_reposted?: boolean;
}

//interface CommentsResponse {
//  comments: Comment[];
//  pagination: {
//    total: number;
//    pages: number;
//    current_page: number;
//   per_page: number;
//  };
//}

const Game = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = useMediaQuery(theme.breakpoints.down('lg'));
  
  const [gameDetails, setGameDetails] = useState<GameDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [username, setUsername] = useState('Guest');
  const [currentUser, setCurrentUser] = useState<{ username: string, id: number, profile_photo?: string } | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{id: number, name?: string, username?: string, type: 'game' | 'user', profile_photo?: string, cover_url?: string}>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isGameSaved, setIsGameSaved] = useState(false);
  const [savingGame, setSavingGame] = useState(false);
  
  // Mobile-specific state
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);

  // Review dialog state
  const [openReviewDialog, setOpenReviewDialog] = useState(false);

  // Fetch comments function
  const fetchComments = async () => {
    if (!id) return;
    
    try {
      setCommentLoading(true);
      const gameId = parseInt(id, 10);
        // Use the proper getReviews function from funcs.ts
      const response = await getReviews({
        id_game: gameId,
        busca: 'game',
        page: 1,
        size: 20
      });
      
      if (response && response.comments) {
        setComments(response.comments);
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
      // Show empty comments rather than crashing
      setComments([]);
    } finally {
      setCommentLoading(false);
    }
  };

  // Fetch comments
  useEffect(() => {
    fetchComments();
  }, [id]);

  // Fetch game details
  useEffect(() => {
    const fetchGameDetails = async () => {
      if (!id) return;
      
      try {
        setLoading(true);
        const gameId = parseInt(id, 10);
        
        if (isNaN(gameId)) {
          console.error('Invalid game ID');
          setLoading(false);
          return;
        }
        
        const response = await getGameDetails({ id: gameId });
        
        if (response && Array.isArray(response) && response.length > 0) {
          setGameDetails(response[0]);
        } else if (response && response.status === "Game not found") {
          console.error('Game not found');
        } else {
          console.error('Invalid game data format:', response);
        }
      } catch (error) {
        console.error('Error fetching game details:', error);
      } finally {
        setLoading(false);
      }
    };

    const fetchUser = async () => {
      if (isAuthenticated()) {
        try {
          const userData = await getCurrentUser();
          if (userData && userData.status) {
            setUsername(userData.status);
            
            // Fetch complete user data including profile photo
            const response = await fetch(`/api/user/${userData.status}`, {
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
              }
            });
            if (response.ok) {
              const data = await response.json();
              if (data.status === 'success') {
                setCurrentUser({ 
                  username: data.user.username, 
                  id: data.user.id, 
                  profile_photo: data.user.profile_photo 
                });
              }
            }
          }
        } catch (error) {
          console.error('Failed to fetch user data:', error);
        }
      }
    };

    fetchGameDetails();
    fetchUser();
  }, [id]);

  // Check if game is saved when game details and user are loaded
  useEffect(() => {
    const checkIfGameSaved = async () => {
      if (!gameDetails?.id || !isAuthenticated()) return;
      
      try {
        const response = await fetch('/api/saved-games', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          }
        });
        
        const data = await response.json();
        if (data.status === 'success') {
          const savedGameIds = data.saved_games.map((game: any) => game.game_id);
          setIsGameSaved(savedGameIds.includes(gameDetails.id));
        }
      } catch (error) {
        console.error('Error checking saved games:', error);
      }
    };

    checkIfGameSaved();
  }, [gameDetails?.id]);

  // Handle save/unsave game
  const handleSaveGame = async () => {
    if (!gameDetails?.id || !isAuthenticated()) return;
    
    try {
      setSavingGame(true);
      
      if (isGameSaved) {
        // Remove from saved games
        const response = await fetch('/api/saved-games', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          },
          body: JSON.stringify({ game_id: gameDetails.id })
        });
        
        const data = await response.json();
        if (data.status === 'success') {
          setIsGameSaved(false);
        }
      } else {
        // Add to saved games
        const response = await fetch('/api/saved-games', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          },
          body: JSON.stringify({ game_id: gameDetails.id })
        });
        
        const data = await response.json();
        if (data.status === 'success') {
          setIsGameSaved(true);
        }
      }
    } catch (error) {
      console.error('Error saving/unsaving game:', error);
    } finally {
      setSavingGame(false);
    }
  };

  // Navigate to profile with saved games tab
  const handleNavigateToSavedGames = () => {
    navigate('/profile?tab=saved-games');
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    try {
      setSearchLoading(true);
      
      // Check if it's a user search (starts with @)
      if (searchQuery.startsWith('@')) {
        const usernameQuery = searchQuery.slice(1).trim(); // Remove @ prefix
        if (usernameQuery) {
          const users = await searchUsers({ query: usernameQuery });
          if (users.length > 0) {
            // Navigate to the first user's profile
            navigate(`/profile/${users[0].username}`);
          }
        }
      } else {
        // Regular game search
        const gameId = await searchGame({ query: searchQuery });
        
        if (gameId) {
          navigate(`/game/${gameId}`);
        }
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSearchInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    if (query.trim().length >= 2) {
      setSearchLoading(true);
      try {
        // Check if it's a user search (starts with @)
        if (query.startsWith('@')) {
          const usernameQuery = query.slice(1).trim(); // Remove @ prefix
          if (usernameQuery.length >= 1) {
            const users = await searchUsers({ query: usernameQuery });
            const userSuggestions = users.map(user => ({
              id: user.id,
              username: user.username,
              type: 'user' as const,
              profile_photo: user.profile_photo
            }));
            setSuggestions(userSuggestions);
            setShowSuggestions(true);
          } else {
            setSuggestions([]);
            setShowSuggestions(false);
          }
        } else {
          // Regular game search
          const results = await searchGameSuggestions({ query });
          const gameSuggestions = results.map(game => ({
            id: game.id,
            name: game.name,
            type: 'game' as const,
            cover_url: game.cover_url
          }));
          setSuggestions(gameSuggestions);
          setShowSuggestions(true);
        }
      } catch (error) {
        console.error('Error fetching suggestions:', error);
      } finally {
        setSearchLoading(false);
      }
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSelectSuggestion = (suggestion: {id: number, name?: string, username?: string, type: 'game' | 'user'}) => {
    setShowSuggestions(false);
    if (suggestion.type === 'game') {
      navigate(`/game/${suggestion.id}`);
    } else {
      navigate(`/profile/${suggestion.username}`);
    }
  };

  const handleClickOutside = () => {
    setShowSuggestions(false);
  };

  const handleSubmitComment = async () => {
    if (!commentText.trim() || !id || !isAuthenticated()) return;
    
    try {
      const gameId = parseInt(id, 10);
      await createReview({
        id_game: gameId,
        review_text: commentText
      });
      
      // Refresh reviews after posting
      const response = await getReviews({
        id_game: gameId,
        busca: 'game',
        page: 1,
        size: 20
      });
      
      if (response && response.comments) {
        setComments(response.comments);
      }
      
      // Clear input
      setCommentText('');
    } catch (error) {
      console.error('Error posting comment:', error);
    }
  };
  // Review dialog handlers
  const handleOpenReviewDialog = () => {
    if (!isAuthenticated()) {
      // Redirect to login if not authenticated
      navigate('/login');
      return;
    }
    setOpenReviewDialog(true);
  };

  // Format cover image URL
  const formatCoverUrl = (url?: string) => {
    if (!url) return 'https://via.placeholder.com/400x400?text=No+Cover';
    
    // Handle URLs that start with //
    if (url.startsWith('//')) {
      return `https:${url.replace('t_thumb', 't_cover_big')}`;
    }
    
    // Handle URLs that already have http/https
    if (url.startsWith('http')) {
      return url.replace('t_thumb', 't_cover_big');
    }
    
    // Handle relative URLs
    return `https://images.igdb.com/igdb/image/upload/t_cover_big/${url.replace('t_thumb/', '')}`;
  };

  // Format artwork image URL
  const formatArtworkUrl = (url?: string) => {
    if (!url) return 'https://via.placeholder.com/800x400?text=No+Artwork';
    
    // Handle URLs that start with //
    if (url.startsWith('//')) {
      return `https:${url.replace('t_thumb', 't_original')}`;
    }
    
    // Handle URLs that already have http/https
    if (url.startsWith('http')) {
      return url.replace('t_thumb', 't_original');
    }
    
    // Handle relative URLs
    return `https://images.igdb.com/igdb/image/upload/t_original/${url.replace('t_thumb/', '')}`;
  };

  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: isMobile ? 'column' : 'row',
      justifyContent: 'center',
      minHeight: '100vh', 
      width: '100%',
      margin: 0,
      padding: 0,
      backgroundColor: '#0e1621'
    }}>
      {/* Mobile Header */}
      {isMobile && (
        <AppBar 
          position="sticky" 
          sx={{ 
            backgroundColor: '#0e1621', 
            borderBottom: '1px solid #1e2c3c',
            boxShadow: 'none'
          }}
        >
          <Toolbar sx={{ justifyContent: 'space-between', minHeight: '56px !important' }}>
            <IconButton 
              color="inherit" 
              onClick={() => setMobileDrawerOpen(true)}
              sx={{ p: 1 }}
            >
              <FontAwesomeIcon icon={faBars} />
            </IconButton>
            
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <FontAwesomeIcon icon={faGamepad} style={{ marginRight: '8px' }} />
              <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.1rem' }}>
                GamEaten
              </Typography>
            </Box>
            
            <IconButton 
              color="inherit" 
              onClick={(e) => setUserMenuAnchor(e.currentTarget)}
              sx={{ p: 1 }}
            >
              <FontAwesomeIcon icon={faEllipsisV} />
            </IconButton>
          </Toolbar>
        </AppBar>
      )}

      {/* Mobile Navigation Drawer */}
      <Drawer
        anchor="left"
        open={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
        sx={{
          '& .MuiDrawer-paper': {
            width: 280,
            backgroundColor: '#0e1621',
            color: 'white',
            borderRight: '1px solid #1e2c3c'
          }
        }}
      >
        <Box sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
            <FontAwesomeIcon icon={faGamepad} style={{ marginRight: '10px' }} />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>GamEaten</Typography>
          </Box>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box 
              onClick={() => { navigate('/home'); setMobileDrawerOpen(false); }}
              sx={{ 
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                '&:hover': { backgroundColor: 'rgba(29, 161, 242, 0.1)' }
              }}
            >
              <FontAwesomeIcon icon={faHome} style={{ marginRight: '15px' }} />
              Home
            </Box>
            <Box 
              onClick={() => { navigate('/giveaways'); setMobileDrawerOpen(false); }}
              sx={{ 
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                '&:hover': { backgroundColor: 'rgba(29, 161, 242, 0.1)' }
              }}
            >
              <FontAwesomeIcon icon={faGift} style={{ marginRight: '15px' }} />
              Game Giveaways
            </Box>
            <Box 
              onClick={() => { navigate('/most-reviewed'); setMobileDrawerOpen(false); }}
              sx={{ 
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                '&:hover': { backgroundColor: 'rgba(29, 161, 242, 0.1)' }
              }}
            >
              <FontAwesomeIcon icon={faTrophy} style={{ marginRight: '15px' }} />
              Most Reviewed
            </Box>
          </Box>
          
          <Button 
            variant="contained" 
            fullWidth 
            onClick={() => {
              handleOpenReviewDialog();
              setMobileDrawerOpen(false);
            }}
            sx={{
              mt: 3,
              py: 1.5,
              borderRadius: '30px',
              backgroundColor: '#1da1f2',
              fontWeight: 'bold',
              textTransform: 'none',
              fontSize: '16px',
              '&:hover': {
                backgroundColor: '#1a91da'
              }
            }}
          >
            <FontAwesomeIcon icon={faPencilAlt} style={{ marginRight: '10px' }} />
            Review Game
          </Button>
        </Box>
      </Drawer>

      {/* User Menu for Mobile */}
      <Menu
        anchorEl={userMenuAnchor}
        open={Boolean(userMenuAnchor)}
        onClose={() => setUserMenuAnchor(null)}
        sx={{
          '& .MuiPaper-root': {
            backgroundColor: '#172331',
            color: 'white',
            border: '1px solid #1e2c3c'
          }
        }}
      >
        <MenuItem onClick={() => { navigate('/profile'); setUserMenuAnchor(null); }}>
          <FontAwesomeIcon icon={faUser} style={{ marginRight: '10px' }} />
          Profile
        </MenuItem>
        <MenuItem onClick={() => { logout(); navigate('/'); }}>
          <FontAwesomeIcon icon={faSignOutAlt} style={{ marginRight: '10px' }} />
          Logout
        </MenuItem>
      </Menu>

      {/* Left Column - Navigation (Desktop/Tablet only) */}
      {!isMobile && (
        <Box 
          sx={{ 
            width: isTablet ? '200px' : '220px', 
            borderRight: '1px solid #1e2c3c', 
            padding: isTablet ? '15px' : '20px',
            height: '100vh',
            position: 'sticky',
            top: 0,
            overflowY: 'auto'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
            <FontAwesomeIcon icon={faGamepad} style={{ marginRight: '10px' }} />
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: isTablet ? '1.1rem' : '1.25rem' }}>
              GamEaten
            </Typography>
          </Box>
          
          <Box 
            sx={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: 1,
              '& .nav-item': {
                padding: '12px 15px',
                borderRadius: '30px',
                display: 'flex',
                alignItems: 'center',
                fontWeight: 500,
                transition: 'all 0.2s',
                '&:hover': {
                  backgroundColor: 'rgba(29, 161, 242, 0.1)'
                },
                '&.active': {
                  backgroundColor: '#1da1f2',
                  color: '#fff'
                },
                '& .icon': {
                  width: '20px',
                  marginRight: '15px',
                  textAlign: 'center'
                }
              }
            }}
          >
            <Box 
              className="nav-item"
              onClick={() => navigate('/home')}
              sx={{ cursor: 'pointer' }}
            >
              <span className="icon">
                <FontAwesomeIcon icon={faHome} />
              </span>
              Home
            </Box>
            
            <Box 
              className="nav-item"
              onClick={() => navigate('/giveaways')}
              sx={{ cursor: 'pointer' }}
            >
              <span className="icon">
                <FontAwesomeIcon icon={faGift} />
              </span>
              Game Giveaways
            </Box>
            
            <Box 
              className="nav-item"
              onClick={() => navigate('/most-reviewed')}
              sx={{ cursor: 'pointer' }}
            >
              <span className="icon">
                <FontAwesomeIcon icon={faTrophy} />
              </span>
              Most Reviewed
            </Box>
          </Box>
          
          {/* Review Button - Similar to Twitter's Tweet button */}
          <Button 
            variant="contained" 
            fullWidth 
            onClick={handleOpenReviewDialog}
            sx={{
              mt: 3,
              mb: 3,
              py: 1.5,
              borderRadius: '30px',
              backgroundColor: '#1da1f2',
              fontWeight: 'bold',
              textTransform: 'none',
              fontSize: '16px',
              '&:hover': {
                backgroundColor: '#1a91da'
              }
            }}
          >
            <FontAwesomeIcon icon={faPencilAlt} style={{ marginRight: '10px' }} />
            Review Game
          </Button>
        </Box>
      )}

      {/* Middle Column - Game Content */}
      <Box 
        sx={{ 
          width: isMobile ? '100%' : isTablet ? '500px' : '600px',
          borderRight: !isMobile && !isTablet ? '1px solid #1e2c3c' : 'none',
          minHeight: isMobile ? 'auto' : '100vh',
          overflowY: isMobile ? 'visible' : 'auto'
        }}
      >
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : gameDetails ? (
          <>
            {/* Header/Banner */}
            <Box sx={{ position: 'relative' }}>
              {/* Banner Image */}
              <Box sx={{ 
                width: '100%', 
                height: isMobile ? '150px' : '200px', 
                position: 'relative', 
                overflow: 'hidden',
                backgroundColor: '#172331' 
              }}>
                {gameDetails.artworks && gameDetails.artworks.length > 0 ? (
                  <img 
                    src={formatArtworkUrl(gameDetails.artworks[0].url)}
                    alt={gameDetails.name}
                    style={{ 
                      width: '100%', 
                      height: '100%', 
                      objectFit: 'cover',
                      filter: 'brightness(0.7)'
                    }}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : null}
              </Box>

              {/* Game Avatar */}
              <Box 
                sx={{ 
                  position: 'absolute', 
                  bottom: isMobile ? '-40px' : '-50px', 
                  left: isMobile ? '16px' : '20px',
                  border: '4px solid #0e1621',
                  borderRadius: isMobile ? '12px' : '16px',
                  overflow: 'hidden',
                  width: isMobile ? '80px' : '120px',
                  height: isMobile ? '80px' : '120px',
                  backgroundColor: '#172331'
                }}
              >
                {gameDetails.cover ? (
                  <img 
                    src={formatCoverUrl(gameDetails.cover.url)}
                    alt={gameDetails.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <FontAwesomeIcon 
                    icon={faGamepad} 
                    style={{ 
                      width: '100%', 
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '30px'
                    }} 
                  />
                )}
              </Box>

              {/* Action buttons */}
              <Box
                sx={{ 
                  position: 'absolute', 
                  bottom: isMobile ? '-30px' : '-40px', 
                  right: isMobile ? '16px' : '20px',
                  display: 'flex',
                  gap: isMobile ? 1 : 2
                }}
              >
                <Button 
                  variant="contained" 
                  color={isGameSaved ? "secondary" : "primary"}
                  startIcon={savingGame ? <CircularProgress size={16} color="inherit" /> : <FontAwesomeIcon icon={faBookmark} />}
                  onClick={handleSaveGame}
                  disabled={savingGame || !isAuthenticated()}
                  sx={{ 
                    borderRadius: '30px', 
                    textTransform: 'none',
                    fontSize: isMobile ? '12px' : '14px',
                    px: isMobile ? 2 : 3,
                    backgroundColor: isGameSaved ? '#e0245e' : '#1da1f2',
                    '&:hover': {
                      backgroundColor: isGameSaved ? '#c01e4f' : '#1a91da'
                    }
                  }}
                >
                  {isMobile ? (isGameSaved ? 'Saved' : 'Save') : (isGameSaved ? 'Remove from Saved' : 'Save Game')}
                </Button>
              </Box>
            </Box>

            {/* Game Info */}
            <Box sx={{ 
              pt: isMobile ? 5 : 7, 
              px: isMobile ? 2 : 3, 
              pb: 2 
            }}>
              <Typography 
                variant={isMobile ? 'h6' : 'h5'} 
                sx={{ 
                  fontWeight: 700,
                  fontSize: isMobile ? '1.25rem' : '1.5rem'
                }}
              >
                {gameDetails.name}
              </Typography>

              {gameDetails.rating && (
                <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                  <FontAwesomeIcon icon={faStar} style={{ color: '#FFD700', marginRight: '8px' }} />
                  <Typography 
                    variant="subtitle1"
                    sx={{ fontSize: isMobile ? '14px' : '16px' }}
                  >
                    {Math.round(gameDetails.rating * 10) / 10}
                  </Typography>
                </Box>
              )}

              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2 }}>
                {gameDetails.platforms?.map((platform) => (
                  <Chip 
                    key={platform.id}
                    label={platform.name} 
                    size="small"
                    sx={{ 
                      backgroundColor: '#172331', 
                      color: 'white',
                      '& .MuiChip-label': { px: 1 }
                    }} 
                    icon={<FontAwesomeIcon icon={faDesktop} style={{ fontSize: '0.8rem', color: '#8899a6' }} />}
                  />
                ))}
              </Box>

              {gameDetails.release_dates && gameDetails.release_dates.length > 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center', mt: 2, color: '#8899a6' }}>
                  <FontAwesomeIcon icon={faCalendarAlt} style={{ marginRight: '8px' }} />
                  <Typography variant="body2">
                    Released: {gameDetails.release_dates[0].human}
                  </Typography>
                </Box>
              )}

              <Typography variant="body1" sx={{ mt: 2, lineHeight: 1.6 }}>
                {gameDetails.summary}
              </Typography>
            </Box>

            {/* Tabs */}
            <Box sx={{ borderBottom: 1, borderColor: '#1e2c3c' }}>
              <Tabs 
                value={activeTab} 
                onChange={handleTabChange}
                variant="fullWidth"
                sx={{ 
                  '& .MuiTab-root': { 
                    color: '#8899a6',
                    textTransform: 'none',
                    fontWeight: 600
                  },
                  '& .Mui-selected': { color: '#1da1f2' },
                  '& .MuiTabs-indicator': { backgroundColor: '#1da1f2' }
                }}
              >
                <Tab label="Comments" />
                <Tab label="Media" />
                <Tab label="Similar Games" />
              </Tabs>
            </Box>

            {/* Comments Section */}
            {activeTab === 0 && (
              <Box sx={{ p: 2 }}>
                {/* Comment Input */}
                {isAuthenticated() && (
                  <Box sx={{ mb: 3, display: 'flex', gap: 2 }}>
                    <Avatar sx={{ width: 48, height: 48 }}>
                      {username?.charAt(0).toUpperCase()}
                    </Avatar>
                    <Box sx={{ flexGrow: 1 }}>
                      <TextField
                        fullWidth
                        multiline
                        rows={2}
                        placeholder="What do you think about this game?"
                        variant="outlined"
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        sx={{
                          backgroundColor: '#172331',
                          borderRadius: '8px',
                          '& .MuiOutlinedInput-root': {
                            '& fieldset': { borderColor: '#1e2c3c' },
                            '&:hover fieldset': { borderColor: '#253341' },
                            '&.Mui-focused fieldset': { borderColor: '#1da1f2' }
                          }
                        }}
                      />
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                        <Button
                          variant="contained"
                          color="primary"
                          disabled={!commentText.trim()}
                          onClick={handleSubmitComment}
                          sx={{ borderRadius: '30px', textTransform: 'none' }}
                        >
                          Comment
                        </Button>
                      </Box>
                    </Box>
                  </Box>
                )}

                {/* Comments List */}
                {commentLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                    <CircularProgress sx={{ color: '#1da1f2' }} />
                  </Box>
                ) : comments.length > 0 ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {comments.map((comment) => {
                      // Determine review type based on content
                      let reviewType: 'text' | 'gif' | 'mixed' = 'text';
                      if (comment.has_text && comment.has_gif) {
                        reviewType = 'mixed';
                      } else if (comment.has_gif) {
                        reviewType = 'gif';
                      }

                      return (
                        <PostCard 
                          key={comment.id}
                          id={comment.id}
                          username={comment.username}
                          text={comment.review_text}
                          date={comment.date_created}
                          gameId={comment.id_game}
                          gameName={gameDetails?.name || 'Loading...'}
                          gifUrl={comment.gif_url}
                          commentType={reviewType}
                          commentCount={comment.comment_count || 0}
                          likesCount={comment.likes_count || 0}
                          userHasLiked={comment.user_has_liked || false}
                          repostsCount={comment.reposts_count || 0}
                          userHasReposted={comment.user_has_reposted || false}
                          profilePhoto={comment.profile_photo}
                          userId={comment.user_id}
                          onPostDeleted={fetchComments}
                        />
                      );
                    })}
                  </Box>
                ) : (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography variant="body1" sx={{ color: '#8899a6' }}>
                      No comments yet. Be the first to comment!
                    </Typography>
                  </Box>
                )}
              </Box>
            )}

            {/* Media Tab */}
            {activeTab === 1 && (
              <Box sx={{ p: 2 }}>
                {gameDetails.artworks && gameDetails.artworks.length > 0 ? (
                  <Box sx={{ 
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 2
                  }}>
                    {gameDetails.artworks?.map((artwork) => (
                      <Box 
                        key={artwork.id}
                        sx={{ 
                          flex: '0 0 calc(50% - 8px)',
                          '@media (max-width: 600px)': {
                            flex: '0 0 100%'
                          }
                        }}
                      >
                        <img 
                          src={formatArtworkUrl(artwork.url)}
                          alt={`${gameDetails.name || 'Game'} artwork`}
                          style={{ 
                            width: '100%', 
                            height: '300px',
                            borderRadius: '8px',
                            objectFit: 'cover',
                            backgroundColor: '#172331'
                          }}
                          onError={(e) => {
                            const target = e.currentTarget as HTMLImageElement;
                            target.src = 'https://via.placeholder.com/400x300?text=Image+Not+Available';
                            target.onerror = null;
                          }}
                        />
                      </Box>
                    ))}
                  </Box>
                ) : (
                  <Box sx={{ textAlign: 'center', py: 4, width: '100%' }}>
                    <Typography variant="body1" sx={{ color: '#8899a6' }}>
                      No media available for this game.
                    </Typography>
                  </Box>
                )}
              </Box>
            )}

            {/* Similar Games Tab */}
            {activeTab === 2 && (
              <Box sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="body1" sx={{ color: '#8899a6', py: 4 }}>
                  Similar games recommendations will appear here.
                </Typography>
              </Box>
            )}
          </>
        ) : (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="h6">
              Game not found
            </Typography>
          </Box>
        )}
      </Box>

      {/* Right Column - User Profile & Search */}
      <Box 
        sx={{ 
          width: '320px', 
          padding: '20px',
          height: '100vh',
          position: 'sticky',
          top: 0,
          overflowY: 'auto'
        }}
      >
        <Box sx={{ position: 'relative' }}>
          <Paper
            sx={{
              p: '2px 4px',
              display: 'flex',
              alignItems: 'center',
              borderRadius: '30px',
              backgroundColor: '#172331',
              mb: 3,
              border: '1px solid #1e2c3c'
            }}
          >
            <IconButton 
              sx={{ p: '10px', color: '#8899a6' }}
              onClick={handleSearch}
              disabled={searchLoading}
            >
              <FontAwesomeIcon icon={searchLoading ? faSpinner : faSearch} spin={searchLoading} />
            </IconButton>
            <InputBase
              sx={{ ml: 1, flex: 1, color: 'white' }}
              placeholder={searchQuery.startsWith('@') ? "Search users..." : "Search games or @users"}
              inputProps={{ 'aria-label': 'search' }}
              value={searchQuery}
              onChange={handleSearchInputChange}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              onBlur={() => setTimeout(() => handleClickOutside(), 200)}
            />
          </Paper>

          {showSuggestions && suggestions.length > 0 && (
            <Paper 
              sx={{ 
                position: 'absolute', 
                width: '100%', 
                zIndex: 20, 
                mt: -2, 
                backgroundColor: '#172331',
                border: '1px solid #1e2c3c',
                borderRadius: '10px',
                maxHeight: '300px',
                overflowY: 'auto'
              }}
            >
              <List>
                {suggestions.map((suggestion) => (
                  <ListItem 
                    key={suggestion.id} 
                    onClick={() => handleSelectSuggestion(suggestion)}
                    sx={{ 
                      '&:hover': { 
                        backgroundColor: 'rgba(29, 161, 242, 0.1)'
                      },
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    <Box sx={{ mr: 2, display: 'flex', alignItems: 'center' }}>
                      {suggestion.type === 'user' ? (
                        suggestion.profile_photo ? (
                          <Avatar 
                            src={suggestion.profile_photo} 
                            sx={{ width: 32, height: 32 }}
                          />
                        ) : (
                          <Avatar sx={{ width: 32, height: 32, backgroundColor: '#1da1f2' }}>
                            <FontAwesomeIcon icon={faUser} size="sm" />
                          </Avatar>
                        )
                      ) : (
                        suggestion.cover_url ? (
                          <Avatar 
                            src={suggestion.cover_url} 
                            sx={{ width: 32, height: 32 }}
                            variant="square"
                          />
                        ) : (
                          <Avatar sx={{ width: 32, height: 32, backgroundColor: '#2e7d32' }}>
                            <FontAwesomeIcon icon={faGamepad} size="sm" />
                          </Avatar>
                        )
                      )}
                    </Box>
                    <ListItemText 
                      primary={
                        <Box>
                          <Typography sx={{ color: 'white', fontWeight: 500 }}>
                            {suggestion.type === 'user' ? `@${suggestion.username}` : suggestion.name}
                          </Typography>
                          <Typography sx={{ color: '#8899a6', fontSize: '12px' }}>
                            {suggestion.type === 'user' ? 'User' : 'Game'}
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </Paper>
          )}
        </Box>

        <Box 
          sx={{ 
            backgroundColor: '#172331', 
            borderRadius: '15px',
            padding: '24px',
            mb: 3,
            border: '1px solid #1e2c3c',
            textAlign: 'center'
          }}
        >
          {/* Centered Profile Photo - Bigger */}
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            <Avatar 
              src={currentUser?.profile_photo || undefined}
              sx={{ 
                width: 120, 
                height: 120,
                fontSize: '48px',
                backgroundColor: '#1da1f2'
              }}
            >
              {username?.charAt(0).toUpperCase()}
            </Avatar>
          </Box>
          
          {/* Centered Username with @ */}
          <Typography 
            variant="body1" 
            sx={{ 
              color: '#8899a6',
              fontSize: '16px',
              fontWeight: 500,
              mb: 3
            }}
          >
            @{username?.toLowerCase()}
          </Typography>
          
          {/* Three Big Buttons */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<FontAwesomeIcon icon={faUser} />}
              onClick={() => navigate('/profile')}
              sx={{
                borderRadius: '25px',
                padding: '12px 20px',
                fontSize: '16px',
                fontWeight: 600,
                textTransform: 'none',
                borderColor: '#1e2c3c',
                color: 'white',
                backgroundColor: 'transparent',
                transition: 'all 0.2s ease',
                '&:hover': {
                  borderColor: '#1da1f2',
                  backgroundColor: 'rgba(29, 161, 242, 0.1)',
                  color: '#1da1f2'
                }
              }}
            >
              Profile
            </Button>
            
            <Button
              fullWidth
              variant="outlined"
              startIcon={<FontAwesomeIcon icon={faBookmark} />}
              onClick={handleNavigateToSavedGames}
              sx={{
                borderRadius: '25px',
                padding: '12px 20px',
                fontSize: '16px',
                fontWeight: 600,
                textTransform: 'none',
                borderColor: '#1e2c3c',
                color: 'white',
                backgroundColor: 'transparent',
                transition: 'all 0.2s ease',
                '&:hover': {
                  borderColor: '#1da1f2',
                  backgroundColor: 'rgba(29, 161, 242, 0.1)',
                  color: '#1da1f2'
                }
              }}
            >
              Saved Games
            </Button>
            
            <Button
              fullWidth
              variant="outlined"
              startIcon={<FontAwesomeIcon icon={faSignOutAlt} />}
              onClick={handleLogout}
              sx={{
                borderRadius: '25px',
                padding: '12px 20px',
                fontSize: '16px',
                fontWeight: 600,
                textTransform: 'none',
                borderColor: '#1e2c3c',
                color: 'white',
                backgroundColor: 'transparent',
                transition: 'all 0.2s ease',
                '&:hover': {
                  borderColor: '#e0245e',
                  backgroundColor: 'rgba(224, 36, 94, 0.1)',
                  color: '#e0245e'
                }
              }}
            >
              Log Out
            </Button>
          </Box>
        </Box>

        {/* Game Stats */}
        <Box 
          sx={{ 
            backgroundColor: '#172331', 
            borderRadius: '15px',
            padding: '20px',
            mb: 3,
            border: '1px solid #1e2c3c'
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
            Game Stats
          </Typography>
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" sx={{ color: '#8899a6' }}>
              Comments
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
              {comments.length}
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" sx={{ color: '#8899a6' }}>
              Rating
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
              {gameDetails?.rating ? `${Math.round(gameDetails.rating)}/100` : 'N/A'}
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" sx={{ color: '#8899a6' }}>
              Release Date
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
              {gameDetails?.release_dates && gameDetails.release_dates.length > 0
                ? gameDetails.release_dates[0].human
                : 'N/A'}
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" sx={{ color: '#8899a6' }}>
              Platforms
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 'bold', textAlign: 'right' }}>
              {gameDetails?.platforms ? gameDetails.platforms.length : 0}
            </Typography>
          </Box>
        </Box>

        {/* Related Actions */}
        <Box 
          sx={{ 
            backgroundColor: '#172331', 
            borderRadius: '15px',
            padding: '20px',
            border: '1px solid #1e2c3c'
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
            Related Actions
          </Typography>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Button 
              variant="outlined"
              fullWidth
              onClick={() => navigate('/home')}
              sx={{
                borderColor: '#1e2c3c',
                color: 'white',
                borderRadius: '10px',
                textTransform: 'none',
                '&:hover': {
                  borderColor: '#1da1f2',
                  backgroundColor: 'rgba(29, 161, 242, 0.1)'
                }
              }}
            >
              <FontAwesomeIcon icon={faHome} style={{ marginRight: '10px' }} />
              Back to Home
            </Button>
            
            <Button 
              variant="outlined"
              fullWidth
              onClick={() => navigate('/giveaways')}
              sx={{
                borderColor: '#1e2c3c',
                color: 'white',
                borderRadius: '10px',
                textTransform: 'none',
                '&:hover': {
                  borderColor: '#1da1f2',
                  backgroundColor: 'rgba(29, 161, 242, 0.1)'
                }
              }}
            >
              <FontAwesomeIcon icon={faGift} style={{ marginRight: '10px' }} />
              Game Giveaways
            </Button>
          </Box>
        </Box>
      </Box>      {/* Review Dialog */}
      <ReviewDialog 
        open={openReviewDialog} 
        onClose={() => setOpenReviewDialog(false)}
        onReviewSubmitted={async () => {
          setOpenReviewDialog(false);
            // Refresh comments after review
          if (gameDetails?.id) {
            const response = await getReviews({
              id_game: gameDetails.id,
              busca: 'game',
              page: 1,
              size: 20
            });
            
            if (response && response.comments) {
              setComments(response.comments);
            }
          }
        }}
      />

      {/* Floating Action Button for Mobile */}
      {isMobile && (
        <Fab
          color="primary"
          onClick={handleOpenReviewDialog}
          sx={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            backgroundColor: '#1da1f2',
            '&:hover': {
              backgroundColor: '#1a91da'
            },
            zIndex: 1000
          }}
        >
          <FontAwesomeIcon icon={faPencilAlt} />
        </Fab>
      )}
    </Box>
  );
};

export default Game;