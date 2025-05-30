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
  CircularProgress,
  Chip,
  Button,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  useMediaQuery,
  useTheme,
  Drawer,
  AppBar,
  Toolbar,
  Menu,
  MenuItem as MenuItemComponent,
  Fab,
  Alert,
  Skeleton
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
  faPencilAlt,
  faBars,
  faEllipsisV,
  faExternalLinkAlt,
  faFilter,
  faRefresh,
  faTimes,
  faBookmark,
  faTrophy
} from '@fortawesome/free-solid-svg-icons';
import { getCurrentUser, isAuthenticated, logout } from '../../api/auth';
import { searchGame, searchGameSuggestions, searchUsers } from '../../api/funcs';
import gameNewsAPI, { GameGiveaway, GameNewsFilters, GameWorthSummaryResponse } from '../../api/gameNews';
import ReviewDialog from '../../contexts/components/Review/review';

const GameGiveaways = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = useMediaQuery(theme.breakpoints.down('lg'));
  
  const [username, setUsername] = useState('Guest');
  const [currentUser, setCurrentUser] = useState<{ username: string, id: number, profile_photo?: string } | null>(null);
  const [giveaways, setGiveaways] = useState<GameGiveaway[]>([]);
  const [worthSummary, setWorthSummary] = useState<GameWorthSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingsLoading, setSavingsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<GameNewsFilters>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{id: number, name?: string, username?: string, type: 'game' | 'user', profile_photo?: string, cover_url?: string}>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  // Mobile-specific state
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);

  // Review dialog state
  const [openReviewDialog, setOpenReviewDialog] = useState(false);

  // Fetch user data and giveaways
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

    const fetchGiveaways = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await gameNewsAPI.getGameNews(filters);
        setGiveaways(response.data);
      } catch (err: any) {
        setError(err.data?.message || 'Failed to fetch giveaways');
      } finally {
        setLoading(false);
      }
    };

    const fetchTotalSavings = async () => {
      try {
        setSavingsLoading(true);
        const response = await gameNewsAPI.getGiveawaysWorthSummary();
        setWorthSummary(response);
      } catch (err: any) {
        console.error('Failed to fetch total savings:', err);
        // Don't set error state for savings, just log it
      } finally {
        setSavingsLoading(false);
      }
    };

    fetchUser();
    fetchGiveaways();
    fetchTotalSavings();
  }, [filters]);

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

  const handleFilterChange = (newFilters: Partial<GameNewsFilters>) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);
  };

  const clearFilters = () => {
    setFilters({});
    // Note: worthSummary is now automatically loaded and doesn't need to be cleared
  };

  const refreshGiveaways = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await gameNewsAPI.getGameNews(filters);
      setGiveaways(response.data);
    } catch (err: any) {
      setError(err.data?.message || 'Failed to fetch giveaways');
    } finally {
      setLoading(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'game':
        return faGamepad;
      case 'loot':
        return faGift;
      case 'beta':
        return faStar;
      default:
        return faGift;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'game':
        return '#1da1f2';
      case 'loot':
        return '#e91e63';
      case 'beta':
        return '#ff9800';
      default:
        return '#8899a6';
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Unknown';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      return 'Invalid Date';
    }
  };

  // Review dialog handlers
  const handleOpenReviewDialog = () => {
    setOpenReviewDialog(true);
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
              sx={{ 
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                backgroundColor: '#1da1f2',
                borderRadius: '30px',
                mx: 1
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
        <MenuItemComponent onClick={() => { navigate('/profile'); setUserMenuAnchor(null); }}>
          <FontAwesomeIcon icon={faUser} style={{ marginRight: '10px' }} />
          Profile
        </MenuItemComponent>
        <MenuItemComponent onClick={() => { logout(); navigate('/'); }}>
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
              className="nav-item active"
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

      {/* Middle Column - Giveaways Content */}
      <Box 
        sx={{ 
          width: isMobile ? '100%' : isTablet ? '500px' : '600px',
          borderRight: !isMobile && !isTablet ? '1px solid #1e2c3c' : 'none',
          minHeight: isMobile ? 'auto' : '100vh',
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
              Game Giveaways
            </Typography>
          </Box>
        )}

        {/* Filters Section */}
        <Box sx={{ p: isMobile ? 2 : 3, borderBottom: '1px solid #1e2c3c' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <FontAwesomeIcon icon={faFilter} style={{ marginRight: '8px', color: '#8899a6' }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Filters
            </Typography>
          </Box>
          
          <Box sx={{ 
            display: 'grid', 
            gridTemplateColumns: { 
              xs: '1fr', 
              sm: 'repeat(2, 1fr)', 
              md: 'repeat(3, 1fr)' 
            }, 
            gap: 2 
          }}>
            <Box>
              <FormControl fullWidth size="small">
                <InputLabel sx={{ color: '#8899a6' }}>Type</InputLabel>
                <Select
                  value={filters.type || ''}
                  onChange={(e) => handleFilterChange({ type: e.target.value as any })}
                  label="Type"
                  sx={{
                    backgroundColor: '#172331',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#1e2c3c' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#253341' },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#1da1f2' },
                    '& .MuiSelect-icon': { color: '#8899a6' }
                  }}
                >
                  <MenuItem value="">All Types</MenuItem>
                  <MenuItem value="game">Games</MenuItem>
                  <MenuItem value="loot">Loot</MenuItem>
                  <MenuItem value="beta">Beta Access</MenuItem>
                </Select>
              </FormControl>
            </Box>
            
            <Box>
              <FormControl fullWidth size="small">
                <InputLabel sx={{ color: '#8899a6' }}>Platform</InputLabel>
                <Select
                  value={filters.platform || ''}
                  onChange={(e) => handleFilterChange({ platform: e.target.value as any })}
                  label="Platform"
                  sx={{
                    backgroundColor: '#172331',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#1e2c3c' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#253341' },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#1da1f2' },
                    '& .MuiSelect-icon': { color: '#8899a6' }
                  }}
                >
                  <MenuItem value="">All Platforms</MenuItem>
                  <MenuItem value="pc">PC</MenuItem>
                  <MenuItem value="steam">Steam</MenuItem>
                  <MenuItem value="epic-games-store">Epic Games</MenuItem>
                  <MenuItem value="gog">GOG</MenuItem>
                  <MenuItem value="ps4">PlayStation 4</MenuItem>
                  <MenuItem value="ps5">PlayStation 5</MenuItem>
                  <MenuItem value="xbox-one">Xbox One</MenuItem>
                  <MenuItem value="xbox-series-xs">Xbox Series X/S</MenuItem>
                  <MenuItem value="switch">Nintendo Switch</MenuItem>
                </Select>
              </FormControl>
            </Box>
            
            <Box>
              <FormControl fullWidth size="small">
                <InputLabel sx={{ color: '#8899a6' }}>Sort By</InputLabel>
                <Select
                  value={filters.sortBy || 'date'}
                  onChange={(e) => handleFilterChange({ sortBy: e.target.value as any })}
                  label="Sort By"
                  sx={{
                    backgroundColor: '#172331',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#1e2c3c' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#253341' },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#1da1f2' },
                    '& .MuiSelect-icon': { color: '#8899a6' }
                  }}
                >
                  <MenuItem value="date">Latest</MenuItem>
                  <MenuItem value="value">Value</MenuItem>
                  <MenuItem value="popularity">Popularity</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Box>
          
          <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              startIcon={<FontAwesomeIcon icon={faRefresh} />}
              onClick={refreshGiveaways}
              disabled={loading}
              sx={{
                backgroundColor: '#1da1f2',
                '&:hover': { backgroundColor: '#1a91da' },
                borderRadius: '20px',
                textTransform: 'none'
              }}
            >
              Refresh
            </Button>
            <Button
              variant="outlined"
              startIcon={<FontAwesomeIcon icon={faTimes} />}
              onClick={clearFilters}
              sx={{
                borderColor: '#1e2c3c',
                color: '#8899a6',
                borderRadius: '20px',
                textTransform: 'none',
                '&:hover': {
                  borderColor: '#253341',
                  backgroundColor: 'rgba(29, 161, 242, 0.1)'
                }
              }}
            >
              Clear
            </Button>
          </Box>
        </Box>

        {/* Worth Summary */}
        {worthSummary && (
          <Box sx={{ p: 3, borderBottom: '1px solid #1e2c3c' }}>
            <Box 
              sx={{ 
                backgroundColor: '#172331',
                borderRadius: '15px',
                padding: '20px',
                border: '1px solid #1e2c3c'
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <FontAwesomeIcon icon={faStar} style={{ marginRight: '10px', color: '#FFD700' }} />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Worth Summary
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ color: '#8899a6', mb: 1 }}>
                <strong>{worthSummary.data.active_giveaways_number}</strong> active giveaways
              </Typography>
              <Typography variant="body2" sx={{ color: '#8899a6', mb: 1 }}>
                Total worth: <strong>${worthSummary.data.worth_estimation_usd}</strong>
              </Typography>
            </Box>
          </Box>
        )}

        {/* Error Display */}
        {error && (
          <Box sx={{ p: 2 }}>
            <Alert 
              severity="error" 
              sx={{ 
                backgroundColor: '#172331',
                border: '1px solid #e53e3e',
                color: 'white',
                '& .MuiAlert-icon': { color: '#e53e3e' }
              }}
            >
              {error}
            </Alert>
          </Box>
        )}

        {/* Loading State */}
        {loading && (
          <Box sx={{ p: 3 }}>
            <Box sx={{ 
              display: 'grid', 
              gridTemplateColumns: { 
                xs: '1fr', 
                sm: 'repeat(2, 1fr)' 
              }, 
              gap: 2 
            }}>
              {[...Array(6)].map((_, index) => (
                <Box key={index}>
                  <Box 
                    sx={{ 
                      backgroundColor: '#172331',
                      borderRadius: '15px',
                      padding: '16px',
                      border: '1px solid #1e2c3c'
                    }}
                  >
                    <Skeleton 
                      variant="rectangular" 
                      height={120} 
                      sx={{ backgroundColor: '#1e2c3c', borderRadius: '8px', mb: 2 }} 
                    />
                    <Skeleton variant="text" height={24} sx={{ backgroundColor: '#1e2c3c', mb: 1 }} />
                    <Skeleton variant="text" height={16} sx={{ backgroundColor: '#1e2c3c', mb: 1 }} />
                    <Skeleton variant="text" height={16} sx={{ backgroundColor: '#1e2c3c' }} />
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {/* Giveaways List */}
        {!loading && giveaways.length > 0 && (
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
              {giveaways.length} Giveaways Found
            </Typography>
            
            <Box sx={{ 
              display: 'grid', 
              gridTemplateColumns: { 
                xs: '1fr', 
                sm: 'repeat(2, 1fr)' 
              }, 
              gap: 2 
            }}>
              {giveaways.map((giveaway) => (
                <Box key={giveaway.id}>
                  <Box
                    sx={{
                      backgroundColor: '#172331',
                      borderRadius: '15px',
                      padding: '16px',
                      border: '1px solid #1e2c3c',
                      transition: 'all 0.2s',
                      '&:hover': {
                        borderColor: '#253341',
                        transform: 'translateY(-2px)'
                      }
                    }}
                  >
                    {/* Giveaway Image */}
                    {(giveaway.image || giveaway.thumbnail) && (
                      <Box sx={{ mb: 2 }}>
                        <img
                          src={giveaway.image || giveaway.thumbnail}
                          alt={giveaway.title}
                          style={{
                            width: '100%',
                            height: '120px',
                            objectFit: 'cover',
                            borderRadius: '8px',
                            backgroundColor: '#1e2c3c'
                          }}
                          onError={(e) => {
                            const target = e.currentTarget as HTMLImageElement;
                            target.style.display = 'none';
                          }}
                        />
                      </Box>
                    )}
                    
                    {/* Type and Worth badges */}
                    <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                      <Chip
                        label={giveaway.type}
                        size="small"
                        sx={{
                          backgroundColor: getTypeColor(giveaway.type),
                          color: 'white',
                          fontWeight: 'bold',
                          '& .MuiChip-icon': { color: 'white' }
                        }}
                        icon={<FontAwesomeIcon icon={getTypeIcon(giveaway.type)} style={{ fontSize: '0.8rem' }} />}
                      />
                      {giveaway.worth && giveaway.worth !== 'N/A' && (
                        <Chip
                          label={giveaway.worth}
                          size="small"
                          sx={{
                            backgroundColor: '#4caf50',
                            color: 'white',
                            fontWeight: 'bold'
                          }}
                        />
                      )}
                    </Box>
                    
                    {/* Title */}
                    <Typography 
                      variant="subtitle1" 
                      sx={{ 
                        fontWeight: 700, 
                        mb: 1,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}
                    >
                      {giveaway.title}
                    </Typography>
                    
                    {/* Description */}
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        color: '#8899a6', 
                        mb: 2,
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}
                    >
                      {giveaway.description}
                    </Typography>
                    
                    {/* Metadata */}
                    <Box sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <FontAwesomeIcon icon={faCalendarAlt} style={{ marginRight: '6px', color: '#8899a6', fontSize: '0.8rem' }} />
                        <Typography variant="caption" sx={{ color: '#8899a6' }}>
                          Published: {formatDate(giveaway.published_date)}
                        </Typography>
                      </Box>
                      {giveaway.end_date && (
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                          <FontAwesomeIcon icon={faCalendarAlt} style={{ marginRight: '6px', color: '#e91e63', fontSize: '0.8rem' }} />
                          <Typography variant="caption" sx={{ color: '#8899a6' }}>
                            Ends: {formatDate(giveaway.end_date)}
                          </Typography>
                        </Box>
                      )}
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <FontAwesomeIcon icon={faDesktop} style={{ marginRight: '6px', color: '#8899a6', fontSize: '0.8rem' }} />
                        <Typography variant="caption" sx={{ color: '#8899a6' }}>
                          {giveaway.platforms}
                        </Typography>
                      </Box>
                    </Box>
                    
                    {/* Action Button */}
                    <Button
                      variant="contained"
                      fullWidth
                      endIcon={<FontAwesomeIcon icon={faExternalLinkAlt} />}
                      onClick={() => window.open(giveaway.open_giveaway_url, '_blank')}
                      sx={{
                        backgroundColor: '#1da1f2',
                        borderRadius: '20px',
                        textTransform: 'none',
                        fontWeight: 'bold',
                        '&:hover': {
                          backgroundColor: '#1a91da'
                        }
                      }}
                    >
                      Claim Giveaway
                    </Button>
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {/* No Results */}
        {!loading && giveaways.length === 0 && !error && (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <FontAwesomeIcon icon={faGift} style={{ fontSize: '4rem', color: '#8899a6', marginBottom: '16px' }} />
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              No giveaways found
            </Typography>
            <Typography variant="body1" sx={{ color: '#8899a6', mb: 3 }}>
              Try adjusting your filters or check back later for new giveaways!
            </Typography>
            <Button
              variant="contained"
              onClick={refreshGiveaways}
              sx={{
                backgroundColor: '#1da1f2',
                borderRadius: '20px',
                textTransform: 'none',
                '&:hover': { backgroundColor: '#1a91da' }
              }}
            >
              Show All Giveaways
            </Button>
          </Box>
        )}
      </Box>

      {/* Right Column - User Profile & Search */}
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

          {/* Total Savings Card - Replaces Worth Calculator */}
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
              <FontAwesomeIcon icon={faStar} style={{ marginRight: '10px', color: '#FFD700' }} />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Total Savings
              </Typography>
            </Box>
            
            {savingsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                <CircularProgress size={24} sx={{ color: '#1da1f2' }} />
              </Box>
            ) : worthSummary ? (
              <>
                <Typography 
                  variant="h4" 
                  sx={{ 
                    color: '#4caf50', 
                    fontWeight: 'bold', 
                    textAlign: 'center',
                    mb: 1
                  }}
                >
                  ${worthSummary.data.worth_estimation_usd}
                </Typography>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    color: '#8899a6', 
                    textAlign: 'center',
                    mb: 2,
                    lineHeight: 1.4
                  }}
                >
                  {worthSummary.data.total_savings_message}
                </Typography>
                <Box sx={{ 
                  backgroundColor: '#1e2c3c', 
                  borderRadius: '8px', 
                  p: 1.5,
                  textAlign: 'center'
                }}>
                  <Typography variant="caption" sx={{ color: '#8899a6' }}>
                    <strong>{worthSummary.data.active_giveaways_number}</strong> active giveaways available
                  </Typography>
                </Box>
              </>
            ) : (
              <Typography variant="body2" sx={{ color: '#8899a6', textAlign: 'center' }}>
                Unable to load savings data
              </Typography>
            )}
          </Box>

          {/* Giveaway Stats */}
          <Box 
            sx={{ 
              backgroundColor: '#172331', 
              borderRadius: '15px',
              padding: '20px',
              border: '1px solid #1e2c3c'
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
              Giveaway Stats
            </Typography>
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" sx={{ color: '#8899a6' }}>
                Total Giveaways
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                {giveaways.length}
              </Typography>
            </Box>
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" sx={{ color: '#8899a6' }}>
                Free Games
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                {giveaways.filter(g => g.type === 'game').length}
              </Typography>
            </Box>
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" sx={{ color: '#8899a6' }}>
                Loot Offers
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                {giveaways.filter(g => g.type === 'loot').length}
              </Typography>
            </Box>
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" sx={{ color: '#8899a6' }}>
                Beta Access
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                {giveaways.filter(g => g.type === 'beta').length}
              </Typography>
            </Box>
          </Box>
        </Box>
      )}

      {/* Review Dialog */}
      <ReviewDialog 
        open={openReviewDialog} 
        onClose={() => setOpenReviewDialog(false)}
        onReviewSubmitted={() => setOpenReviewDialog(false)}
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

export default GameGiveaways; 