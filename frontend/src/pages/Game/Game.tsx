import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
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
  CircularProgress,
  Tabs,
  Tab,
  Divider,
  Chip,
  Button,
  TextField
} from '@mui/material';
import Grid from '@mui/material/Grid';
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
  faComment,
  faHeart,
  faRetweet,
  faShare,
  faStar,
  faCalendarAlt,
  faDesktop,
  faBookmark
} from '@fortawesome/free-solid-svg-icons';
import { getCurrentUser, isAuthenticated, logout } from '../../api/auth';
import { getGameDetails, searchGame, searchGameSuggestions, createComment, getComments } from '../../api/funcs';
import axios from 'axios';

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
  comment: string;
  date_created: string;
}

interface CommentsResponse {
  comments: Comment[];
  pagination: {
    total: number;
    pages: number;
    current_page: number;
    per_page: number;
  };
}

const Game = () => {
  const { id } = useParams<{ id: string }>();
  const [gameDetails, setGameDetails] = useState<GameDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [username, setUsername] = useState('Guest');
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{id: number, name: string}>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
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
          }
        } catch (error) {
          console.error('Failed to fetch user data:', error);
        }
      }
    };

    fetchGameDetails();
    fetchUser();
  }, [id]);

  // Fetch comments
  useEffect(() => {
    const fetchComments = async () => {
      if (!id) return;
      
      try {
        setCommentLoading(true);
        const gameId = parseInt(id, 10);
        
        // Use the proper getComments function from funcs.ts
        const response = await getComments({
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

    fetchComments();
  }, [id]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
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
    window.location.href = `/game/${gameId}`;
  };

  const handleClickOutside = () => {
    setShowSuggestions(false);
  };

  const handleSubmitComment = async () => {
    if (!commentText.trim() || !id || !isAuthenticated()) return;
    
    try {
      const gameId = parseInt(id, 10);
      await createComment({
        id_game: gameId,
        comment: commentText
      });
      
      // Refresh comments after posting
      const response = await getComments({
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
            className="nav-item"
            onClick={() => window.location.href = '/home'}
            sx={{ cursor: 'pointer' }}
          >
            <span className="icon">
              <FontAwesomeIcon icon={faHome} />
            </span>
            Home
          </Box>
          
          <Box 
            className="nav-item"
            onClick={() => window.location.href = '/global'}
            sx={{ cursor: 'pointer' }}
          >
            <span className="icon">
              <FontAwesomeIcon icon={faGlobe} />
            </span>
            Global
          </Box>
          
          <Box 
            className="nav-item"
            onClick={() => window.location.href = '/news'}
            sx={{ cursor: 'pointer' }}
          >
            <span className="icon">
              <FontAwesomeIcon icon={faNewspaper} />
            </span>
            Game News
          </Box>
          
          <Box 
            className="nav-item"
            onClick={() => window.location.href = '/profile'}
            sx={{ cursor: 'pointer' }}
          >
            <span className="icon">
              <FontAwesomeIcon icon={faUser} />
            </span>
            Profile
          </Box>
        </Box>
      </Box>

      {/* Middle Column - Game Content */}
      <Box 
        sx={{ 
          width: '600px',
          borderRight: '1px solid #1e2c3c',
          minHeight: '100vh'
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
                height: '200px', 
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
                  bottom: '-50px', 
                  left: '20px',
                  border: '4px solid #0e1621',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  width: '120px',
                  height: '120px',
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
                  bottom: '-40px', 
                  right: '20px',
                  display: 'flex',
                  gap: 2
                }}
              >
                <Button 
                  variant="contained" 
                  color="primary"
                  startIcon={<FontAwesomeIcon icon={faBookmark} />}
                  sx={{ borderRadius: '30px', textTransform: 'none' }}
                >
                  Save Game
                </Button>
              </Box>
            </Box>

            {/* Game Info */}
            <Box sx={{ pt: 7, px: 3, pb: 2 }}>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {gameDetails.name}
              </Typography>

              {gameDetails.rating && (
                <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                  <FontAwesomeIcon icon={faStar} style={{ color: '#FFD700', marginRight: '8px' }} />
                  <Typography variant="subtitle1">
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
                    <CircularProgress />
                  </Box>
                ) : comments.length > 0 ? (
                  comments.map((comment) => (
                    <Box key={comment.id} sx={{ mb: 3, pb: 3, borderBottom: '1px solid #1e2c3c' }}>
                      <Box sx={{ display: 'flex', gap: 2 }}>
                        <Avatar sx={{ width: 48, height: 48 }}>
                          {comment.username?.toString().charAt(0).toUpperCase()}
                        </Avatar>
                        <Box sx={{ flexGrow: 1 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                              User {comment.username}
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#8899a6' }}>
                              {new Date(comment.date_created).toLocaleDateString()}
                            </Typography>
                          </Box>
                          <Typography variant="body1" sx={{ mt: 1 }}>
                            {comment.comment}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 3, mt: 2 }}>
                            <IconButton size="small" sx={{ color: '#8899a6' }}>
                              <FontAwesomeIcon icon={faComment} />
                            </IconButton>
                            <IconButton size="small" sx={{ color: '#8899a6' }}>
                              <FontAwesomeIcon icon={faHeart} />
                            </IconButton>
                            <IconButton size="small" sx={{ color: '#8899a6' }}>
                              <FontAwesomeIcon icon={faShare} />
                            </IconButton>
                          </Box>
                        </Box>
                      </Box>
                    </Box>
                  ))
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
                  Similar games feature coming soon!
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
            <Avatar sx={{ width: 60, height: 60 }}>
              {username?.charAt(0).toUpperCase()}
            </Avatar>
            <Box sx={{ ml: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                {username}
              </Typography>
              <Typography variant="body2" sx={{ color: '#8899a6' }}>
                @{username.toLowerCase()}
              </Typography>
            </Box>
          </Box>
          
          <Box sx={{ display: 'flex', gap: 1 }}>
            <IconButton sx={{ backgroundColor: '#1e2c3c', color: 'white', '&:hover': { backgroundColor: '#253341' } }}
              onClick={() => window.location.href = '/profile'}>
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

        {/* Trending Games */}
        <Box 
          sx={{ 
            backgroundColor: '#172331', 
            borderRadius: '15px',
            padding: '20px',
            border: '1px solid #1e2c3c'
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
            Trending Games
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
    </Box>
  );
};

export default Game;