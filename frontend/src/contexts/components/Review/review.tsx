import React, { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Autocomplete,
  Box,
  Typography,
  IconButton,
  Tabs,
  Tab,
  Card,
  CardMedia,
  CircularProgress,
  InputAdornment,
  Chip
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faSearch } from '@fortawesome/free-solid-svg-icons';
import { searchGameSuggestions, createComment, searchGifs, getTrendingGifs } from '../../../api/funcs.ts';
import { GifData } from '../../../api/funcs.ts';

interface ReviewDialogProps {
  open: boolean;
  onClose: () => void;
  onReviewSubmitted: () => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 2 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

export const ReviewDialog: React.FC<ReviewDialogProps> = ({ 
  open, 
  onClose, 
  onReviewSubmitted 
}) => {
  // Game selection state
  const [reviewGameId, setReviewGameId] = useState<number | null>(null);
  const [reviewGameName, setReviewGameName] = useState('');
  const [gameSearchResults, setGameSearchResults] = useState<Array<{id: number, name: string}>>([]);
  const [gameSearchQuery, setGameSearchQuery] = useState('');
  const [gameSearching, setGameSearching] = useState(false);
    // Content state  
  const [reviewText, setReviewText] = useState('');
  const [selectedGif, setSelectedGif] = useState<GifData | null>(null);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  
  // GIF search state
  const [gifSearchQuery, setGifSearchQuery] = useState('');
  const [gifs, setGifs] = useState<GifData[]>([]);
  const [trendingGifs, setTrendingGifs] = useState<GifData[]>([]);
  const [gifSearchLoading, setGifSearchLoading] = useState(false);
  const [gifTab, setGifTab] = useState(0); // 0 = search, 1 = trending
  
  const gameSearchTimeoutRef = useRef<number | null>(null);
  const gifSearchTimeoutRef = useRef<number | null>(null);
  // Load trending GIFs when component mounts
  useEffect(() => {
    if (open && gifTab === 1) {
      loadTrendingGifs();
    }
  }, [open, gifTab]);

  const loadTrendingGifs = async () => {
    try {
      setGifSearchLoading(true);
      const response = await getTrendingGifs({ limit: 20 });
      setTrendingGifs(response.gifs);
    } catch (error) {
      console.error('Error loading trending GIFs:', error);
    } finally {
      setGifSearchLoading(false);
    }
  };
  const handleGameInputChange = async (_event: React.SyntheticEvent, value: string) => {
    setGameSearchQuery(value);
    
    if (gameSearchTimeoutRef.current) {
      clearTimeout(gameSearchTimeoutRef.current);
    }
    
    if (value.trim().length >= 2) {
      setGameSearching(true);
      gameSearchTimeoutRef.current = window.setTimeout(async () => {
        try {
          const suggestions = await searchGameSuggestions({ query: value.trim() });
          setGameSearchResults(suggestions);
        } catch (error) {
          console.error('Error fetching game suggestions:', error);
          setGameSearchResults([]);
        } finally {
          setGameSearching(false);
        }
      }, 500);
    } else {
      setGameSearchResults([]);
      setGameSearching(false);
    }
  };

  const handleGameSelect = (_event: React.SyntheticEvent, value: { id: number; name: string } | null) => {
    if (value) {
      setReviewGameId(value.id);
      setReviewGameName(value.name);
    } else {
      setReviewGameId(null);
      setReviewGameName('');
    }
  };

  const handleGifSearch = async (query: string) => {
    if (!query.trim()) {
      setGifs([]);
      return;
    }
    
    try {
      setGifSearchLoading(true);
      const response = await searchGifs({ 
        query: query.trim(), 
        limit: 20,
        rating: 'pg-13' 
      });
      setGifs(response.gifs);
    } catch (error) {
      console.error('Error searching GIFs:', error);
      setGifs([]);
    } finally {
      setGifSearchLoading(false);
    }
  };

  const handleGifSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const query = event.target.value;
    setGifSearchQuery(query);
    
    if (gifSearchTimeoutRef.current) {
      clearTimeout(gifSearchTimeoutRef.current);
    }
    
    if (query.trim().length >= 2) {
      gifSearchTimeoutRef.current = window.setTimeout(() => {
        handleGifSearch(query);
      }, 500);
    } else {
      setGifs([]);
    }
  };

