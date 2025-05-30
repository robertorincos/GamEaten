import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Card,
  CardMedia,
  Button,
  useMediaQuery,
  useTheme,
  Drawer,
  AppBar,
  Toolbar,
  Menu,
  MenuItem as MenuItemComponent,
  Fab,
  Alert,
  Skeleton,
  Chip
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
  faPencilAlt,
  faBars,
  faEllipsisV,
  faBookmark,
  faTrophy,
  faRefresh
} from '@fortawesome/free-solid-svg-icons';
import { getCurrentUser, isAuthenticated, logout } from '../../api/auth';
import { searchGame, searchGameSuggestions, getMostReviewedGamesWeek } from '../../api/funcs';
import ReviewDialog from '../../contexts/components/Review/review';
import PostCard from '../../contexts/components/PostCard/PostCard';

const MostReviewedGames = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = useMediaQuery(theme.breakpoints.down('lg'));
  
  const [username, setUsername] = useState('Guest');
  const [currentUser, setCurrentUser] = useState<{ username: string, id: number, profile_photo?: string } | null>(null);
  const [mostReviewedGames, setMostReviewedGames] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{id: number, name: string}>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  // Mobile-specific state
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);

  // Review dialog state
  const [openReviewDialog, setOpenReviewDialog] = useState(false);

  // Fetch user data and most reviewed games
  useEffect(() => {
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

    const fetchMostReviewedGames = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await getMostReviewedGamesWeek();
        setMostReviewedGames(response.games);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to fetch most reviewed games');
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
    fetchMostReviewedGames();
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // Handle navigation to profile with saved games tab
  const handleNavigateToSavedGames = () => {
    navigate('/profile?tab=saved-games');
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    try {
      setSearchLoading(true);
      const gameId = await searchGame({ query: searchQuery });
      
      if (gameId) {
        navigate(`/game/${gameId}`);
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
        const results = await searchGameSuggestions({ query });
        setSuggestions(results);
        setShowSuggestions(true);
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

  const handleSelectSuggestion = (gameId: number) => {
    setShowSuggestions(false);
    navigate(`/game/${gameId}`);
  };

  const handleClickOutside = () => {
    setShowSuggestions(false);
  };

  const handleRefresh = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getMostReviewedGamesWeek();
      setMostReviewedGames(response.games);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch most reviewed games');
    } finally {
      setLoading(false);
    }
  };

  const handleUserMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setUserMenuAnchor(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setUserMenuAnchor(null);
  };

  const handleOpenReviewDialog = () => {
    if (!isAuthenticated()) {
      navigate('/');
      return;
    }
    setOpenReviewDialog(true);
  };

  const handleCloseReviewDialog = () => {
    setOpenReviewDialog(false);
  };

  // Navigation items component for reuse
  const NavigationItems = ({ inDrawer = false }) => (
    <Box 
      sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: 1,
        width: inDrawer ? '100%' : 'auto',
        '& .nav-item': {
          padding: inDrawer ? '16px 20px' : '12px 15px',
          borderRadius: inDrawer ? '0' : '30px',
          display: 'flex',
          alignItems: 'center',
          fontWeight: 500,
          transition: 'all 0.2s',
          cursor: 'pointer',
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
        onClick={() => {
          navigate('/home');
          if (inDrawer) setMobileDrawerOpen(false);
        }}
      >
        <span className="icon">
          <FontAwesomeIcon icon={faHome} />
        </span>
        Home
      </Box>
      
      <Box 
        className="nav-item"
        onClick={() => {
          navigate('/giveaways');
          if (inDrawer) setMobileDrawerOpen(false);
        }}
      >
        <span className="icon">
          <FontAwesomeIcon icon={faGift} />
        </span>
        Game Giveaways
      </Box>

      <Box 
        className="nav-item active"
      >
        <span className="icon">
          <FontAwesomeIcon icon={faTrophy} />
        </span>
        Most Reviewed
      </Box>
    </Box>
  );

  // Mobile header component
  const MobileHeader = () => (
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
          <FontAwesomeIcon icon={faTrophy} style={{ marginRight: '8px' }} />
          <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.1rem' }}>
            Most Reviewed
          </Typography>
        </Box>
        
        <IconButton 
          color="inherit" 
          onClick={handleUserMenuOpen}
          sx={{ p: 1 }}
        >
          <FontAwesomeIcon icon={faEllipsisV} />
        </IconButton>
      </Toolbar>
    </AppBar>
  );

  const formatCoverUrl = (url?: string) => {
    if (!url) return null;
    return url.startsWith('//') ? `https:${url}` : url;
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
      {isMobile && <MobileHeader />}

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
          
          <NavigationItems inDrawer={true} />
          
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
        onClose={handleUserMenuClose}
        sx={{
          '& .MuiPaper-root': {
            backgroundColor: '#172331',
            color: 'white',
            border: '1px solid #1e2c3c'
          }
        }}
      >
        <MenuItemComponent onClick={() => { navigate('/profile'); handleUserMenuClose(); }}>
          <FontAwesomeIcon icon={faUser} style={{ marginRight: '10px' }} />
          Profile
        </MenuItemComponent>
        <MenuItemComponent onClick={() => { handleLogout(); handleUserMenuClose(); }}>
          <FontAwesomeIcon icon={faSignOutAlt} style={{ marginRight: '10px' }} />
          Logout
        </MenuItemComponent>
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
          
          <NavigationItems />
          
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
              fontSize: isTablet ? '14px' : '16px',
              '&:hover': {
                backgroundColor: '#1a91da'
              }
            }}
          >
            <FontAwesomeIcon icon={faPencilAlt} style={{ marginRight: '10px' }} />
            {isTablet ? 'Review' : 'Review Game'}
          </Button>
        </Box>
      )}

      {/* Middle Column - Main Content */}
      <Box 
        sx={{ 
          width: isMobile ? '100%' : isTablet ? '500px' : '600px',
          borderRight: !isMobile && !isTablet ? '1px solid #1e2c3c' : 'none',
          height: isMobile ? 'auto' : '100vh',
          overflowY: isMobile ? 'visible' : 'auto'
        }}
      >
        {/* Header for non-mobile */}
        {!isMobile && (
          <Box 
            sx={{ 
              padding: '15px 20px', 
              borderBottom: '1px solid #1e2c3c',
              position: 'sticky',
              top: 0,
              backgroundColor: '#0e1621',
              zIndex: 10,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <FontAwesomeIcon icon={faTrophy} style={{ marginRight: '10px', color: '#1da1f2' }} />
              <Typography variant="h6" sx={{ fontWeight: 700, fontSize: isTablet ? '1.1rem' : '1.25rem' }}>
                Most Reviewed This Week
              </Typography>
            </Box>
            <IconButton 
              onClick={handleRefresh}
              sx={{ 
                color: '#1da1f2',
                '&:hover': { backgroundColor: 'rgba(29, 161, 242, 0.1)' }
              }}
            >
              <FontAwesomeIcon icon={faRefresh} />
            </IconButton>
          </Box>
        )}

        {/* Main Content */}
        <Box sx={{ p: isMobile ? 1 : 2 }}>
          {loading ? (
            <Box>
              {[...Array(5)].map((_, index) => (
                <Card 
                  key={index}
                  sx={{ 
                    mb: 2, 
                    backgroundColor: '#172331', 
                    border: '1px solid #1e2c3c',
                    borderRadius: '15px'
                  }}
                >
                  <Box sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <Skeleton variant="rectangular" width={80} height={100} sx={{ bgcolor: '#1e2c3c', borderRadius: '8px' }} />
                      <Box sx={{ flex: 1 }}>
                        <Skeleton variant="text" width="60%" sx={{ bgcolor: '#1e2c3c', mb: 1 }} />
                        <Skeleton variant="text" width="40%" sx={{ bgcolor: '#1e2c3c', mb: 2 }} />
                        <Skeleton variant="rectangular" height={60} sx={{ bgcolor: '#1e2c3c', borderRadius: '8px' }} />
                      </Box>
                    </Box>
                  </Box>
                </Card>
              ))}
            </Box>
          ) : error ? (
            <Alert 
              severity="error" 
              sx={{ 
                backgroundColor: '#2c1810', 
                color: '#ff6b6b',
                border: '1px solid #3c2415',
                '& .MuiAlert-icon': { color: '#ff6b6b' }
              }}
            >
              {error}
            </Alert>
          ) : mostReviewedGames.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <FontAwesomeIcon icon={faTrophy} size="3x" style={{ color: '#8899a6', marginBottom: '16px' }} />
              <Typography variant="h6" sx={{ color: '#8899a6', mb: 1 }}>
                No games reviewed this week yet
              </Typography>
              <Typography variant="body2" sx={{ color: '#8899a6' }}>
                Be the first to review a game this week!
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {mostReviewedGames.map((gameData, index) => (
                <Card 
                  key={gameData.game.id}
                  sx={{ 
                    backgroundColor: '#172331', 
                    border: '1px solid #1e2c3c',
                    borderRadius: '15px',
                    overflow: 'hidden',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: '0 4px 20px rgba(29, 161, 242, 0.1)',
                      borderColor: '#1da1f2'
                    }
                  }}
                >
                  <Box sx={{ p: 3 }}>
                    {/* Ranking Badge */}
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <Chip
                        label={`#${index + 1}`}
                        sx={{
                          backgroundColor: index === 0 ? '#ffd700' : index === 1 ? '#c0c0c0' : index === 2 ? '#cd7f32' : '#1da1f2',
                          color: index < 3 ? '#000' : '#fff',
                          fontWeight: 'bold',
                          fontSize: '14px'
                        }}
                      />
                      <Typography variant="body2" sx={{ color: '#8899a6', ml: 1 }}>
                        {gameData.review_count} review{gameData.review_count !== 1 ? 's' : ''} this week
                      </Typography>
                    </Box>

                    {/* Game Info */}
                    <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                      {gameData.game.cover_url && (
                        <Box 
                          sx={{ 
                            cursor: 'pointer',
                            transition: 'transform 0.2s ease',
                            '&:hover': { transform: 'scale(1.05)' }
                          }}
                          onClick={() => navigate(`/game/${gameData.game.id}`)}
                        >
                          <CardMedia
                            component="img"
                            image={formatCoverUrl(gameData.game.cover_url) ?? undefined}
                            alt={gameData.game.name}
                            sx={{
                              width: 80,
                              height: 100,
                              borderRadius: '8px',
                              objectFit: 'cover'
                            }}
                          />
                        </Box>
                      )}
                      
                      <Box sx={{ flex: 1 }}>
                        <Typography 
                          variant="h6" 
                          sx={{ 
                            color: 'white', 
                            fontWeight: 700,
                            cursor: 'pointer',
                            '&:hover': { color: '#1da1f2' },
                            transition: 'color 0.2s ease'
                          }}
                          onClick={() => navigate(`/game/${gameData.game.id}`)}
                        >
                          {gameData.game.name}
                        </Typography>
                        
                        {gameData.game.rating && (
                          <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                            <FontAwesomeIcon icon={faStar} style={{ color: '#ffd700', marginRight: '4px' }} />
                            <Typography variant="body2" sx={{ color: '#8899a6' }}>
                              {Math.round(gameData.game.rating)}/100
                            </Typography>
                          </Box>
                        )}
                        
                        {gameData.game.summary && (
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              color: '#8899a6', 
                              mt: 1,
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden'
                            }}
                          >
                            {gameData.game.summary}
                          </Typography>
                        )}
                      </Box>
                    </Box>

                    {/* Latest Review */}
                    {gameData.latest_review && (
                      <Box sx={{ 
                        backgroundColor: '#0e1621', 
                        borderRadius: '10px', 
                        p: 2,
                        border: '1px solid #1e2c3c'
                      }}>
                        <Typography variant="subtitle2" sx={{ color: '#1da1f2', mb: 1, fontWeight: 600 }}>
                          Latest Review:
                        </Typography>
                        
                        <PostCard
                          id={gameData.latest_review.id}
                          username={gameData.latest_review.username}
                          text={gameData.latest_review.review_text}
                          date={gameData.latest_review.date_created}
                          gameId={gameData.game.id}
                          gameName={gameData.game.name}
                          gifUrl={gameData.latest_review.gif_url}
                          commentType={
                            gameData.latest_review.has_text && gameData.latest_review.has_gif 
                              ? 'mixed' 
                              : gameData.latest_review.has_gif 
                                ? 'gif' 
                                : 'text'
                          }
                          commentCount={gameData.latest_review.comment_count}
                          likesCount={gameData.latest_review.likes_count}
                          userHasLiked={gameData.latest_review.user_has_liked}
                          repostsCount={gameData.latest_review.reposts_count}
                          userHasReposted={gameData.latest_review.user_has_reposted}
                          profilePhoto={gameData.latest_review.profile_photo}
                        />
                      </Box>
                    )}
                  </Box>
                </Card>
              ))}
            </Box>
          )}
        </Box>
      </Box>

      {/* Right Column - Search & User Profile (Desktop only) */}
      {!isMobile && !isTablet && (
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
                placeholder="Search GamEaten"
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
                  {suggestions.map((game) => (
                    <ListItem 
                      key={game.id} 
                      onClick={() => handleSelectSuggestion(game.id)}
                      sx={{ 
                        '&:hover': { 
                          backgroundColor: 'rgba(29, 161, 242, 0.1)'
                        },
                        cursor: 'pointer'
                      }}
                    >
                      <ListItemText 
                        primary={game.name} 
                        primaryTypographyProps={{ 
                          sx: { color: 'white' }
                        }} 
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
        </Box>
      )}

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

      {/* Review Dialog */}
      <ReviewDialog 
        open={openReviewDialog} 
        onClose={handleCloseReviewDialog}
        onReviewSubmitted={() => {
          // Optionally refresh the data when a new review is submitted
        }}
      />
    </Box>
  );
};

export default MostReviewedGames; 