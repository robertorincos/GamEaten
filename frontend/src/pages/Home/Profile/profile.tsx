import { useState, useEffect } from 'react';
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
  Button
} from '@mui/material';
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
  faCalendarAlt,
  faEdit,
  faPencilAlt,
  faUserPlus,
  faUserMinus
} from '@fortawesome/free-solid-svg-icons';
import { getCurrentUser, isAuthenticated, logout } from '../../../api/auth';
import { searchGame, searchGameSuggestions, getComments } from '../../../api/funcs';
import { ReviewDialog } from '../../../contexts/components/Review/review';
import { useParams } from 'react-router-dom';
import PostCard from '../../../contexts/components/PostCard/PostCard.tsx';


interface Comment {
  id: number;
  id_game: number;
  username: string;
  comment: string;
  date_created: string;
  gif_url?: string;
  has_text: boolean;
  has_gif: boolean;
}

interface UserStats {
  totalReviews: number;
  totalGames: number;
  followers: number;
  following: number;
  joinDate: string;
}

interface UserProfile {
  id: number;
  username: string;
  follower_count: number;
  following_count: number;
  comment_count: number;
  is_following: boolean;
  is_own_profile: boolean;
  join_date?: string;
}

interface GameResult {
  id: number;
  name: string;
}

const ProfilePage = () => {
  const { username: profileUsername } = useParams<{ username: string }>();
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('Guest');
  const [activeTab, setActiveTab] = useState(0);
  const [userComments, setUserComments] = useState<Comment[]>([]);
  const [commentLoading, setCommentLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{id: number, name: string}>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userStats, setUserStats] = useState<UserStats>({
    totalReviews: 0,
    totalGames: 0,
    followers: 0,
    following: 0,
    joinDate: ''
  });

  // Review dialog state
  const [openReviewDialog, setOpenReviewDialog] = useState(false);

  // New state for game names
  const [gameNames, setGameNames] = useState<{ [id: number]: string }>({});

  // Add state for logged-in user
  const [currentUser, setCurrentUser] = useState<{ username: string, id: number } | null>(null);

  // Add state for logged-in user's stats
  const [currentUserStats, setCurrentUserStats] = useState<UserStats>({
    totalReviews: 0,
    totalGames: 0,
    followers: 0,
    following: 0,
    joinDate: ''
  });

  // Add loading state for game names
  const [loadingGameNames, setLoadingGameNames] = useState(false);

  // Fetch current user data on mount
  useEffect(() => {
    const fetchCurrentUser = async () => {
      if (isAuthenticated()) {
        try {
          const userData = await getCurrentUser();
          if (userData && userData.status) {
            // Fetch user id and stats
            const response = await fetch(`/api/user/${userData.status}`, {
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
              }
            });
            if (response.ok) {
              const data = await response.json();
              if (data.status === 'success') {
                setCurrentUser({ username: data.user.username, id: data.user.id });
                setCurrentUserStats({
                  totalReviews: data.user.comment_count,
                  totalGames: 0,
                  followers: data.user.follower_count,
                  following: data.user.following_count,
                  joinDate: data.user.join_date || new Date().toISOString().split('T')[0]
                });
              }
            }
          }
        } catch (error) {
          console.error('Error fetching current user:', error);
        }
      }
    };
    fetchCurrentUser();
  }, []); // Only run once on mount

  // Fetch viewed user data and comments
  useEffect(() => {
    let isMounted = true;

    const fetchUserData = async () => {
      if (!isAuthenticated()) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        
        // Clear previous data
        setUserComments([]);
        setUserProfile(null);
        setUserStats({
          totalReviews: 0,
          totalGames: 0,
          followers: 0,
          following: 0,
          joinDate: ''
        });
        setGameNames({});
        
        let viewedUserId = null;
        let viewedUsername = null;
        
        if (!profileUsername) {
          // Viewing own profile - use currentUser data
          if (currentUser) {
            viewedUsername = currentUser.username;
            viewedUserId = currentUser.id;
            setIsOwnProfile(true);
            
            setUserProfile({
              id: currentUser.id,
              username: currentUser.username,
              follower_count: currentUserStats.followers,
              following_count: currentUserStats.following,
              comment_count: currentUserStats.totalReviews,
              is_following: false,
              is_own_profile: true,
              join_date: currentUserStats.joinDate
            });
            setUserStats(currentUserStats);
          }
        } else {
          // Viewing another user's profile
          viewedUsername = profileUsername;
          setIsOwnProfile(false);
          
          const response = await fetch(`/api/user/${profileUsername}`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.status === 'success') {
              setUserProfile(data.user);
              viewedUserId = data.user.id;
              setUserStats({
                totalReviews: data.user.comment_count,
                totalGames: 0,
                followers: data.user.follower_count,
                following: data.user.following_count,
                joinDate: data.user.join_date || new Date().toISOString().split('T')[0]
              });
              setIsFollowing(data.user.is_following);
            }
          }
        }

        // Set the username for display
        if (viewedUsername && isMounted) {
          setUsername(viewedUsername);
        }

        // Fetch user's comments (for the profile being viewed)
        if (viewedUserId) {
          setCommentLoading(true);
          try {
            const commentsResponse = await getComments({
              id_game: 0,
              busca: 'user',
              page: 1,
              size: 50,
              user_id: viewedUserId
            });

            if (commentsResponse && commentsResponse.comments && isMounted) {
              const sortedComments = commentsResponse.comments.sort((a: Comment, b: Comment) => 
                new Date(b.date_created).getTime() - new Date(a.date_created).getTime()
              );
              
              setUserComments(sortedComments);
              
              const uniqueGames = new Set(sortedComments.map((comment: Comment) => comment.id_game));
              setUserStats(prev => ({
                ...prev,
                totalReviews: sortedComments.length,
                totalGames: uniqueGames.size
              }));

              // Fetch game names for the comments
              const uniqueIds = Array.from(uniqueGames);
              const names: Record<number, string> = {};
              
              setLoadingGameNames(true);
              try {
                // Fetch all game names in parallel
                const gamePromises = uniqueIds.map(async (id) => {
                  if (!gameNames[id as keyof typeof gameNames]) {
                    try {
                      const res = await fetch(`/api/game?id=${id}`);
                      const data = await res.json();
                      if (Array.isArray(data) && data[0]?.name) {
                        return { id, name: data[0].name } as GameResult;
                      }
                    } catch (error) {
                      console.error(`Error fetching game name for id ${id}:`, error);
                    }
                  }
                  return null;
                });

                const results = await Promise.all(gamePromises);
                results.forEach(result => {
                  if (result && isMounted) {
                    names[result.id] = result.name;
                  }
                });

                if (Object.keys(names).length > 0 && isMounted) {
                  setGameNames(prev => ({ ...prev, ...names }));
                }
              } finally {
                if (isMounted) {
                  setLoadingGameNames(false);
                }
              }
            }
          } catch (error) {
            console.error('Error fetching comments:', error);
            if (isMounted) {
              setUserComments([]);
            }
          } finally {
            if (isMounted) {
              setCommentLoading(false);
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch user data:', error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchUserData();

    return () => {
      isMounted = false;
    };
  }, [profileUsername, currentUser, currentUserStats]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
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
  };

  (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return 'Recently';
    }
  };

  const handleFollow = async () => {
    if (!userProfile) return;

    try {
      const response = await fetch('/api/follow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({ username: userProfile.username })
      });

      if (response.ok) {
        const data = await response.json();
        setIsFollowing(data.is_following);
        setUserStats(prev => ({
          ...prev,
          followers: data.is_following ? prev.followers + 1 : prev.followers - 1
        }));
      }
    } catch (error) {
      console.error('Failed to follow/unfollow:', error);
    }
  };

  return (
    <Box sx={{ 
      display: 'flex', 
      justifyContent: 'center',
      minHeight: '100vh', 
      width: '100vw',
      overflowX: 'hidden',
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
            className="nav-item active"
            onClick={() => window.location.href = '/profile'}
            sx={{ cursor: 'pointer' }}
          >
            <span className="icon">
              <FontAwesomeIcon icon={faUser} />
            </span>
            Profile
          </Box>
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
      </Box>

      {/* Middle Column - Profile Content */}
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
        ) : (
          <>
            {/* Profile Header/Banner */}
            <Box sx={{ position: 'relative' }}>
              {/* Banner Image */}
              <Box sx={{ 
                width: '100%', 
                height: '200px', 
                position: 'relative', 
                overflow: 'hidden',
                backgroundColor: '#172331',
                backgroundImage: 'linear-gradient(135deg, #1da1f2 0%, #14171a 100%)'
              }} />

              {/* Profile Avatar */}
              <Box 
                sx={{ 
                  position: 'absolute', 
                  bottom: '-50px', 
                  left: '20px',
                  border: '4px solid #0e1621',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  width: '120px',
                  height: '120px',
                  backgroundColor: '#172331'
                }}
              >
                <Avatar 
                  sx={{ 
                    width: '100%', 
                    height: '100%', 
                    fontSize: '48px',
                    backgroundColor: '#1da1f2'
                  }}
                >
                  {username?.charAt(0).toUpperCase()}
                </Avatar>
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
                {isOwnProfile ? (
                  <Button 
                    variant="outlined" 
                    startIcon={<FontAwesomeIcon icon={faEdit} />}
                    sx={{ 
                      borderRadius: '30px', 
                      textTransform: 'none',
                      borderColor: '#1da1f2',
                      color: '#1da1f2',
                      '&:hover': {
                        borderColor: '#1a91da',
                        backgroundColor: 'rgba(29, 161, 242, 0.1)'
                      }
                    }}
                  >
                    Edit Profile
                  </Button>
                ) : (
                  <Button 
                    variant="contained" 
                    startIcon={<FontAwesomeIcon icon={isFollowing ? faUserMinus : faUserPlus} />}
                    onClick={handleFollow}
                    sx={{ 
                      borderRadius: '30px', 
                      textTransform: 'none',
                      backgroundColor: isFollowing ? '#e0245e' : '#1da1f2',
                      '&:hover': {
                        backgroundColor: isFollowing ? '#c01e4f' : '#1a91da'
                      }
                    }}
                  >
                    {isFollowing ? 'Unfollow' : 'Follow'}
                  </Button>
                )}
              </Box>
            </Box>

            {/* Profile Info */}
            <Box sx={{ pt: 7, px: 3, pb: 2 }}>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {username}
              </Typography>

              <Typography variant="body2" sx={{ color: '#8899a6', mt: 0.5 }}>
                @{username.toLowerCase()}
              </Typography>

              <Box sx={{ display: 'flex', alignItems: 'center', mt: 2, color: '#8899a6' }}>
                <FontAwesomeIcon icon={faCalendarAlt} style={{ marginRight: '8px' }} />
                <Typography variant="body2">
                  Joined {new Date(userStats.joinDate).toLocaleDateString()}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', gap: 3, mt: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    {userStats.following}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#8899a6' }}>
                    Following
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    {userStats.followers}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#8899a6' }}>
                    Followers
                  </Typography>
                </Box>
              </Box>
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
                <Tab label="Reviews" />
                <Tab label="Games" />
                <Tab label="Activity" />
              </Tabs>
            </Box>

            {/* Reviews Tab */}
            {activeTab === 0 && (
              <Box sx={{ p: 2 }}>
                {commentLoading || loadingGameNames ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                    <CircularProgress />
                  </Box>
                ) : userComments.length > 0 ? (
                  userComments.map((comment) => {
                    let commentType: 'text' | 'gif' | 'mixed' = 'text';
                    if (comment.has_text && comment.has_gif) {
                      commentType = 'mixed';
                    } else if (comment.has_gif) {
                      commentType = 'gif';
                    }

                    return (
                      <PostCard
                        key={comment.id}
                        id={comment.id}
                        username={comment.username}
                        text={comment.comment}
                        date={comment.date_created}
                        gameId={comment.id_game}
                        gameName={gameNames[comment.id_game] || 'Loading...'}
                        gifUrl={comment.gif_url}
                        commentType={commentType}
                      />
                    );
                  })
                ) : (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography variant="body1" sx={{ color: '#8899a6' }}>
                      No reviews yet. Start reviewing games!
                    </Typography>
                  </Box>
                )}
              </Box>
            )}

            {/* Games Tab */}
            {activeTab === 1 && (
              <Box sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="body1" sx={{ color: '#8899a6', py: 4 }}>
                  Games collection feature coming soon!
                </Typography>
              </Box>
            )}

            {/* Activity Tab */}
            {activeTab === 2 && (
              <Box sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="body1" sx={{ color: '#8899a6', py: 4 }}>
                  Activity feed feature coming soon!
                </Typography>
              </Box>
            )}
          </>
        )}
      </Box>

      {/* Right Column - Stats & Search */}
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
                color: 'white',
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

        {/* User Actions */}
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
              {currentUser?.username?.charAt(0).toUpperCase()}
            </Avatar>
            <Box sx={{ ml: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                {currentUser?.username}
              </Typography>
              <Typography variant="body2" sx={{ color: '#8899a6' }}>
                @{currentUser?.username?.toLowerCase()}
              </Typography>
            </Box>
          </Box>
          
          <Box sx={{ display: 'flex', gap: 1 }}>
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

        {/* Profile Stats */}
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
            {isOwnProfile ? 'Your Stats' : `${username}'s Stats`}
          </Typography>
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" sx={{ color: '#8899a6' }}>
              Reviews
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
              {userStats.totalReviews}
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" sx={{ color: '#8899a6' }}>
              Games Reviewed
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
              {userStats.totalGames}
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" sx={{ color: '#8899a6' }}>
              Following
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
              {userStats.following}
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" sx={{ color: '#8899a6' }}>
              Followers
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
              {userStats.followers}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Review Dialog */}
      <ReviewDialog 
        open={openReviewDialog} 
        onClose={handleCloseReviewDialog}
        onReviewSubmitted={() => {
          window.location.reload();
        }}
      />
    </Box>
  );
};

export default ProfilePage;