  const handleGifSelect = (gif: GifData) => {
    setSelectedGif(gif);
  };
  const handleSubmitReview = async () => {
    if (!reviewGameId) {
      alert('Please select a game to review');
      return;
    }

    // Allow mixed content - at least one of text or GIF must be present
    if (!reviewText.trim() && !selectedGif) {
      alert('Please enter review text or select a GIF');
      return;
    }
    
    try {
      setReviewSubmitting(true);
      
      // Create mixed content comment
      const commentData: any = {
        id_game: reviewGameId,
      };

      if (reviewText.trim()) {
        commentData.comment = reviewText;
      }

      if (selectedGif) {
        commentData.gif_url = selectedGif.images.original.url;
      }

      // Set comment type based on content
      if (reviewText.trim() && selectedGif) {
        commentData.comment_type = 'mixed';
      } else if (selectedGif) {
        commentData.comment_type = 'gif';
      } else {
        commentData.comment_type = 'text';
      }

      await createComment(commentData);
      
      handleClose();
      onReviewSubmitted();
    } catch (error) {
      console.error('Error posting review:', error);
      alert('Failed to post review. Please try again.');
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleClose = () => {
    setReviewGameId(null);
    setReviewGameName('');
    setReviewText('');
    setSelectedGif(null);
    setGameSearchQuery('');
    setGameSearchResults([]);
    setGifSearchQuery('');
    setGifs([]);
    setGifTab(0);
    onClose();
  };
  const handleGifTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setGifTab(newValue);
    if (newValue === 1 && trendingGifs.length === 0) {
      loadTrendingGifs();
    }
  };
  const renderGifGrid = (gifList: GifData[]) => {
    if (gifSearchLoading) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      );
    }

    if (gifList.length === 0) {
      return (
        <Typography sx={{ textAlign: 'center', color: '#8899a6', p: 3 }}>
          {gifTab === 0 ? 'Search for GIFs to get started' : 'No trending GIFs available'}
        </Typography>
      );
    }

