import React, { useState, useEffect, useRef } from 'react';
import { 
  Box, 
  Typography, 
  Avatar, 
  IconButton, 
  Paper, 
  Badge, 
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
  faGlobe, 
  faNewspaper, 
  faBell, 
  faEnvelope, 
  faCog, 
  faSearch,
  faSignOutAlt,
  faGamepad,
  faUser,
  faSpinner,
  faPencilAlt,
  faBars,
  faEllipsisV,
} from '@fortawesome/free-solid-svg-icons';
import { getCurrentUser, isAuthenticated, logout } from '../../../api/auth.ts';
import { searchGame, searchGameSuggestions } from '../../../api/funcs.ts';
import ReviewDialog from '../../../contexts/components/Review/review.tsx';

export const HomePage = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = useMediaQuery(theme.breakpoints.down('lg'));
  
  const [activeTab, setActiveTab] = useState('following');
  const [username, setUsername] = useState('Guest');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [, setSearchResults] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<Array<{id: number, name: string}>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchTimeoutRef = useRef<number | null>(null);
  const [openReviewDialog, setOpenReviewDialog] = useState(false);
  const [refreshFeed, setRefreshFeed] = useState(false);
  
  // Mobile-specific state
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);

  useEffect(() => {
    const fetchUser = async () => {
      if (isAuthenticated()) {
        try {
          const userData = await getCurrentUser();
          if (userData && userData.status) {
            setUsername(userData.status);
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
    window.location.href = '/';
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    try {
      setSearchLoading(true);
      const gameId = await searchGame({ query: searchQuery });
      
      if (gameId) {
        console.log(`Found game with ID: ${gameId}`);
        setSearchResults(gameId);
        window.location.href = `/game/${gameId}`;
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
          const results = await searchGameSuggestions({ query });
          setSuggestions(results);
          setShowSuggestions(true);
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

  const handleSelectSuggestion = (gameId: number) => {
    setShowSuggestions(false);
    window.location.href = `/game/${gameId}`;
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
      window.location.href = '/login';
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
        Following
      </Box>
      
      <Box 
        className={`nav-item ${activeTab === 'global' ? 'active' : ''}`}
        onClick={() => handleTabChange('global')}
      >
        <span className="icon">
          <FontAwesomeIcon icon={faGlobe} />
        </span>
        Global
      </Box>
      
      <Box 
        className={`nav-item ${activeTab === 'news' ? 'active' : ''}`}
        onClick={() => handleTabChange('news')}
      >
        <span className="icon">
          <FontAwesomeIcon icon={faNewspaper} />
        </span>
        Game News
      </Box>
      
      <Box 
        className="nav-item"
        onClick={() => {
          window.location.href = '/profile';
          if (inDrawer) setMobileDrawerOpen(false);
        }}
      >
        <span className="icon">
          <FontAwesomeIcon icon={faUser} />
        </span>
        Profile
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
        <MenuItem onClick={() => { window.location.href = '/profile'; handleUserMenuClose(); }}>
          <FontAwesomeIcon icon={faUser} style={{ marginRight: '10px' }} />
          Profile
        </MenuItem>
        <MenuItem onClick={handleUserMenuClose}>
          <FontAwesomeIcon icon={faBell} style={{ marginRight: '10px' }} />
          Notifications
        </MenuItem>
        <MenuItem onClick={handleUserMenuClose}>
          <FontAwesomeIcon icon={faEnvelope} style={{ marginRight: '10px' }} />
          Messages
        </MenuItem>
        <MenuItem onClick={handleUserMenuClose}>
          <FontAwesomeIcon icon={faCog} style={{ marginRight: '10px' }} />
          Settings
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
          
          {/* Trending Games (moved from right column for tablet) */}
          {isTablet && (
            <Box sx={{ mt: 4 }}>
              <Typography variant="subtitle2" sx={{ color: '#8899a6', mb: 2, fontWeight: 600, fontSize: '12px' }}>
                TRENDING
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {[1, 2, 3].map((item) => (
                  <Box 
                    key={item} 
                    sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      padding: '8px 10px',
                      borderRadius: '10px',
                      '&:hover': {
                        backgroundColor: 'rgba(29, 161, 242, 0.1)',
                      },
                      cursor: 'pointer'
                    }}
                  >
                    <Avatar variant="rounded" sx={{ width: 32, height: 32, mr: 1.5 }} />
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '0.8rem' }}>Game {item}</Typography>
                      <Typography variant="body2" sx={{ color: '#8899a6', fontSize: '0.7rem' }}>10.{item}K</Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          )}
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
              {activeTab === 'following' ? 'Following' : activeTab === 'global' ? 'Global' : 'Game News'}
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
                placeholder="Search GamEaten"
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
              padding: '20px',
              mb: 3,
              border: '1px solid #1e2c3c'
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Avatar sx={{ width: 60, height: 60 }} />
              <Box sx={{ ml: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  {loading ? 'Loading...' : username}
                </Typography>
                <Typography variant="body2" sx={{ color: '#8899a6' }}>
                  @{loading ? '...' : username.toLowerCase()}
                </Typography>
              </Box>
            </Box>
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Box>
                <Typography variant="body2">Following</Typography>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>125</Typography>
              </Box>
              <Box>
                <Typography variant="body2">Followers</Typography>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>48</Typography>
              </Box>
              <Box>
                <Typography variant="body2">Games</Typography>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>32</Typography>
              </Box>
            </Box>
            
            <Box sx={{ display: 'flex', gap: 1 }}>
              <IconButton sx={{ backgroundColor: '#1e2c3c', color: 'white', '&:hover': { backgroundColor: '#253341' } }}>
                <FontAwesomeIcon icon={faUser} />
              </IconButton>
              <IconButton sx={{ backgroundColor: '#1e2c3c', color: 'white', '&:hover': { backgroundColor: '#253341' } }}>
                <Badge badgeContent={4} color="error">
                  <FontAwesomeIcon icon={faBell} />
                </Badge>
              </IconButton>
              <IconButton sx={{ backgroundColor: '#1e2c3c', color: 'white', '&:hover': { backgroundColor: '#253341' } }}>
                <Badge badgeContent={2} color="error">
                  <FontAwesomeIcon icon={faEnvelope} />
                </Badge>
              </IconButton>
              <IconButton sx={{ backgroundColor: '#1e2c3c', color: 'white', '&:hover': { backgroundColor: '#253341' } }}>
                <FontAwesomeIcon icon={faCog} />
              </IconButton>
              <IconButton 
                sx={{ backgroundColor: '#1e2c3c', color: 'white', '&:hover': { backgroundColor: '#253341' } }}
                onClick={handleLogout}
              >
                <FontAwesomeIcon icon={faSignOutAlt} />
              </IconButton>
            </Box>
          </Box>

          <Box 
            sx={{ 
              backgroundColor: '#172331', 
              borderRadius: '15px',
              padding: '20px',
              border: '1px solid #1e2c3c'
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
              Who to Follow
            </Typography>
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {[1, 2, 3].map((item) => (
                <Box 
                  key={item} 
                  sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    padding: '8px 15px',
                    borderRadius: '10px',
                    '&:hover': {
                      backgroundColor: 'rgba(29, 161, 242, 0.1)',
                    },
                    cursor: 'pointer'
                  }}
                >
                  <Avatar variant="rounded" sx={{ width: 40, height: 40, mr: 2 }} />
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>User {item}</Typography>
                    <Typography variant="body2" sx={{ color: '#8899a6' }}>@user{item}</Typography>
                  </Box>
                </Box>
              ))}
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