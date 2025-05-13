import { Box, Typography, Avatar, IconButton, Paper, Badge, InputBase, List, ListItem, ListItemText, CircularProgress, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Autocomplete } from '@mui/material';
import { useState, useEffect, useRef } from 'react';
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
  faTimes
} from '@fortawesome/free-solid-svg-icons';
import { getCurrentUser, isAuthenticated, logout } from '../../../api/auth.ts';
import { searchGame, searchGameSuggestions, createComment, getComments } from '../../../api/funcs.ts';

export const HomePage = () => {
  const [activeTab, setActiveTab] = useState('following');
  const [username, setUsername] = useState('Guest');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<Array<{id: number, name: string}>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchTimeoutRef = useRef<number | null>(null);
  // Review dialog state
  const [openReviewDialog, setOpenReviewDialog] = useState(false);
  const [reviewGameId, setReviewGameId] = useState<number | null>(null);
  const [reviewGameName, setReviewGameName] = useState('');
  const [reviewText, setReviewText] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [gameSearchResults, setGameSearchResults] = useState<Array<{id: number, name: string}>>([]);
  const [gameSearchQuery, setGameSearchQuery] = useState('');
  const [gameSearching, setGameSearching] = useState(false);
  const [refreshFeed, setRefreshFeed] = useState(false);

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
  };

  const handleLogout = () => {
    logout();
    // Redirect to login page or refresh
    window.location.href = '/';
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    try {
      setSearchLoading(true);
      const gameId = await searchGame({ query: searchQuery });
      
      if (gameId) {
        // Handle successful search - could navigate to game page
        console.log(`Found game with ID: ${gameId}`);
        setSearchResults(gameId);
        window.location.href = `/game/${gameId}`;
      }
    } catch (error) {
      console.error('Search failed:', error);
      // Handle search error - could show an error message
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSearchInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    // Clear any existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    if (query.trim().length >= 2) {
      setSearchLoading(true);
      
      // Set a new timeout with 500ms delay (0.5 seconds)
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

  // Clean up timeout on component unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Review dialog handlers
  const handleOpenReviewDialog = () => {
    if (!isAuthenticated()) {
      // Redirect to login if not authenticated
      window.location.href = '/login';
      return;
    }
    setOpenReviewDialog(true);
  };

  const handleCloseReviewDialog = () => {
    setOpenReviewDialog(false);
    setReviewGameId(null);
    setReviewGameName('');
    setReviewText('');
    setGameSearchQuery('');
    setGameSearchResults([]);
  };

  const handleGameSearchChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const query = event.target.value;
    setGameSearchQuery(query);
    
    // Clear any existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    if (query.trim().length >= 2) {
      setGameSearching(true);
      
      // Set a new timeout with 500ms delay (0.5 seconds)
      searchTimeoutRef.current = window.setTimeout(async () => {
        try {
          const results = await searchGameSuggestions({ query });
          setGameSearchResults(results);
        } catch (error) {
          console.error('Error fetching game suggestions:', error);
        } finally {
          setGameSearching(false);
        }
      }, 500);
    } else {
      setGameSearchResults([]);
      setGameSearching(false);
    }
  };

  const handleGameSelect = (event: React.SyntheticEvent, value: { id: number; name: string } | null) => {
    if (value) {
      setReviewGameId(value.id);
      setReviewGameName(value.name);
    } else {
      setReviewGameId(null);
      setReviewGameName('');
    }
  };

  const handleReviewTextChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setReviewText(event.target.value);
  };  const handleSubmitReview = async () => {
    if (!reviewGameId || !reviewText.trim() || !isAuthenticated()) {
      return; // Don't submit if any required field is missing
    }
    
    try {
      setReviewSubmitting(true);
      await createComment({
        id_game: reviewGameId,
        comment: reviewText
      });
      
      // Close the dialog first
      handleCloseReviewDialog();
      
      // Add a small delay to ensure the backend has processed the review
      setTimeout(() => {
        // Then toggle the refresh trigger to refresh the feed
        setRefreshFeed(prev => !prev);
        
      }, 500);
    } catch (error) {
      console.error('Error posting review:', error);
      alert('Failed to post review. Please try again.');
    } finally {
      setReviewSubmitting(false);
    }
  };

  return (
    <Box sx={{ 
      display: 'flex', 
      justifyContent: 'center',
      minHeight: '100vh', 
      width: '100%',
      margin: 0,
      padding: 0,
      backgroundColor: '#0e1621'
    }}>
      {/* Left Column - Navigation */}
      <Box 
        sx={{ 
          width: '220px', 
          borderRight: '1px solid #1e2c3c', 
          padding: '20px',
          height: '100vh',
          position: 'sticky',
          top: 0,
          overflowY: 'auto'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
          <FontAwesomeIcon icon={faGamepad} style={{ marginRight: '10px' }} />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>GamEaten</Typography>
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
            className={`nav-item ${activeTab === 'following' ? 'active' : ''}`}
            onClick={() => handleTabChange('following')}
            sx={{ cursor: 'pointer' }}
          >
            <span className="icon">
              <FontAwesomeIcon icon={faHome} />
            </span>
            Following
          </Box>
          
          <Box 
            className={`nav-item ${activeTab === 'global' ? 'active' : ''}`}
            onClick={() => handleTabChange('global')}
            sx={{ cursor: 'pointer' }}
          >
            <span className="icon">
              <FontAwesomeIcon icon={faGlobe} />
            </span>
            Global
          </Box>
          
          <Box 
            className={`nav-item ${activeTab === 'news' ? 'active' : ''}`}
            onClick={() => handleTabChange('news')}
            sx={{ cursor: 'pointer' }}
          >
            <span className="icon">
              <FontAwesomeIcon icon={faNewspaper} />
            </span>
            Game News          </Box>
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
        
        {/* Trending Games (moved from right column) */}
        <Box sx={{ mt: 4 }}>
          <Typography variant="subtitle2" sx={{ color: '#8899a6', mb: 2, fontWeight: 600, fontSize: '12px' }}>
            TRENDING GAMES
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
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Game {item}</Typography>
                  <Typography variant="body2" sx={{ color: '#8899a6' }}>10.{item}K players</Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>

      {/* Middle Column - Main Content */}
      <Box 
        sx={{ 
          width: '600px',
          borderRight: '1px solid #1e2c3c',
          height: '100%'
        }}
      >
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
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {activeTab === 'following' ? 'Following' : activeTab === 'global' ? 'Global' : 'Game News'}
          </Typography>
        </Box>        <Box sx={{ p: 2 }}>
          {/* Force GameFeed to re-render when refreshTrigger changes */}
          <GameFeed key={`feed-${refreshFeed}`}/>
        </Box>
      </Box>

      {/* Right Column - User Profile & Recommendations */}
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
      </Box>      {/* Review Dialog */}
      <Dialog 
        open={openReviewDialog} 
        onClose={handleCloseReviewDialog}
        fullWidth
        maxWidth="sm"
        PaperProps={{
          sx: {
            backgroundColor: '#172331',
            color: 'white',
            border: '1px solid #1e2c3c',
          }
        }}
      >
        <DialogTitle sx={{ color: 'white' }}>Create Game Review</DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Autocomplete
            options={gameSearchResults}
            getOptionLabel={(option) => option.name}
            loading={gameSearching}
            onChange={handleGameSelect}
            componentsProps={{
              popper: {
                sx: {
                  '& .MuiPaper-root': {
                    backgroundColor: '#172331',
                    color: 'white',
                    border: '1px solid #1e2c3c'
                  }
                }
              }
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: '#1e2c3c' },
                '&:hover fieldset': { borderColor: '#1da1f2' },
                '&.Mui-focused fieldset': { borderColor: '#1da1f2' },
                color: 'white'
              },
              '& .MuiInputLabel-root': { color: '#8899a6' },
              '& .MuiAutocomplete-endAdornment': { color: 'white' },
              '& .MuiAutocomplete-paper': { 
                backgroundColor: '#172331', 
                color: 'white',
                border: '1px solid #1e2c3c'
              },
              '& .MuiAutocomplete-listbox': {
                backgroundColor: '#172331',
                color: 'white',
                '& .MuiAutocomplete-option': {
                  '&:hover': {
                    backgroundColor: 'rgba(29, 161, 242, 0.1)'
                  },
                  '&.Mui-focused': {
                    backgroundColor: 'rgba(29, 161, 242, 0.2)'
                  }
                }
              },            '& .MuiAutocomplete-noOptions': {
                backgroundColor: '#172331',
                color: '#8899a6'
              },
              '& .MuiAutocomplete-loading': {
                color: '#8899a6'
              }
            }}            renderInput={(params) => (
              <TextField
                {...params}
                label="Search for a game"
                variant="outlined"
                fullWidth
                onChange={handleGameSearchChange}
                value={gameSearchQuery}
                sx={{
                  input: { color: 'white' },
                  '& .MuiOutlinedInput-root': { color: 'white' }
                }}
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {gameSearching ? <CircularProgress color="inherit" size={20} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
          />
          
          {reviewGameName && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2">Selected game:</Typography>
              <Typography variant="body1">{reviewGameName}</Typography>
            </Box>
          )}
          
          <TextField
            label="Write your review"
            multiline
            rows={4}
            fullWidth
            variant="outlined"
            value={reviewText}
            onChange={handleReviewTextChange}
            sx={{ 
              mt: 2,
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: '#1e2c3c' },
                '&:hover fieldset': { borderColor: '#1da1f2' },
                '&.Mui-focused fieldset': { borderColor: '#1da1f2' },
                color: 'white'
              },
              '& .MuiInputLabel-root': { color: '#8899a6' }
            }}
          />
        </DialogContent>
        <DialogActions sx={{ backgroundColor: '#172331' }}>
          <Button 
            onClick={handleCloseReviewDialog} 
            sx={{ color: '#8899a6' }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmitReview} 
            variant="contained" 
            disabled={!reviewGameId || !reviewText.trim() || reviewSubmitting}
            sx={{ 
              backgroundColor: '#1da1f2',
              '&:hover': { backgroundColor: '#1a91da' },
              '&.Mui-disabled': { backgroundColor: '#0e4667' }
            }}
          >
            {reviewSubmitting ? <CircularProgress size={24} /> : 'Post Review'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default HomePage;