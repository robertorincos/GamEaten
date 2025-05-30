import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  CircularProgress,
  Alert,
  IconButton,
  Tabs,
  Tab,
  useTheme,
  useMediaQuery,
  Chip,
  Card,
  CardMedia,
  CardContent,
  InputAdornment
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faX, 
  faSearch, 
  faPlus, 
  faTrash, 
  faGamepad,
  faBookmark,
  faSpinner
} from '@fortawesome/free-solid-svg-icons';

interface SavedGame {
  id: number;
  game_id: number;
  created_at: string;
  game_info: {
    id: number;
    name: string;
    cover_url?: string;
    rating?: number;
    summary?: string;
  };
}

interface GameSuggestion {
  id: number;
  name: string;
  cover_url?: string;
  rating?: number;
}

interface SavedGamesDialogProps {
  open: boolean;
  onClose: () => void;
}

const SavedGamesDialog: React.FC<SavedGamesDialogProps> = ({
  open,
  onClose
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const [activeTab, setActiveTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [gameSuggestions, setGameSuggestions] = useState<GameSuggestion[]>([]);
  const [savedGames, setSavedGames] = useState<SavedGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch saved games when dialog opens
  useEffect(() => {
    if (open) {
      fetchSavedGames();
    }
  }, [open]);

  // Search for games with debouncing
  useEffect(() => {
    if (searchQuery.trim().length >= 2) {
      const timeoutId = setTimeout(() => {
        searchGames();
      }, 500);
      return () => clearTimeout(timeoutId);
    } else {
      setGameSuggestions([]);
    }
  }, [searchQuery]);

  const fetchSavedGames = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/saved-games', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });

      const data = await response.json();
      if (data.status === 'success') {
        setSavedGames(data.saved_games);
      } else {
        setError(data.message || 'Failed to fetch saved games');
      }
    } catch (error) {
      setError('Failed to fetch saved games');
    } finally {
      setLoading(false);
    }
  };

  const searchGames = async () => {
    try {
      setSearchLoading(true);
      const response = await fetch('/api/games/search-suggestions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: searchQuery })
      });

      const data = await response.json();
      if (data.status === 'success') {
        setGameSuggestions(data.games);
      } else {
        setError(data.message || 'Failed to search games');
      }
    } catch (error) {
      setError('Failed to search games');
    } finally {
      setSearchLoading(false);
    }
  };

  const addToSavedGames = async (gameId: number) => {
    try {
      const response = await fetch('/api/saved-games', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({ game_id: gameId })
      });

      const data = await response.json();
      if (data.status === 'success') {
        setSuccess('Game added to saved games!');
        await fetchSavedGames();
        // Remove from suggestions if successfully added
        setGameSuggestions(prev => prev.filter(game => game.id !== gameId));
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.message || 'Failed to save game');
      }
    } catch (error) {
      setError('Failed to save game');
    }
  };

  const removeFromSavedGames = async (gameId: number) => {
    try {
      const response = await fetch('/api/saved-games', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({ game_id: gameId })
      });

      const data = await response.json();
      if (data.status === 'success') {
        setSuccess('Game removed from saved games!');
        await fetchSavedGames();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.message || 'Failed to remove game');
      }
    } catch (error) {
      setError('Failed to remove game');
    }
  };

  const handleClose = () => {
    setSearchQuery('');
    setGameSuggestions([]);
    setError(null);
    setSuccess(null);
    setActiveTab(0);
    onClose();
  };

  const isGameAlreadySaved = (gameId: number) => {
    return savedGames.some(saved => saved.game_id === gameId);
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      fullScreen={isMobile}
      PaperProps={{
        sx: {
          backgroundColor: '#172331',
          color: 'white',
          border: '1px solid #1e2c3c',
          borderRadius: isMobile ? 0 : '15px',
          minHeight: isMobile ? '100vh' : '600px'
        }
      }}
    >
      <DialogTitle sx={{ 
        borderBottom: '1px solid #1e2c3c',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        p: 3
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <FontAwesomeIcon icon={faBookmark} style={{ color: '#1da1f2' }} />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Saved Games
          </Typography>
        </Box>
        <IconButton onClick={handleClose} sx={{ color: 'white' }}>
          <FontAwesomeIcon icon={faX} />
        </IconButton>
      </DialogTitle>

      <Box sx={{ borderBottom: '1px solid #1e2c3c' }}>
        <Tabs
          value={activeTab}
          onChange={(_, value) => setActiveTab(value)}
          sx={{
            '& .MuiTab-root': {
              color: '#8899a6',
              textTransform: 'none',
              fontWeight: 600,
              minWidth: 0,
              flex: 1,
              '&.Mui-selected': {
                color: '#1da1f2'
              }
            },
            '& .MuiTabs-indicator': {
              backgroundColor: '#1da1f2'
            }
          }}
        >
          <Tab label={`My Saved Games (${savedGames.length})`} />
          <Tab label="Add Games" />
        </Tabs>
      </Box>

      <DialogContent sx={{ p: 0, height: isMobile ? 'calc(100vh - 200px)' : '400px', overflow: 'hidden' }}>
        {error && (
          <Alert 
            severity="error" 
            sx={{ m: 2, backgroundColor: '#2c1810', color: '#ff6b6b' }}
            onClose={() => setError(null)}
          >
            {error}
          </Alert>
        )}
        
        {success && (
          <Alert 
            severity="success" 
            sx={{ m: 2, backgroundColor: '#1a3421', color: '#51cf66' }}
            onClose={() => setSuccess(null)}
          >
            {success}
          </Alert>
        )}

        {/* Saved Games Tab */}
        {activeTab === 0 && (
          <Box sx={{ p: 2, height: '100%', overflowY: 'auto' }}>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            ) : savedGames.length > 0 ? (
              <Box sx={{ display: 'grid', gap: 2 }}>
                {savedGames.map((savedGame) => (
                  <Card
                    key={savedGame.id}
                    sx={{
                      backgroundColor: '#0e1621',
                      border: '1px solid #1e2c3c',
                      display: 'flex',
                      '&:hover': {
                        borderColor: '#1da1f2'
                      }
                    }}
                  >
                    <CardMedia
                      component="img"
                      sx={{ 
                        width: 80, 
                        height: 120,
                        objectFit: 'cover',
                        backgroundColor: '#172331'
                      }}
                      image={savedGame.game_info.cover_url || '/placeholder-game.png'}
                      alt={savedGame.game_info.name}
                    />
                    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                      <CardContent sx={{ flex: '1 0 auto', p: 2 }}>
                        <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, color: 'white' }}>
                          {savedGame.game_info.name}
                        </Typography>
                        {savedGame.game_info.rating && (
                          <Chip
                            label={`${Math.round(savedGame.game_info.rating)}/100`}
                            size="small"
                            sx={{
                              backgroundColor: '#1da1f2',
                              color: 'white',
                              mb: 1
                            }}
                          />
                        )}
                        <Typography variant="body2" sx={{ color: '#8899a6' }}>
                          Saved on {new Date(savedGame.created_at).toLocaleDateString()}
                        </Typography>
                      </CardContent>
                      <Box sx={{ p: 2, pt: 0 }}>
                        <Button
                          size="small"
                          onClick={() => removeFromSavedGames(savedGame.game_id)}
                          sx={{ 
                            color: '#e0245e',
                            '&:hover': { backgroundColor: 'rgba(224, 36, 94, 0.1)' }
                          }}
                        >
                          <FontAwesomeIcon icon={faTrash} style={{ marginRight: '8px' }} />
                          Remove
                        </Button>
                      </Box>
                    </Box>
                  </Card>
                ))}
              </Box>
            ) : (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <FontAwesomeIcon 
                  icon={faGamepad} 
                  size="3x" 
                  style={{ color: '#8899a6', marginBottom: '16px' }} 
                />
                <Typography variant="h6" sx={{ color: '#8899a6', mb: 1 }}>
                  No saved games yet
                </Typography>
                <Typography variant="body2" sx={{ color: '#8899a6' }}>
                  Start building your game collection by searching and adding games
                </Typography>
              </Box>
            )}
          </Box>
        )}

        {/* Add Games Tab */}
        {activeTab === 1 && (
          <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <TextField
              fullWidth
              placeholder="Search for games..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              variant="outlined"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <FontAwesomeIcon icon={faSearch} style={{ color: '#8899a6' }} />
                  </InputAdornment>
                ),
                endAdornment: searchLoading && (
                  <InputAdornment position="end">
                    <FontAwesomeIcon icon={faSpinner} spin style={{ color: '#8899a6' }} />
                  </InputAdornment>
                )
              }}
              sx={{
                mb: 2,
                '& .MuiOutlinedInput-root': {
                  backgroundColor: '#0e1621',
                  color: 'white',
                  '& fieldset': {
                    borderColor: '#1e2c3c'
                  },
                  '&:hover fieldset': {
                    borderColor: '#1da1f2'
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#1da1f2'
                  }
                }
              }}
            />

            <Box sx={{ flex: 1, overflowY: 'auto' }}>
              {gameSuggestions.length > 0 ? (
                <Box sx={{ display: 'grid', gap: 2 }}>
                  {gameSuggestions.map((game) => {
                    const alreadySaved = isGameAlreadySaved(game.id);
                    return (
                      <Card
                        key={game.id}
                        sx={{
                          backgroundColor: '#0e1621',
                          border: '1px solid #1e2c3c',
                          display: 'flex',
                          opacity: alreadySaved ? 0.6 : 1,
                          '&:hover': {
                            borderColor: alreadySaved ? '#1e2c3c' : '#1da1f2'
                          }
                        }}
                      >
                        <CardMedia
                          component="img"
                          sx={{ 
                            width: 60, 
                            height: 80,
                            objectFit: 'cover',
                            backgroundColor: '#172331'
                          }}
                          image={game.cover_url || '/placeholder-game.png'}
                          alt={game.name}
                        />
                        <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                          <CardContent sx={{ flex: '1 0 auto', p: 2 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1, color: 'white' }}>
                              {game.name}
                            </Typography>
                            {game.rating && (
                              <Chip
                                label={`${Math.round(game.rating)}/100`}
                                size="small"
                                sx={{
                                  backgroundColor: '#1da1f2',
                                  color: 'white'
                                }}
                              />
                            )}
                          </CardContent>
                          <Box sx={{ p: 2, pt: 0 }}>
                            <Button
                              size="small"
                              onClick={() => addToSavedGames(game.id)}
                              disabled={alreadySaved}
                              sx={{ 
                                color: alreadySaved ? '#8899a6' : '#1da1f2',
                                '&:hover': { 
                                  backgroundColor: alreadySaved ? 'transparent' : 'rgba(29, 161, 242, 0.1)' 
                                }
                              }}
                            >
                              <FontAwesomeIcon 
                                icon={alreadySaved ? faBookmark : faPlus} 
                                style={{ marginRight: '8px' }} 
                              />
                              {alreadySaved ? 'Already Saved' : 'Add to Saved'}
                            </Button>
                          </Box>
                        </Box>
                      </Card>
                    );
                  })}
                </Box>
              ) : searchQuery.trim().length >= 2 && !searchLoading ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="body1" sx={{ color: '#8899a6' }}>
                    No games found for "{searchQuery}"
                  </Typography>
                </Box>
              ) : searchQuery.trim().length < 2 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <FontAwesomeIcon 
                    icon={faSearch} 
                    size="2x" 
                    style={{ color: '#8899a6', marginBottom: '16px' }} 
                  />
                  <Typography variant="body1" sx={{ color: '#8899a6' }}>
                    Start typing to search for games
                  </Typography>
                </Box>
              ) : null}
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 3, borderTop: '1px solid #1e2c3c' }}>
        <Button
          onClick={handleClose}
          sx={{
            color: '#8899a6',
            '&:hover': {
              backgroundColor: 'rgba(136, 153, 166, 0.1)'
            }
          }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SavedGamesDialog; 