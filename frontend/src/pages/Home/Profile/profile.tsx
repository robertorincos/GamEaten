import { useState, useEffect } from 'react';
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
  Tabs,
  Tab,
  Button,
  useMediaQuery,
  useTheme,
  Drawer,
  AppBar,
  Toolbar,
  Menu,
  MenuItem,
  Fab,
  Card,
  CardMedia,
  CardContent,
  Chip
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
  faCalendarAlt,
  faEdit,
  faPencilAlt,
  faUserPlus,
  faUserMinus,
  faBars,
  faEllipsisV,
  faBookmark,
  faTrophy
} from '@fortawesome/free-solid-svg-icons';
import { getCurrentUser, isAuthenticated, logout } from '../../../api/auth';
import { searchGame, searchGameSuggestions, searchUsers, getReviews } from '../../../api/funcs';
import { ReviewDialog } from '../../../contexts/components/Review/review';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import PostCard from '../../../contexts/components/PostCard/PostCard.tsx';
import EditProfileDialog from '../../../contexts/components/EditProfile/EditProfileDialog';


interface Comment {
  id: number;
  id_game: number;
  username: string;
  user_id?: number;
  profile_photo?: string;
  comment: string;
  date_created: string;
  gif_url?: string;
  has_text: boolean;
  has_gif: boolean;
  likes_count?: number;
  user_has_liked?: boolean;
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
  review_count: number;
  is_following: boolean;
  is_own_profile: boolean;
  join_date?: string;
  profile_photo?: string;
}

interface GameResult {
  id: number;
  name: string;
}

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

