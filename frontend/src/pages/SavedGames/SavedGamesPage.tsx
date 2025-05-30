import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Card,
  CardMedia,
  CardContent,
  Chip,
  Button,
  useTheme,
  useMediaQuery,
  IconButton,
  AppBar,
  Toolbar,
  Menu,
  MenuItem,
  Fab
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faGamepad,
  faBookmark,
  faArrowLeft,
  faEllipsisV,
  faSignOutAlt,
  faHome,
  faPlus
} from '@fortawesome/free-solid-svg-icons';
import { useParams, useNavigate } from 'react-router-dom';
import { isAuthenticated, logout } from '../../api/auth';
import SavedGamesDialog from '../../contexts/components/SavedGames/SavedGamesDialog';

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

const SavedGamesPage: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const [savedGames, setSavedGames] = useState<SavedGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);
  const [openSavedGamesDialog, setOpenSavedGamesDialog] = useState(false);

  useEffect(() => {
    fetchSavedGames();
  }, [username]);

  const fetchSavedGames = async () => {
    if (!isAuthenticated()) {
      navigate('/');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      let url = '/api/saved-games';
      if (username) {
        url = `/api/saved-games/${username}`;
        setIsOwnProfile(false);
      } else {
        setIsOwnProfile(true);
      }

      const headers: HeadersInit = {};
      if (isOwnProfile) {
        headers['Authorization'] = `Bearer ${localStorage.getItem('authToken')}`;
      }

      const response = await fetch(url, { headers });
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

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleGameClick = (gameId: number) => {
    navigate(`/game/${gameId}`);
  };

  const displayUsername = username || 'Your';

  return (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      backgroundColor: '#0e1621',
      color: 'white'
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
              onClick={() => navigate(-1)}
              sx={{ p: 1 }}
            >
              <FontAwesomeIcon icon={faArrowLeft} />
            </IconButton>
            
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <FontAwesomeIcon icon={faBookmark} style={{ marginRight: '8px' }} />
              <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.1rem' }}>
                Saved Games
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
        <MenuItem onClick={() => { navigate('/home'); setUserMenuAnchor(null); }}>
          <FontAwesomeIcon icon={faHome} style={{ marginRight: '10px' }} />
          Home
        </MenuItem>
        <MenuItem onClick={() => { handleLogout(); setUserMenuAnchor(null); }}>
          <FontAwesomeIcon icon={faSignOutAlt} style={{ marginRight: '10px' }} />
          Logout
        </MenuItem>
      </Menu>

      {/* Main Content */}
      <Box sx={{
        flex: 1,
        display: 'flex',
        justifyContent: 'center',
        p: isMobile ? 0 : 3
      }}>
        <Box sx={{
          width: '100%',
          maxWidth: '800px',
          backgroundColor: isMobile ? 'transparent' : '#172331',
          borderRadius: isMobile ? 0 : '15px',
          border: isMobile ? 'none' : '1px solid #1e2c3c',
          overflow: 'hidden'
        }}>
          {/* Desktop Header */}
          {!isMobile && (
            <Box sx={{
              p: 3,
              borderBottom: '1px solid #1e2c3c',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <IconButton 
                  onClick={() => navigate(-1)}
                  sx={{ color: 'white' }}
                >
                  <FontAwesomeIcon icon={faArrowLeft} />
                </IconButton>
                <FontAwesomeIcon icon={faBookmark} style={{ color: '#1da1f2' }} />
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {displayUsername} Saved Games
                </Typography>
              </Box>
              
              {isOwnProfile && (
                <Button
                  variant="contained"
                  onClick={() => setOpenSavedGamesDialog(true)}
                  sx={{
                    backgroundColor: '#1da1f2',
                    '&:hover': { backgroundColor: '#1a91da' }
                  }}
                >
                  <FontAwesomeIcon icon={faPlus} style={{ marginRight: '8px' }} />
                  Add Games
                </Button>
              )}
            </Box>
          )}

          {/* Content */}
          <Box sx={{ p: isMobile ? 2 : 3 }}>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            ) : error ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="h6" sx={{ color: '#e0245e', mb: 2 }}>
                  Error
                </Typography>
                <Typography variant="body1" sx={{ color: '#8899a6' }}>
                  {error}
                </Typography>
              </Box>
            ) : savedGames.length > 0 ? (
              <>
                <Typography variant="body1" sx={{ color: '#8899a6', mb: 3 }}>
                  {savedGames.length} game{savedGames.length !== 1 ? 's' : ''} saved
                </Typography>
                
                <Box sx={{
                  display: 'grid',
                  gridTemplateColumns: isMobile 
                    ? 'repeat(auto-fill, minmax(150px, 1fr))' 
                    : 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: 2
                }}>
                  {savedGames.map((savedGame) => (
                    <Card
                      key={savedGame.id}
                      onClick={() => handleGameClick(savedGame.game_id)}
                      sx={{
                        backgroundColor: '#0e1621',
                        border: '1px solid #1e2c3c',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          borderColor: '#1da1f2',
                          transform: 'translateY(-2px)'
                        }
                      }}
                    >
                      <CardMedia
                        component="img"
                        sx={{
                          height: isMobile ? 200 : 280,
                          objectFit: 'cover',
                          backgroundColor: '#172331'
                        }}
                        image={savedGame.game_info.cover_url || '/placeholder-game.png'}
                        alt={savedGame.game_info.name}
                      />
                      <CardContent sx={{ p: 2 }}>
                        <Typography 
                          variant="subtitle1" 
                          sx={{ 
                            fontWeight: 600, 
                            mb: 1,
                            color: 'white',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
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
                        
                        <Typography variant="caption" sx={{ color: '#8899a6' }}>
                          Saved {new Date(savedGame.created_at).toLocaleDateString()}
                        </Typography>
                      </CardContent>
                    </Card>
                  ))}
                </Box>
              </>
            ) : (
              <Box sx={{ textAlign: 'center', py: 6 }}>
                <FontAwesomeIcon 
                  icon={faGamepad} 
                  size="4x" 
                  style={{ color: '#8899a6', marginBottom: '24px' }} 
                />
                <Typography variant="h5" sx={{ color: '#8899a6', mb: 2 }}>
                  {isOwnProfile ? 'No saved games yet' : `${displayUsername} hasn't saved any games yet`}
                </Typography>
                <Typography variant="body1" sx={{ color: '#8899a6', mb: 3 }}>
                  {isOwnProfile 
                    ? 'Start building your game collection by searching and adding games' 
                    : 'Check back later to see their game collection'
                  }
                </Typography>
                
                {isOwnProfile && (
                  <Button
                    variant="contained"
                    onClick={() => setOpenSavedGamesDialog(true)}
                    sx={{
                      backgroundColor: '#1da1f2',
                      '&:hover': { backgroundColor: '#1a91da' }
                    }}
                  >
                    <FontAwesomeIcon icon={faPlus} style={{ marginRight: '8px' }} />
                    Add Your First Game
                  </Button>
                )}
              </Box>
            )}
          </Box>
        </Box>
      </Box>

      {/* Floating Action Button for Mobile */}
      {isMobile && isOwnProfile && (
        <Fab
          color="primary"
          onClick={() => setOpenSavedGamesDialog(true)}
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
          <FontAwesomeIcon icon={faPlus} />
        </Fab>
      )}

      {/* Saved Games Dialog */}
      <SavedGamesDialog
        open={openSavedGamesDialog}
        onClose={() => {
          setOpenSavedGamesDialog(false);
          // Refresh the page data after closing dialog
          fetchSavedGames();
        }}
      />
    </Box>
  );
};

export default SavedGamesPage; 