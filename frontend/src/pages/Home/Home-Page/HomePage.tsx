import React, { useState, useEffect, useRef } from 'react';
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
  Button,
  Drawer,
  useMediaQuery,
  useTheme,
  AppBar,
  Toolbar,
  Menu,
  MenuItem,
  Fab,
} from '@mui/material';
import GameFeed from '../../../contexts/components/GameFeed/GameFeed.tsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faHome, 
  faGift, 
  faSearch,
  faSignOutAlt,
  faGamepad,
  faUser,
  faSpinner,
  faPencilAlt,
  faBars,
  faEllipsisV,
  faBookmark,
  faTrophy
} from '@fortawesome/free-solid-svg-icons';
import { getCurrentUser, isAuthenticated, logout } from '../../../api/auth.ts';
import { searchGame, searchGameSuggestions, searchUsers } from '../../../api/funcs.ts';
import ReviewDialog from '../../../contexts/components/Review/review.tsx';

export const HomePage = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = useMediaQuery(theme.breakpoints.down('lg'));
  
  const [activeTab, setActiveTab] = useState('following');
  const [username, setUsername] = useState('Guest');
  const [currentUser, setCurrentUser] = useState<{ username: string, id: number, profile_photo?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [, setSearchResults] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<Array<{id: number, name?: string, username?: string, type: 'game' | 'user', profile_photo?: string, cover_url?: string}>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchTimeoutRef = useRef<number | null>(null);
  const [openReviewDialog, setOpenReviewDialog] = useState(false);
  const [refreshFeed, setRefreshFeed] = useState(false);
  
  // Mobile-specific state
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);

  const navigate = useNavigate();

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
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (isMobile) {
      setMobileDrawerOpen(false);
    }
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
          console.log(`Found game with ID: ${gameId}`);
          setSearchResults(gameId);
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
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    if (query.trim().length >= 2) {
      setSearchLoading(true);
      
      searchTimeoutRef.current = window.setTimeout(async () => {
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
      }, 500);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
      setSearchLoading(false);
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

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const handleOpenReviewDialog = () => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    setOpenReviewDialog(true);
  };

  const handleCloseReviewDialog = () => {
    setOpenReviewDialog(false);
  };

  const handleUserMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setUserMenuAnchor(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setUserMenuAnchor(null);
  };

  // Handle navigation to profile with saved games tab
  const handleNavigateToSavedGames = () => {
    navigate('/profile?tab=saved-games');
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
        className={`nav-item ${activeTab === 'following' ? 'active' : ''}`}
        onClick={() => handleTabChange('following')}
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
        className="nav-item"
        onClick={() => {
          navigate('/most-reviewed');
          if (inDrawer) setMobileDrawerOpen(false);
        }}
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
          <FontAwesomeIcon icon={faGamepad} style={{ marginRight: '8px' }} />
          <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.1rem' }}>
            GamEaten
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
        <MenuItem onClick={() => { navigate('/profile'); handleUserMenuClose(); }}>
          <FontAwesomeIcon icon={faUser} style={{ marginRight: '10px' }} />
          Profile
        </MenuItem>
        <MenuItem onClick={() => { handleLogout(); handleUserMenuClose(); }}>
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
              zIndex: 10
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: isTablet ? '1.1rem' : '1.25rem' }}>
              {activeTab === 'following' ? 'Following' : 'Home'}
            </Typography>
          </Box>
        )}
        
        {/* Search bar for mobile */}
        {isMobile && (
          <Box sx={{ p: 2, position: 'relative' }}>
            <Paper
              sx={{
                p: '2px 4px',
                display: 'flex',
                alignItems: 'center',
                borderRadius: '30px',
                backgroundColor: '#172331',
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
                  width: 'calc(100% - 32px)',
                  left: 16,
                  right: 16,
                  zIndex: 20, 
                  mt: 1, 
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
        )}        
        
        <Box sx={{ p: isMobile ? 1 : 2 }}>
          <GameFeed key={`feed-${refreshFeed}`}/>
        </Box>
      </Box>

      {/* Right Column - User Profile & Recommendations (Desktop only) */}
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
                {loading ? '?' : username?.charAt(0).toUpperCase()}
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
              @{loading ? '...' : username?.toLowerCase()}
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
          setRefreshFeed(prev => !prev);
        }}
      />
    </Box>
  );
};

export default HomePage;