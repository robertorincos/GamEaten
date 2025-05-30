import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  Chip,
  Alert,
  Snackbar,
  Tooltip,
  LinearProgress,
  Skeleton,
  useMediaQuery,
  useTheme,
  Fade,
  Collapse
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faTimes, 
  faSearch, 
  faSave, 
  faTrash, 
  faGamepad,
  faImage,
  faKeyboard,
  faInfoCircle,
  faCheckCircle
} from '@fortawesome/free-solid-svg-icons';
import { searchGameSuggestions, createReview, searchGifs, getTrendingGifs } from '../../../api/funcs.ts';
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

interface ValidationErrors {
  game?: string;
  content?: string;
  general?: string;
}

interface DraftData {
  reviewGameId: number | null;
  reviewGameName: string;
  reviewText: string;
  selectedGif: GifData | null;
  timestamp: number;
}

const MAX_REVIEW_LENGTH = 500;
const DRAFT_STORAGE_KEY = 'review_draft';
const DRAFT_EXPIRY_HOURS = 24;

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`review-tabpanel-${index}`}
      aria-labelledby={`review-tab-${index}`}
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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Game selection state
  const [reviewGameId, setReviewGameId] = useState<number | null>(null);
  const [reviewGameName, setReviewGameName] = useState('');
  const [gameSearchResults, setGameSearchResults] = useState<Array<{id: number, name: string}>>([]);
  const [gameSearchQuery, setGameSearchQuery] = useState('');
  const [gameSearching, setGameSearching] = useState(false);
  const [gameSearchError, setGameSearchError] = useState<string | null>(null);

  // Content state  
  const [reviewText, setReviewText] = useState('');
  const [selectedGif, setSelectedGif] = useState<GifData | null>(null);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  
  // GIF search state
  const [gifSearchQuery, setGifSearchQuery] = useState('');
  const [gifs, setGifs] = useState<GifData[]>([]);
  const [trendingGifs, setTrendingGifs] = useState<GifData[]>([]);
  const [gifSearchLoading, setGifSearchLoading] = useState(false);
  const [gifSearchError, setGifSearchError] = useState<string | null>(null);
  const [gifTab, setGifTab] = useState(0); // 0 = search, 1 = trending
  
  // UI state
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showDraftIndicator, setShowDraftIndicator] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  
  const gameSearchTimeoutRef = useRef<number | null>(null);
  const gifSearchTimeoutRef = useRef<number | null>(null);
  const draftSaveTimeoutRef = useRef<number | null>(null);

  // Character count and validation
  const characterCount = reviewText.length;
  const isTextTooLong = characterCount > MAX_REVIEW_LENGTH;
  const remainingCharacters = MAX_REVIEW_LENGTH - characterCount;

  // Validation function
  const validateForm = useCallback((): ValidationErrors => {
    const errors: ValidationErrors = {};
    
    if (!reviewGameId) {
      errors.game = 'Please select a game to review';
    }
    
    if (!reviewText.trim() && !selectedGif) {
      errors.content = 'Please add some content to your review (text or GIF)';
    }
    
    if (isTextTooLong) {
      errors.content = `Review is too long. Please keep it under ${MAX_REVIEW_LENGTH} characters.`;
    }
    
    return errors;
  }, [reviewGameId, reviewText, selectedGif, isTextTooLong]);

  // Draft management
  const saveDraft = useCallback(() => {
    if (reviewText.trim() || selectedGif || reviewGameId) {
      const draftData: DraftData = {
        reviewGameId,
        reviewGameName,
        reviewText,
        selectedGif,
        timestamp: Date.now()
      };
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draftData));
      setShowDraftIndicator(true);
      setTimeout(() => setShowDraftIndicator(false), 2000);
    }
  }, [reviewGameId, reviewGameName, reviewText, selectedGif]);

  const loadDraft = useCallback(() => {
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const draft: DraftData = JSON.parse(saved);
        const now = Date.now();
        const hoursSinceCreated = (now - draft.timestamp) / (1000 * 60 * 60);
        
        if (hoursSinceCreated < DRAFT_EXPIRY_HOURS) {
          setReviewGameId(draft.reviewGameId);
          setReviewGameName(draft.reviewGameName);
          setReviewText(draft.reviewText);
          setSelectedGif(draft.selectedGif);
          setHasDraft(true);
          return true;
        } else {
          localStorage.removeItem(DRAFT_STORAGE_KEY);
        }
      }
    } catch (error) {
      console.error('Error loading draft:', error);
    }
    return false;
  }, []);

  const clearDraft = useCallback(() => {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    setHasDraft(false);
  }, []);

  // Auto-save draft
  useEffect(() => {
    if (draftSaveTimeoutRef.current) {
      clearTimeout(draftSaveTimeoutRef.current);
    }
    
    draftSaveTimeoutRef.current = window.setTimeout(() => {
      saveDraft();
    }, 2000);
    
    return () => {
      if (draftSaveTimeoutRef.current) {
        clearTimeout(draftSaveTimeoutRef.current);
      }
    };
  }, [saveDraft]);

  // Load trending GIFs when component mounts
  useEffect(() => {
    if (open && gifTab === 1 && trendingGifs.length === 0) {
      loadTrendingGifs();
    }
  }, [open, gifTab]);

  // Load draft when dialog opens
  useEffect(() => {
    if (open && !reviewText && !selectedGif && !reviewGameId) {
      loadDraft();
    }
  }, [open, loadDraft, reviewText, selectedGif, reviewGameId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!open) return;
      
      // Ctrl/Cmd + Enter to submit
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        const errors = validateForm();
        if (Object.keys(errors).length === 0) {
          handleSubmitReview();
        }
      }
      
      // Escape to close
      if (event.key === 'Escape') {
        event.preventDefault();
        handleClose();
      }
      
      // Ctrl/Cmd + S to save draft
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        saveDraft();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, validateForm, saveDraft]);

  const loadTrendingGifs = async () => {
    try {
      setGifSearchLoading(true);
      setGifSearchError(null);
      const response = await getTrendingGifs({ limit: 20 });
      setTrendingGifs(response.gifs);
    } catch (error) {
      console.error('Error loading trending GIFs:', error);
      setGifSearchError('Failed to load trending GIFs. Please try again.');
    } finally {
      setGifSearchLoading(false);
    }
  };

  const handleGameInputChange = async (_event: React.SyntheticEvent, value: string) => {
    setGameSearchQuery(value);
    setGameSearchError(null);
    
    if (gameSearchTimeoutRef.current) {
      clearTimeout(gameSearchTimeoutRef.current);
    }
    
    if (value.trim().length >= 2) {
      setGameSearching(true);
      gameSearchTimeoutRef.current = window.setTimeout(async () => {
        try {
          const suggestions = await searchGameSuggestions({ query: value.trim() });
          setGameSearchResults(suggestions);
          if (suggestions.length === 0) {
            setGameSearchError('No games found. Try a different search term.');
          }
        } catch (error) {
          console.error('Error fetching game suggestions:', error);
          setGameSearchError('Failed to search games. Please check your connection.');
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
      setValidationErrors(prev => ({ ...prev, game: undefined }));
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
      setGifSearchError(null);
      const response = await searchGifs({ 
        query: query.trim(), 
        limit: 20,
        rating: 'pg-13' 
      });
      setGifs(response.gifs);
      if (response.gifs.length === 0) {
        setGifSearchError('No GIFs found for this search. Try different keywords.');
      }
    } catch (error) {
      console.error('Error searching GIFs:', error);
      setGifSearchError('Failed to search GIFs. Please try again.');
      setGifs([]);
    } finally {
      setGifSearchLoading(false);
    }
  };

  const handleGifSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const query = event.target.value;
    setGifSearchQuery(query);
    setGifSearchError(null);
    
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
    setValidationErrors(prev => ({ ...prev, content: undefined }));
  };

  const handleTextChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const text = event.target.value;
    setReviewText(text);
    setValidationErrors(prev => ({ ...prev, content: undefined }));
  };

  const handleSubmitReview = async () => {
    const errors = validateForm();
    setValidationErrors(errors);
    
    if (Object.keys(errors).length > 0) {
      setErrorMessage('Please fix the errors above before submitting.');
      return;
    }
    
    try {
      setReviewSubmitting(true);
      setErrorMessage(null);
      
      // Create review data
      const reviewData: any = {
        id_game: reviewGameId,
      };

      if (reviewText.trim()) {
        reviewData.review_text = reviewText;
      }

      if (selectedGif) {
        reviewData.gif_url = selectedGif.images.original.url;
      }

      // Set comment type based on content
      if (reviewText.trim() && selectedGif) {
        reviewData.comment_type = 'mixed';
      } else if (selectedGif) {
        reviewData.comment_type = 'gif';
      } else {
        reviewData.comment_type = 'text';
      }

      await createReview(reviewData);
      
      setSuccessMessage('Review posted successfully!');
      clearDraft();
      
      // Delay closing to show success message
      setTimeout(() => {
        handleClose();
        onReviewSubmitted();
      }, 1500);
      
    } catch (error) {
      console.error('Error posting review:', error);
      setErrorMessage('Failed to post review. Please try again.');
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleClose = () => {
    // Clear all state
    setReviewGameId(null);
    setReviewGameName('');
    setReviewText('');
    setSelectedGif(null);
    setGameSearchQuery('');
    setGameSearchResults([]);
    setGifSearchQuery('');
    setGifs([]);
    setGifTab(0);
    setValidationErrors({});
    setErrorMessage(null);
    setSuccessMessage(null);
    setGameSearchError(null);
    setGifSearchError(null);
    setShowDraftIndicator(false);
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
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            <CircularProgress size={24} sx={{ color: '#1da1f2' }} />
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {[...Array(6)].map((_, index) => (
              <Skeleton
                key={index}
                variant="rectangular"
                width="calc(33.333% - 8px)"
                height={120}
                sx={{ 
                  backgroundColor: '#2a3441',
                  borderRadius: '8px'
                }}
              />
            ))}
          </Box>
        </Box>
      );
    }

    if (gifSearchError) {
      return (
        <Alert 
          severity="error" 
          sx={{ 
            backgroundColor: '#3d1a1a',
            color: '#ffcccb',
            border: '1px solid #5d2a2a',
            m: 2
          }}
        >
          {gifSearchError}
        </Alert>
      );
    }

    if (gifList.length === 0) {
      return (
        <Box sx={{ textAlign: 'center', p: 3 }}>
          <FontAwesomeIcon 
            icon={faImage} 
            style={{ 
              fontSize: '48px', 
              color: '#8899a6', 
              marginBottom: '16px' 
            }} 
          />
          <Typography sx={{ color: '#8899a6' }}>
            {gifTab === 0 ? 'Search for GIFs to get started' : 'No trending GIFs available'}
          </Typography>
        </Box>
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
          p: 1,
          '&::-webkit-scrollbar': {
            width: '8px',
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: '#1e2c3c',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: '#8899a6',
            borderRadius: '4px',
          },
        }}
      >
        {gifList.map((gif) => (
          <Tooltip key={gif.id} title={gif.title || 'Select this GIF'} arrow>
            <Box sx={{ flex: `0 0 calc(${isMobile ? '50%' : '33.333%'} - 8px)` }}>
              <Card
                sx={{
                  cursor: 'pointer',
                  backgroundColor: '#0e1621',
                  border: '2px solid transparent',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  '&:hover': {
                    transform: 'scale(1.03)',
                    transition: 'all 0.2s ease-in-out',
                    border: '2px solid #1da1f2',
                    boxShadow: '0 4px 20px rgba(29, 161, 242, 0.3)',
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
          </Tooltip>
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
      if (draftSaveTimeoutRef.current) {
        clearTimeout(draftSaveTimeoutRef.current);
      }
    };
  }, []);

  return (
    <>
      <Dialog 
        open={open} 
        onClose={handleClose}
        fullWidth
        maxWidth="md"
        fullScreen={isMobile}
        PaperProps={{
          sx: {
            backgroundColor: '#172331',
            color: 'white',
            border: '1px solid #1e2c3c',
            maxHeight: isMobile ? '100vh' : '90vh',
            borderRadius: isMobile ? 0 : '16px',
          }
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          borderBottom: '1px solid #1e2c3c',
          pb: 2,
          position: 'relative'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <FontAwesomeIcon icon={faGamepad} style={{ color: '#1da1f2' }} />
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              Create Review
            </Typography>
            {hasDraft && (
              <Chip 
                label="Draft loaded" 
                size="small"
                sx={{ 
                  backgroundColor: '#2d5a2d',
                  color: '#90ee90',
                  fontSize: '12px'
                }}
              />
            )}
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Fade in={showDraftIndicator}>
              <Tooltip title="Draft saved automatically">
                <IconButton size="small" sx={{ color: '#4caf50' }}>
                  <FontAwesomeIcon icon={faCheckCircle} />
                </IconButton>
              </Tooltip>
            </Fade>
            
            <Tooltip title="Keyboard shortcuts: Ctrl+Enter to submit, Ctrl+S to save draft">
              <IconButton size="small" sx={{ color: '#8899a6' }}>
                <FontAwesomeIcon icon={faKeyboard} />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Close">
              <IconButton onClick={handleClose} sx={{ color: 'white' }}>
                <FontAwesomeIcon icon={faTimes} />
              </IconButton>
            </Tooltip>
          </Box>
        </DialogTitle>
        
        <DialogContent sx={{ p: 3 }}>
          {/* Game Selection */}
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                Select Game
              </Typography>
              <Typography variant="caption" sx={{ color: '#8899a6' }}>
                *Required
              </Typography>
            </Box>
            
            <Autocomplete
              options={gameSearchResults}
              getOptionLabel={(option) => option.name}
              loading={gameSearching}
              onInputChange={handleGameInputChange}
              onChange={handleGameSelect}
              inputValue={gameSearchQuery}
              noOptionsText={
                gameSearchQuery.length < 2 
                  ? "Type at least 2 characters" 
                  : gameSearchError || "No games found"
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="Search for a game..."
                  variant="outlined"
                  error={!!validationErrors.game}
                  helperText={validationErrors.game}
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
                        '& fieldset': { 
                          borderColor: validationErrors.game ? '#f44336' : '#1e2c3c' 
                        },
                        '&:hover fieldset': { 
                          borderColor: validationErrors.game ? '#f44336' : '#1da1f2' 
                        },
                        '&.Mui-focused fieldset': { 
                          borderColor: validationErrors.game ? '#f44336' : '#1da1f2' 
                        }
                      }
                    }
                  }}
                  sx={{
                    '& .MuiInputLabel-root': { color: '#8899a6' },
                    '& .MuiInputBase-input': { color: 'white' },
                    '& .MuiFormHelperText-root': { 
                      color: validationErrors.game ? '#f44336' : '#8899a6' 
                    }
                  }}
                />
              )}
              sx={{
                '& .MuiAutocomplete-popupIndicator': { color: '#8899a6' },
                '& .MuiAutocomplete-clearIndicator': { color: '#8899a6' }
              }}
            />
            
            <Collapse in={!!reviewGameName}>
              <Box sx={{ mt: 2 }}>
                <Chip 
                  label={reviewGameName} 
                  onDelete={() => {
                    setReviewGameId(null);
                    setReviewGameName('');
                    setGameSearchQuery('');
                  }}
                  sx={{ 
                    backgroundColor: '#1da1f2', 
                    color: 'white',
                    '& .MuiChip-deleteIcon': {
                      color: 'white',
                      '&:hover': {
                        color: '#ccc'
                      }
                    }
                  }} 
                />
              </Box>
            </Collapse>
          </Box>

          {/* Content Creation */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 'bold' }}>
              Create Your Review
            </Typography>
            
            {/* Text Input */}
            <Box sx={{ mb: 3 }}>
              <TextField
                fullWidth
                multiline
                rows={4}
                placeholder="Share your thoughts about this game..."
                value={reviewText}
                onChange={handleTextChange}
                variant="outlined"
                error={!!validationErrors.content || isTextTooLong}
                helperText={
                  validationErrors.content || 
                  (isTextTooLong ? `${Math.abs(remainingCharacters)} characters over limit` : '')
                }
                InputProps={{
                  sx: {
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: '#0e1621',
                      '& fieldset': { 
                        borderColor: (validationErrors.content || isTextTooLong) ? '#f44336' : '#1e2c3c' 
                      },
                      '&:hover fieldset': { 
                        borderColor: (validationErrors.content || isTextTooLong) ? '#f44336' : '#1da1f2' 
                      },
                      '&.Mui-focused fieldset': { 
                        borderColor: (validationErrors.content || isTextTooLong) ? '#f44336' : '#1da1f2' 
                      }
                    }
                  }
                }}
                sx={{
                  '& .MuiInputLabel-root': { color: '#8899a6' },
                  '& .MuiInputBase-input': { color: 'white' },
                  '& .MuiFormHelperText-root': { 
                    color: (validationErrors.content || isTextTooLong) ? '#f44336' : '#8899a6' 
                  }
                }}
              />
              
              {/* Character Counter */}
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                mt: 1
              }}>
                <Typography variant="caption" sx={{ color: '#8899a6' }}>
                  <FontAwesomeIcon icon={faInfoCircle} style={{ marginRight: '4px' }} />
                  Pro tip: Use Ctrl+Enter to quickly submit your review
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: isTextTooLong ? '#f44336' : 
                             remainingCharacters < 50 ? '#ff9800' : '#8899a6'
                    }}
                  >
                    {characterCount}/{MAX_REVIEW_LENGTH}
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={(characterCount / MAX_REVIEW_LENGTH) * 100}
                    sx={{
                      width: 50,
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: '#1e2c3c',
                      '& .MuiLinearProgress-bar': {
                        backgroundColor: isTextTooLong ? '#f44336' : 
                                       remainingCharacters < 50 ? '#ff9800' : '#1da1f2',
                        borderRadius: 2,
                      }
                    }}
                  />
                </Box>
              </Box>
            </Box>

            {/* GIF Selection */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                Add a GIF (Optional)
              </Typography>
              
              {selectedGif ? (
                <Fade in={true}>
                  <Box sx={{ mb: 2 }}>
                    <Card sx={{ 
                      maxWidth: 300, 
                      backgroundColor: '#0e1621', 
                      mb: 2,
                      border: '2px solid #1da1f2',
                      borderRadius: '12px',
                      overflow: 'hidden'
                    }}>
                      <CardMedia
                        component="img"
                        image={selectedGif.images.fixed_height.url}
                        alt={selectedGif.title}
                        sx={{ maxHeight: 200, objectFit: 'contain' }}
                      />
                    </Card>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button 
                        onClick={() => setSelectedGif(null)} 
                        startIcon={<FontAwesomeIcon icon={faTrash} />}
                        sx={{ color: '#f44336' }}
                        size="small"
                      >
                        Remove GIF
                      </Button>
                      <Typography variant="caption" sx={{ 
                        color: '#8899a6',
                        alignSelf: 'center',
                        fontStyle: 'italic'
                      }}>
                        "{selectedGif.title}"
                      </Typography>
                    </Box>
                  </Box>
                </Fade>
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
                    <Tab 
                      label="Search GIFs" 
                      id="review-tab-0"
                      aria-controls="review-tabpanel-0"
                    />
                    <Tab 
                      label="Trending" 
                      id="review-tab-1"
                      aria-controls="review-tabpanel-1"
                    />
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
          justifyContent: 'space-between',
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? 2 : 0
        }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button 
              onClick={handleClose}
              sx={{ color: '#8899a6' }}
            >
              Cancel
            </Button>
            <Button
              onClick={saveDraft}
              startIcon={<FontAwesomeIcon icon={faSave} />}
              sx={{ color: '#8899a6' }}
              size="small"
            >
              Save Draft
            </Button>
          </Box>
          
          <Button
            onClick={handleSubmitReview}
            disabled={reviewSubmitting}
            variant="contained"
            size={isMobile ? 'large' : 'medium'}
            fullWidth={isMobile}
            sx={{
              backgroundColor: '#1da1f2',
              minWidth: 120,
              '&:hover': { backgroundColor: '#1a91da' },
              '&:disabled': { backgroundColor: '#1e2c3c', color: '#8899a6' }
            }}
          >
            {reviewSubmitting ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={20} sx={{ color: 'white' }} />
                <span>Posting...</span>
              </Box>
            ) : (
              'Post Review'
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success/Error Snackbars */}
      <Snackbar
        open={!!successMessage}
        autoHideDuration={4000}
        onClose={() => setSuccessMessage(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert 
          severity="success" 
          sx={{ 
            backgroundColor: '#2d5a2d',
            color: '#90ee90',
            '& .MuiAlert-icon': { color: '#90ee90' }
          }}
        >
          {successMessage}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!errorMessage}
        autoHideDuration={6000}
        onClose={() => setErrorMessage(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert 
          severity="error"
          sx={{ 
            backgroundColor: '#3d1a1a',
            color: '#ffcccb',
            '& .MuiAlert-icon': { color: '#ffcccb' }
          }}
        >
          {errorMessage}
        </Alert>
      </Snackbar>
    </>
  );
};

export default ReviewDialog;