    return (
      <Box 
        sx={{ 
          display: 'flex',
          flexWrap: 'wrap',
          gap: 1,
          maxHeight: 300, 
          overflowY: 'auto',
          p: 1
        }}
      >
        {gifList.map((gif) => (
          <Box key={gif.id} sx={{ flex: '0 0 calc(33.333% - 8px)' }}>
            <Card
              sx={{
                cursor: 'pointer',
                backgroundColor: '#0e1621',
                '&:hover': {
                  transform: 'scale(1.05)',
                  transition: 'transform 0.2s'
                }
              }}
              onClick={() => handleGifSelect(gif)}
            >
              <CardMedia
                component="img"
                image={gif.images.fixed_height.url}
                alt={gif.title}
                sx={{
                  height: 120,
                  objectFit: 'cover'
                }}
              />
            </Card>
          </Box>
        ))}
      </Box>
    );
  };

  // Cleanup timeouts
  useEffect(() => {
    return () => {
      if (gameSearchTimeoutRef.current) {
        clearTimeout(gameSearchTimeoutRef.current);
      }
      if (gifSearchTimeoutRef.current) {
        clearTimeout(gifSearchTimeoutRef.current);
      }
    };
  }, []);

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      fullWidth
      maxWidth="md"
      PaperProps={{
        sx: {
          backgroundColor: '#172331',
          color: 'white',
          border: '1px solid #1e2c3c',
          maxHeight: '80vh'
        }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        borderBottom: '1px solid #1e2c3c',
        pb: 2
      }}>
        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
          Create Review
        </Typography>
        <IconButton onClick={handleClose} sx={{ color: 'white' }}>
          <FontAwesomeIcon icon={faTimes} />
        </IconButton>
      </DialogTitle>
      
      <DialogContent sx={{ p: 3 }}>
        {/* Game Selection */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>
            Select Game
          </Typography>
          <Autocomplete
            options={gameSearchResults}
            getOptionLabel={(option) => option.name}
            loading={gameSearching}
            onInputChange={handleGameInputChange}
            onChange={handleGameSelect}
            inputValue={gameSearchQuery}
            noOptionsText={gameSearchQuery.length < 2 ? "Type at least 2 characters" : "No games found"}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder="Search for a game..."
                variant="outlined"
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {gameSearching ? <CircularProgress color="inherit" size={20} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                  sx: {
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: '#0e1621',
                      '& fieldset': { borderColor: '#1e2c3c' },
                      '&:hover fieldset': { borderColor: '#1da1f2' },
                      '&.Mui-focused fieldset': { borderColor: '#1da1f2' }
                    }
                  }
                }}
                sx={{
                  '& .MuiInputLabel-root': { color: '#8899a6' },
                  '& .MuiInputBase-input': { color: 'white' }
                }}
              />
            )}
            sx={{
              '& .MuiAutocomplete-popupIndicator': { color: '#8899a6' },
              '& .MuiAutocomplete-clearIndicator': { color: '#8899a6' }
            }}
          />
          {reviewGameName && (
            <Chip 
              label={reviewGameName} 
              sx={{ 
                mt: 1, 
                backgroundColor: '#1da1f2', 
                color: 'white' 
              }} 
            />
          )}
        </Box>        {/* Content Creation */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 'bold' }}>
            Create Your Review
          </Typography>
          
          {/* Text Input */}
          <TextField
            fullWidth
            multiline
            rows={4}
            placeholder="Share your thoughts about this game..."
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            variant="outlined"
            InputProps={{
              sx: {
                '& .MuiOutlinedInput-root': {
                  backgroundColor: '#0e1621',
                  '& fieldset': { borderColor: '#1e2c3c' },
                  '&:hover fieldset': { borderColor: '#1da1f2' },
                  '&.Mui-focused fieldset': { borderColor: '#1da1f2' }
                }
              }
            }}
            sx={{
              mb: 2,
              '& .MuiInputLabel-root': { color: '#8899a6' },
              '& .MuiInputBase-input': { color: 'white' }
            }}
          />

          {/* GIF Selection */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
              Add a GIF (Optional)
            </Typography>
            
            {selectedGif ? (
              <Box sx={{ mb: 2 }}>
                <Card sx={{ maxWidth: 300, backgroundColor: '#0e1621', mb: 1 }}>
                  <CardMedia
                    component="img"
                    image={selectedGif.images.fixed_height.url}
                    alt={selectedGif.title}
                    sx={{ maxHeight: 200, objectFit: 'contain' }}
                  />
                </Card>
                <Button 
                  onClick={() => setSelectedGif(null)} 
                  sx={{ color: '#1da1f2' }}
                  size="small"
                >
                  Remove GIF
                </Button>
              </Box>
            ) : (
              <Box>
                {/* GIF Search Tabs */}
                <Tabs
                  value={gifTab}
                  onChange={handleGifTabChange}
                  sx={{
                    mb: 2,
                    '& .MuiTabs-indicator': { backgroundColor: '#1da1f2' },
                    '& .MuiTab-root': { 
                      color: '#8899a6',
                      '&.Mui-selected': { color: '#1da1f2' }
                    }
                  }}
                >
                  <Tab label="Search GIFs" />
                  <Tab label="Trending" />
                </Tabs>

                {/* Search Tab */}
                <TabPanel value={gifTab} index={0}>
                  <TextField
                    fullWidth
                    placeholder="Search for GIFs..."
                    value={gifSearchQuery}
                    onChange={handleGifSearchChange}
                    variant="outlined"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <FontAwesomeIcon icon={faSearch} style={{ color: '#8899a6' }} />
                        </InputAdornment>
                      ),
                      sx: {
                        '& .MuiOutlinedInput-root': {
                          backgroundColor: '#0e1621',
                          '& fieldset': { borderColor: '#1e2c3c' },
                          '&:hover fieldset': { borderColor: '#1da1f2' },
                          '&.Mui-focused fieldset': { borderColor: '#1da1f2' }
                        }
                      }
                    }}
                    sx={{
                      mb: 2,
                      '& .MuiInputLabel-root': { color: '#8899a6' },
                      '& .MuiInputBase-input': { color: 'white' }
                    }}
                  />
                  {renderGifGrid(gifs)}
                </TabPanel>

                {/* Trending Tab */}
                <TabPanel value={gifTab} index={1}>
                  {renderGifGrid(trendingGifs)}
                </TabPanel>
              </Box>
            )}
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ 
        p: 3, 
        borderTop: '1px solid #1e2c3c',
        justifyContent: 'space-between'
      }}>
        <Button 
          onClick={handleClose}
          sx={{ color: '#8899a6' }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmitReview}
          disabled={
            !reviewGameId || 
            reviewSubmitting || 
            (!reviewText.trim() && !selectedGif)
          }
          variant="contained"
          sx={{
            backgroundColor: '#1da1f2',
            '&:hover': { backgroundColor: '#1a91da' },
            '&:disabled': { backgroundColor: '#1e2c3c', color: '#8899a6' }
          }}
        >
          {reviewSubmitting ? <CircularProgress size={20} /> : 'Post Review'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ReviewDialog;