import { Box, Typography, Avatar, IconButton, Paper, Badge, InputBase, List, ListItem, ListItemText, CircularProgress } from '@mui/material';
import { useState, useEffect } from 'react';
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
  faSpinner
} from '@fortawesome/free-solid-svg-icons';
import { getCurrentUser, isAuthenticated, logout } from '../../../api/auth.ts';
import { searchGame, searchGameSuggestions } from '../../../api/funcs.ts';

export const HomePage = () => {
  const [activeTab, setActiveTab] = useState('following');
  const [username, setUsername] = useState('Guest');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<Array<{id: number, name: string, price?: string}>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

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
    
    if (query.trim().length >= 2) {
      setSearchLoading(true);
      try {
        const results = await searchGameSuggestions({ query });
        // For demo purposes, we'll add random prices to the suggestions
        const resultsWithPrice = results.map(game => ({
          ...game,
          // Add a random price between 19-59 dollars
          price: `R$ ${(Math.floor(Math.random() * 40) + 19).toFixed(2)}`
        }));
        setSuggestions(resultsWithPrice);
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
            Game News
          </Box>
        </Box>
        
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
        </Box>

        <Box sx={{ p: 2 }}>
          <Box sx={{ position: 'relative' }}>
            <Paper
              sx={{
                p: '2px 4px',
                display: 'flex',
                alignItems: 'center',
                borderRadius: '30px',
                backgroundColor: '#172331',
                mb: 3,
                border: '1px solid #1e2c3c',
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
                placeholder="Search game posts"
                inputProps={{ 'aria-label': 'search games' }}
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
                  backgroundColor: '#171a21', // Darker background similar to Steam
                  border: '1px solid #2a475e', // Steam-like border color
                  borderRadius: '2px',
                  maxHeight: '400px',
                  overflowY: 'auto',
                  boxShadow: '0 0 12px rgba(0, 0, 0, 0.4)'
                }}
              >
                <List disablePadding>
                  {suggestions.map((game) => (
                    <ListItem 
                      key={game.id} 
                      onClick={() => handleSelectSuggestion(game.id)}
                      disablePadding
                      sx={{ 
                        '&:hover': { 
                          backgroundColor: 'rgba(37, 51, 65, 0.9)'
                        },
                        borderBottom: '1px solid #2a475e',
                        padding: 0,
                        cursor: 'pointer'
                      }}
                    >
                      <Box sx={{ 
                        display: 'flex',
                        width: '100%',
                        padding: '10px 15px',
                      }}>
                        {/* Game image placeholder */}
                        <Box
                          sx={{
                            width: '120px',
                            height: '45px',
                            backgroundColor: '#2a475e', 
                            borderRadius: '2px',
                            marginRight: '12px',
                            flexShrink: 0
                          }}
                        />
                        
                        <Box sx={{ 
                          display: 'flex', 
                          flexDirection: 'column',
                          justifyContent: 'center',
                          flex: 1
                        }}>
                          <Typography
                            sx={{ 
                              color: 'white',
                              fontSize: '14px',
                              fontWeight: 500
                            }}
                          >
                            {game.name}
                          </Typography>
                          
                          <Typography 
                            sx={{ 
                              color: '#acdbf5', 
                              fontSize: '13px',
                              fontWeight: 700,
                              marginTop: '4px'
                            }}
                          >
                            {game.price || 'R$ 29,99'}
                          </Typography>
                        </Box>
                      </Box>
                    </ListItem>
                  ))}
                </List>
              </Paper>
            )}
          </Box>
          <GameFeed />
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
      </Box>
    </Box>
  );
};

export default HomePage;