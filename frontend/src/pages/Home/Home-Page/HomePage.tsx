import { Box, Typography, Avatar, IconButton, Paper, Badge, InputBase } from '@mui/material';
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
  faUser
} from '@fortawesome/free-solid-svg-icons';
import { getCurrentUser, isAuthenticated, logout } from '../../../api/auth.ts';

export const HomePage = () => {
  const [activeTab, setActiveTab] = useState('following');
  const [username, setUsername] = useState('Guest');
  const [loading, setLoading] = useState(true);

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
            <IconButton sx={{ p: '10px', color: '#8899a6' }}>
              <FontAwesomeIcon icon={faSearch} />
            </IconButton>
            <InputBase
              sx={{ ml: 1, flex: 1, color: 'white' }}
              placeholder="Search game posts"
              inputProps={{ 'aria-label': 'search games' }}
            />
          </Paper>
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
          <IconButton sx={{ p: '10px', color: '#8899a6' }}>
            <FontAwesomeIcon icon={faSearch} />
          </IconButton>
          <InputBase
            sx={{ ml: 1, flex: 1, color: 'white' }}
            placeholder="Search GamEaten"
            inputProps={{ 'aria-label': 'search' }}
          />
        </Paper>

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
              <Box key={item} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Avatar sx={{ width: 40, height: 40, mr: 2 }} />
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Gamer #{item}</Typography>
                    <Typography variant="body2" sx={{ color: '#8899a6' }}>@gamer{item}</Typography>
                  </Box>
                </Box>
                <Box 
                  sx={{ 
                    backgroundColor: 'white', 
                    color: 'black', 
                    borderRadius: '30px', 
                    px: 2, 
                    py: 1, 
                    fontWeight: 700,
                    fontSize: '0.8rem', 
                    cursor: 'pointer' 
                  }}
                >
                  Follow
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