const ProfilePage = () => {
  const { username: profileUsername } = useParams<{ username: string }>();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = useMediaQuery(theme.breakpoints.down('lg'));
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('Guest');
  const [activeTab, setActiveTab] = useState(0);
  const [userComments, setUserComments] = useState<Comment[]>([]);
  const [commentLoading, setCommentLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{id: number, name?: string, username?: string, type: 'game' | 'user', profile_photo?: string, cover_url?: string}>>([]);
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

  // Mobile-specific state
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);

  // Review dialog state
  const [openReviewDialog, setOpenReviewDialog] = useState(false);

  // Edit profile dialog state
  const [openEditProfileDialog, setOpenEditProfileDialog] = useState(false);

  // New state for game names
  const [gameNames, setGameNames] = useState<{ [id: number]: string }>({});

  // Add state for logged-in user
  const [currentUser, setCurrentUser] = useState<{ username: string, id: number, profile_photo?: string } | null>(null);

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

  // Add state for saved games
  const [savedGames, setSavedGames] = useState<SavedGame[]>([]);
  const [savedGamesLoading, setSavedGamesLoading] = useState(false);

  // Function to fetch saved games
  const fetchSavedGames = async (targetUsername?: string) => {
    try {
      setSavedGamesLoading(true);
      
      let url = '/api/saved-games';
      const headers: HeadersInit = {};
      
      if (targetUsername) {
        // Viewing another user's profile - use public endpoint
        url = `/api/saved-games/${targetUsername}`;
      } else {
        // Viewing own profile - use authenticated endpoint
        headers['Authorization'] = `Bearer ${localStorage.getItem('authToken')}`;
      }

      const response = await fetch(url, { headers });
      const data = await response.json();

      if (data.status === 'success') {
        setSavedGames(data.saved_games || []);
      } else {
        console.error('Failed to fetch saved games:', data.message);
        setSavedGames([]);
      }
    } catch (error) {
      console.error('Error fetching saved games:', error);
      setSavedGames([]);
    } finally {
      setSavedGamesLoading(false);
    }
  };

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
                setCurrentUser({ username: data.user.username, id: data.user.id, profile_photo: data.user.profile_photo });
                setCurrentUserStats({
                  totalReviews: data.user.review_count,
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
              review_count: currentUserStats.totalReviews,
              is_following: false,
              is_own_profile: true,
              join_date: currentUserStats.joinDate,
              profile_photo: currentUser.profile_photo
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
                totalReviews: data.user.review_count,
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

        // Fetch saved games for the user being viewed
        if (viewedUsername && isMounted) {
          await fetchSavedGames(profileUsername ? profileUsername : undefined);
        }

        // Fetch user's comments (for the profile being viewed)
        if (viewedUserId) {
          setCommentLoading(true);
          try {
            const commentsResponse = await getReviews({
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

  // Review dialog handlers
  const handleOpenReviewDialog = () => {
    if (!isAuthenticated()) {
      // Redirect to login if not authenticated
      navigate('/login');
      return;
    }
    setOpenReviewDialog(true);
  };

  const handleCloseReviewDialog = () => {
    setOpenReviewDialog(false);
  };

  // Edit profile dialog handlers
  const handleOpenEditProfileDialog = () => {
    setOpenEditProfileDialog(true);
  };

  const handleCloseEditProfileDialog = () => {
    setOpenEditProfileDialog(false);
  };

  const handleProfileUpdated = (updatedUser: any) => {
    setCurrentUser(updatedUser);
    // If we're viewing our own profile, update the displayed username
    if (isOwnProfile) {
      setUsername(updatedUser.username);
    }
  };

  // const formatDate = (dateString: string) => {
  //   try {
  //     return new Date(dateString).toLocaleDateString();
  //   } catch {
  //     return 'Recently';
  //   }
  // };

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

  // Add a function to handle tab navigation
  const handleNavigateToTab = (tabIndex: number) => {
    setActiveTab(tabIndex);
    if (tabIndex === 1) {
      navigate('/profile?tab=saved-games');
    } else {
      navigate('/profile');
    }
  };

  // Check URL parameters for tab navigation
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'saved-games') {
      setActiveTab(1);
    } else {
      setActiveTab(0);
    }
  }, [searchParams]);

  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: isMobile ? 'column' : 'row',
      justifyContent: 'center',
      minHeight: '100vh', 
      width: '100vw',
      overflowX: 'hidden',
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
              onClick={() => { navigate('/giveaways'); setMobileDrawerOpen(false); }}
              sx={{ 
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                '&:hover': { backgroundColor: 'rgba(29, 161, 242, 0.1)' }
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
            onClick={handleOpenReviewDialog}
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
        <MenuItem onClick={() => { navigate('/home'); setUserMenuAnchor(null); }}>
          <FontAwesomeIcon icon={faHome} style={{ marginRight: '10px' }} />
          Home
        </MenuItem>
        <MenuItem onClick={() => { logout(); navigate('/'); }}>
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
              className="nav-item"
              onClick={() => navigate('/giveaways')}
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
      )}

      {/* Middle Column - Profile Content */}
      <Box 
        sx={{ 
          width: isMobile ? '100%' : isTablet ? '500px' : '600px',
          borderRight: !isMobile && !isTablet ? '1px solid #1e2c3c' : 'none',
          minHeight: isMobile ? 'auto' : '100vh',
          overflowY: isMobile ? 'visible' : 'auto'
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
                height: isMobile ? '150px' : '200px', 
                position: 'relative', 
                overflow: 'hidden',
                backgroundColor: '#172331',
                backgroundImage: 'linear-gradient(135deg, #1da1f2 0%, #14171a 100%)'
              }} />

              {/* Profile Avatar */}
              <Box 
                sx={{ 
                  position: 'absolute', 
                  bottom: isMobile ? '-40px' : '-50px', 
                  left: isMobile ? '16px' : '20px',
                  border: '4px solid #0e1621',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  width: isMobile ? '80px' : '120px',
                  height: isMobile ? '80px' : '120px',
                  backgroundColor: '#172331'
                }}
              >
                <Avatar 
                  src={isOwnProfile ? currentUser?.profile_photo : userProfile?.profile_photo}
                  sx={{ 
                    width: '100%', 
                    height: '100%', 
                    fontSize: isMobile ? '32px' : '48px',
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
                    onClick={handleOpenEditProfileDialog}
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
                <Tab label="Saved Games" />
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
                        likesCount={comment.likes_count || 0}
                        userHasLiked={comment.user_has_liked || false}
                        profilePhoto={comment.profile_photo}
                        userId={comment.user_id}
                        onPostDeleted={() => {
                          // Refresh comments after deletion
                          setUserComments(prev => prev.filter(c => c.id !== comment.id));
                        }}
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

            {/* Saved Games Tab */}
            {activeTab === 1 && (
              <Box sx={{ p: 2 }}>
                {savedGamesLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                    <CircularProgress />
                  </Box>
                ) : savedGames.length > 0 ? (
                  <>
                    <Typography variant="body1" sx={{ color: '#8899a6', mb: 3 }}>
                      {savedGames.length} saved game{savedGames.length !== 1 ? 's' : ''}
                    </Typography>
                    <Box sx={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                      gap: 2
                    }}>
                      {savedGames.map((savedGame) => (
                        <Card
                          key={savedGame.id}
                          onClick={() => navigate(`/game/${savedGame.game_id}`)}
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
                              height: 240,
                              objectFit: 'cover',
                              backgroundColor: '#172331'
                            }}
                            image={savedGame.game_info.cover_url || '/placeholder-game.png'}
                            alt={savedGame.game_info.name}
                          />
                          <CardContent sx={{ p: 1.5 }}>
                            <Typography 
                              variant="subtitle2" 
                              sx={{ 
                                fontWeight: 600, 
                                mb: 1,
                                color: 'white',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                fontSize: '0.9rem'
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
                                  fontSize: '0.75rem',
                                  height: '20px'
                                }}
                              />
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </Box>
                  </>
                ) : (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <FontAwesomeIcon 
                      icon={faBookmark} 
                      size="3x" 
                      style={{ color: '#8899a6', marginBottom: '16px' }} 
                    />
                    <Typography variant="h6" sx={{ color: '#8899a6', mb: 1 }}>
                      {isOwnProfile ? 'No saved games yet' : `${username} hasn't saved any games yet`}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#8899a6', mb: 3 }}>
                      {isOwnProfile 
                        ? 'Start building your game collection by searching and adding games' 
                        : 'Check back later to see their game collection'
                      }
                    </Typography>
                    {isOwnProfile && (
                      <Button
                        variant="contained"
                        onClick={() => navigate('/saved-games')}
                        sx={{
                          backgroundColor: '#1da1f2',
                          '&:hover': { backgroundColor: '#1a91da' }
                        }}
                      >
                        <FontAwesomeIcon icon={faBookmark} style={{ marginRight: '8px' }} />
                        Add Your First Game
                      </Button>
                    )}
                  </Box>
                )}
              </Box>
            )}
          </>
        )}
      </Box>

      {/* Right Column - Stats & Search */}
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
                  color: 'white',
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

          {/* User Actions */}
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
                {currentUser?.username?.charAt(0).toUpperCase()}
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
              @{currentUser?.username?.toLowerCase()}
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
                onClick={() => handleNavigateToTab(1)}
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
      )}

      {/* Review Dialog */}
      <ReviewDialog 
        open={openReviewDialog} 
        onClose={handleCloseReviewDialog}
        onReviewSubmitted={() => {
          navigate('/');
        }}
      />

      {/* Edit Profile Dialog */}
      {currentUser && (
        <EditProfileDialog
          open={openEditProfileDialog}
          onClose={handleCloseEditProfileDialog}
          onProfileUpdated={handleProfileUpdated}
          currentUser={currentUser}
        />
      )}

      {/* Floating Action Button for Mobile */}
      {isMobile && (
        <Fab
          color="primary"
          onClick={() => setOpenReviewDialog(true)}
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

export default ProfilePage;