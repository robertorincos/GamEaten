import { Card, CardContent, CardHeader, IconButton, Typography, Box, Avatar, Divider, TextField, Button, Collapse, Dialog, DialogTitle, DialogContent, DialogActions, useMediaQuery, useTheme, Menu, MenuItem } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHeart, faComment, faEllipsisH, faGamepad, faReply, faRetweet, faTrash } from '@fortawesome/free-solid-svg-icons';
import { useState, useEffect } from 'react';
import { parseISO, formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { getReviewComments, createComment, likeUnlikeReview, repostUnrepostReview, deleteReview } from '../../../api/funcs';
import { getCurrentUser } from '../../../api/auth';

interface Comment {
  comment_id: number;
  review_id: number;
  parent_id?: number;
  username: string;
  comment: string;
  gif_url?: string;
  date_created: string;
}

interface PostCardProps {
  id: number;
  username: string;
  text: string;
  date: string;
  gameId: number;
  gameName: string;
  gifUrl?: string;
  commentType?: 'text' | 'gif' | 'mixed';
  commentCount?: number;
  likesCount?: number;
  userHasLiked?: boolean;
  repostsCount?: number;
  userHasReposted?: boolean;
  profilePhoto?: string;
  userId?: number;
  onPostDeleted?: () => void;
}

const PostCard = ({ 
  id, 
  username, 
  text, 
  date, 
  gameId, 
  gameName, 
  gifUrl, 
  commentCount = 0,
  likesCount = 0,
  userHasLiked = false,
  repostsCount = 0,
  userHasReposted = false,
  profilePhoto,
  userId,
  onPostDeleted
}: PostCardProps) => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  useMediaQuery('(max-width:480px)');
  
  const [liked, setLiked] = useState(userHasLiked);
  const [likeCount, setLikeCount] = useState(likesCount);
  const [reposted, setReposted] = useState(userHasReposted);
  const [repostCount, setRepostCount] = useState(repostsCount);
  const [comments, setComments] = useState<Comment[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [actualCommentCount, setActualCommentCount] = useState(commentCount);
  const [repostText, setRepostText] = useState('');
  const [showRepostDialog, setShowRepostDialog] = useState(false);
  
  // Menu state for 3-dot menu
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Check if current user is the owner of this post
  const isOwner = currentUserId !== null && userId !== undefined && currentUserId === userId;

  // Get current user on component mount
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const user = await getCurrentUser();
        if (user && user.status) {
          // Make additional API call to get user ID like other components do
          const response = await fetch(`/api/user/${user.status}`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            }
          });
          if (response.ok) {
            const data = await response.json();
            if (data.status === 'success' && data.user && data.user.id) {
              setCurrentUserId(data.user.id);
            }
          }
        }
      } catch (error) {
        console.error('Failed to get current user:', error);
      }
    };
    
    fetchCurrentUser();
  }, []);
  
  // Format date
  const formatDate = (dateString: string) => {
    try {
      const parsedDate = parseISO(dateString);
      const timeAgo = formatDistanceToNow(parsedDate, { addSuffix: false });
      return timeAgo;
    } catch (error) {
      return 'recently';
    }
  };
  const fetchComments = async () => {
    setLoadingComments(true);
    try {
      const response = await getReviewComments(id);
      if (response && response.comments) {
        setComments(response.comments);
        setActualCommentCount(response.comments.length);
      }
    } catch (error) {
      console.error('Failed to fetch comments:', error);
    } finally {
      setLoadingComments(false);
    }
  };
  const handleCommentSubmit = async (parentId?: number) => {
    if (!newComment.trim()) return;
    
    try {
      await createComment({
        review_id: id,
        parent_id: parentId,
        comment: newComment.trim(),
        comment_type: 'text'
      });
      
      setNewComment('');
      setReplyingTo(null);
      // Update comment count immediately
      setActualCommentCount(prev => prev + 1);
      fetchComments(); // Refresh comments
    } catch (error) {
      console.error('Failed to create comment:', error);
    }
  };
  const handleCommentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!showComments) {
      setShowComments(true);
      fetchComments();
    } else {
      setShowComments(false);
    }
  };
  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const response = await likeUnlikeReview(id);
      setLiked(response.liked);
      setLikeCount(response.like_count);
    } catch (error) {
      console.error('Failed to like/unlike review:', error);
      // Revert optimistic update on error
      setLiked(!liked);
      setLikeCount(liked ? likeCount + 1 : likeCount - 1);
    }
  };

  const handleRepost = async (withText: boolean = false) => {
    try {
      const response = await repostUnrepostReview(id, withText ? repostText.trim() : undefined);
      setReposted(response.reposted);
      setRepostCount(response.repost_count);
      
      if (withText) {
        setRepostText('');
        setShowRepostDialog(false);
      }
    } catch (error) {
      console.error('Failed to repost/unrepost review:', error);
      // Revert optimistic update on error
      setReposted(!reposted);
      setRepostCount(reposted ? repostCount + 1 : repostCount - 1);
    }
  };

  const handleQuickRepost = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (reposted) {
      // If already reposted, unrepost
      handleRepost(false);
    } else {
      // Show dialog for repost options
      setShowRepostDialog(true);
    }
  };

  const handleGoToGame = () => {
    window.location.href = `/game/${gameId}`;
  };
  const handleUserClick = () => {
    navigate(`/user/${username}`);
  };

  // Menu handlers for 3-dot menu
  const handleMenuOpen = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    setMenuAnchor(e.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  const handleDeleteClick = () => {
    handleMenuClose();
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (isDeleting) return;
    
    setIsDeleting(true);
    try {
      await deleteReview(id);
      setDeleteDialogOpen(false);
      
      // Call the callback to notify parent component
      if (onPostDeleted) {
        onPostDeleted();
      }
    } catch (error) {
      console.error('Failed to delete review:', error);
      // You might want to show an error message here
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
  };

  const renderComment = (comment: Comment, isReply = false) => (
    <Box 
      key={comment.comment_id} 
      sx={{ 
        pl: isReply ? (isMobile ? 2 : 3) : 0, 
        mb: 1, 
        borderLeft: isReply ? '2px solid #1e2c3c' : 'none' 
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        <Avatar sx={{ 
          width: isMobile ? 28 : 32, 
          height: isMobile ? 28 : 32, 
          bgcolor: '#1da1f2', 
          fontSize: isMobile ? '12px' : '14px' 
        }}>
          {comment.username.charAt(0).toUpperCase()}
        </Avatar>
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="body2" sx={{ 
              fontWeight: 600,
              fontSize: isMobile ? '12px' : '14px'
            }}>
              {comment.username}
            </Typography>
            <Typography variant="caption" sx={{ 
              color: '#8899a6',
              fontSize: isMobile ? '11px' : '12px'
            }}>
              {formatDate(comment.date_created)}
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ 
            mt: 0.5, 
            mb: 1,
            fontSize: isMobile ? '13px' : '14px',
            lineHeight: 1.4,
            wordBreak: 'break-word'
          }}>
            {comment.comment}
          </Typography>
          {comment.gif_url && (
            <Box sx={{ mb: 1 }}>
              <img
                src={comment.gif_url}
                alt="Comment GIF"
                style={{
                  maxWidth: isMobile ? '150px' : '200px',
                  maxHeight: isMobile ? '100px' : '150px',
                  borderRadius: isMobile ? '6px' : '8px',
                  objectFit: 'contain'
                }}
              />
            </Box>
          )}
          <IconButton 
            size="small" 
            sx={{ 
              color: '#8899a6', 
              p: isMobile ? 1 : 0.5,
              minHeight: isMobile ? '44px' : 'auto',
              minWidth: isMobile ? '44px' : 'auto'
            }}
            onClick={() => setReplyingTo(replyingTo === comment.comment_id ? null : comment.comment_id)}
          >
            <FontAwesomeIcon icon={faReply} size={isMobile ? 'sm' : 'xs'} />
            <Typography variant="caption" sx={{ 
              ml: 0.5,
              fontSize: isMobile ? '11px' : '12px'
            }}>
              Reply
            </Typography>
          </IconButton>
          
          {replyingTo === comment.comment_id && (
            <Box sx={{ mt: 1 }}>
              <TextField
                multiline
                rows={isMobile ? 2 : 2}
                fullWidth
                placeholder={`Reply to ${comment.username}...`}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: '#1e2c3c',
                    color: 'white',
                    fontSize: isMobile ? '13px' : '14px',
                    '& fieldset': { borderColor: '#1e2c3c' },
                    '&:hover fieldset': { borderColor: '#1da1f2' },
                    '&.Mui-focused fieldset': { borderColor: '#1da1f2' }
                  }
                }}
              />
              <Box sx={{ 
                display: 'flex', 
                gap: 1, 
                mt: 1,
                flexDirection: isMobile ? 'column' : 'row'
              }}>
                <Button 
                  size="small" 
                  variant="contained" 
                  sx={{ 
                    bgcolor: '#1da1f2',
                    minHeight: isMobile ? '44px' : 'auto',
                    fontSize: isMobile ? '13px' : '12px'
                  }}
                  onClick={() => handleCommentSubmit(comment.comment_id)}
                >
                  Reply
                </Button>
                <Button 
                  size="small" 
                  variant="text" 
                  sx={{ 
                    color: '#8899a6',
                    minHeight: isMobile ? '44px' : 'auto',
                    fontSize: isMobile ? '13px' : '12px'
                  }}
                  onClick={() => setReplyingTo(null)}
                >
                  Cancel
                </Button>
              </Box>
            </Box>
          )}
        </Box>
      </Box>
      
      {/* Render nested replies */}
      {comments
        .filter(reply => reply.parent_id === comment.comment_id)
        .map(reply => renderComment(reply, true))
      }
    </Box>
  );  return (
    <Card sx={{ 
      borderRadius: isMobile ? '8px' : '16px', 
      backgroundColor: '#172331', 
      color: 'white',
      boxShadow: 'none',
      mb: isMobile ? 1 : 2,
      border: '1px solid #1e2c3c',
      transition: 'all 0.2s ease',
      width: '100%'
    }}>
      <Box>
        <CardHeader
          avatar={
            <Avatar 
              src={profilePhoto || undefined}
              sx={{ 
                width: isMobile ? 40 : 48, 
                height: isMobile ? 40 : 48, 
                bgcolor: '#1da1f2',
                fontSize: isMobile ? '16px' : '20px'
              }}
            >
              {username.charAt(0).toUpperCase()}
            </Avatar>
          }
          action={
            isOwner ? (
              <IconButton 
                onClick={handleMenuOpen}
                sx={{ 
                  color: '#8899a6',
                  minWidth: isMobile ? '44px' : 'auto',
                  minHeight: isMobile ? '44px' : 'auto'
                }}
              >
                <FontAwesomeIcon icon={faEllipsisH} />
              </IconButton>
            ) : null
          }
          title={
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center',
              flexWrap: isMobile ? 'wrap' : 'nowrap',
              gap: isMobile ? 0.5 : 1
            }}>
              <Typography 
                variant="subtitle1" 
                sx={{ 
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontSize: isMobile ? '14px' : '16px',
                  '&:hover': { textDecoration: 'underline' }
                }}
                onClick={handleUserClick}
              >
                {username}
              </Typography>
              <Typography 
                variant="body2" 
                sx={{ 
                  ml: 1, 
                  color: '#8899a6',
                  fontSize: isMobile ? '12px' : '14px'
                }}
              >
                @{username.toLowerCase()}
              </Typography>
              <Typography 
                variant="body2" 
                sx={{ 
                  ml: 1, 
                  color: '#8899a6',
                  fontSize: isMobile ? '12px' : '14px'
                }}
              >
                · {formatDate(date)}
              </Typography>
            </Box>
          }
          subheader={
            <Typography 
              variant="body2" 
              sx={{ 
                color: '#8899a6', 
                mt: 0.5, 
                cursor: 'pointer',
                fontSize: isMobile ? '12px' : '14px',
                '&:hover': { textDecoration: 'underline' }
              }}
              onClick={handleGoToGame}
            >
              <FontAwesomeIcon icon={faGamepad} style={{ marginRight: '5px' }} />
              {gameName}
            </Typography>
          }
          sx={{
            px: isMobile ? 2 : 3,
            py: isMobile ? 1.5 : 2,
            '& .MuiCardHeader-title': { display: 'block' },
            '& .MuiCardHeader-subheader': { color: '#8899a6' }
          }}
        />
        
        <CardContent sx={{ 
          pt: 0, 
          px: isMobile ? 2 : 3,
          pb: isMobile ? 1.5 : 2
        }}>
          {/* Display text content if available */}
          {text && (
            <Typography 
              variant="body1" 
              sx={{ 
                mb: gifUrl ? 2 : 2, 
                lineHeight: 1.5, 
                whiteSpace: 'pre-line',
                fontSize: isMobile ? '14px' : '16px',
                wordBreak: 'break-word'
              }}
            >
              {text}
            </Typography>
          )}
          
          {/* Display GIF if available */}
          {gifUrl && (
            <Box sx={{ mb: 2 }}>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'center',
                  backgroundColor: '#1e2c3c',
                  borderRadius: isMobile ? '8px' : '16px',
                  p: 1,
                  cursor: 'pointer'
                }}
                onClick={handleGoToGame}
              >
                <img
                  src={gifUrl}
                  alt={text || 'GIF Review'}
                  style={{
                    maxWidth: '100%',
                    maxHeight: isMobile ? '200px' : '300px',
                    borderRadius: isMobile ? '6px' : '12px',
                    objectFit: 'contain'
                  }}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </Box>
            </Box>
          )}
          
          <Divider sx={{ borderColor: '#1e2c3c', my: isMobile ? 0.5 : 1 }} />
          
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between', 
            pt: isMobile ? 0.5 : 1,
            gap: isMobile ? 1 : 2
          }}>
            <Box 
              sx={{ 
                display: 'flex',
                alignItems: 'center',
                color: liked ? '#f91880' : '#8899a6', 
                '&:hover': { color: '#f91880' },
                cursor: 'pointer',
                minHeight: isMobile ? '44px' : 'auto',
                minWidth: isMobile ? '44px' : 'auto',
                p: isMobile ? 0.5 : 0,
                borderRadius: isMobile ? '8px' : '0',
                '&:active': isMobile ? { backgroundColor: 'rgba(249, 24, 128, 0.1)' } : {}
              }}
              onClick={handleLike}
            >
              <FontAwesomeIcon icon={faHeart} size={isMobile ? 'lg' : undefined} />
              <Typography 
                variant="body2" 
                fontSize={isMobile ? "14px" : "13px"} 
                sx={{ ml: 1 }}
              >
                {likeCount}
              </Typography>
            </Box>
            
            <Box 
              sx={{ 
                display: 'flex',
                alignItems: 'center',
                color: showComments ? '#1da1f2' : '#8899a6', 
                '&:hover': { color: '#1da1f2' },
                cursor: 'pointer',
                position: 'relative',
                minHeight: isMobile ? '44px' : 'auto',
                minWidth: isMobile ? '44px' : 'auto',
                p: isMobile ? 0.5 : 0,
                borderRadius: isMobile ? '8px' : '0',
                '&:active': isMobile ? { backgroundColor: 'rgba(29, 161, 242, 0.1)' } : {}
              }}
              onClick={handleCommentClick}
            >
              <FontAwesomeIcon icon={faComment} size={isMobile ? 'lg' : undefined} />
              <Typography 
                variant="body2" 
                fontSize={isMobile ? "14px" : "13px"} 
                sx={{ ml: 1 }}
              >
                {showComments ? (isMobile ? 'Hide' : 'Hide Comments') : `${actualCommentCount} ${isMobile && actualCommentCount > 0 ? '' : 'Comments'}`}
              </Typography>
            </Box>
            
            <Box 
              sx={{ 
                display: 'flex',
                alignItems: 'center',
                color: reposted ? '#00ba7c' : '#8899a6', 
                '&:hover': { color: '#00ba7c' },
                cursor: 'pointer',
                minHeight: isMobile ? '44px' : 'auto',
                minWidth: isMobile ? '44px' : 'auto',
                p: isMobile ? 0.5 : 0,
                borderRadius: isMobile ? '8px' : '0',
                '&:active': isMobile ? { backgroundColor: 'rgba(0, 186, 124, 0.1)' } : {}
              }}
              onClick={handleQuickRepost}
            >
              <FontAwesomeIcon icon={faRetweet} size={isMobile ? 'lg' : undefined} />
              <Typography 
                variant="body2" 
                fontSize={isMobile ? "14px" : "13px"} 
                sx={{ ml: 1 }}
              >
                {repostCount}
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Box>
        
      {/* Comments section */}
      <Collapse in={showComments}>
        <Box sx={{ 
          p: isMobile ? 2 : 2, 
          pt: 0, 
          borderTop: '1px solid #1e2c3c' 
        }}>
          {/* Add new comment */}
          <Box sx={{ mb: 2 }}>
            <TextField
              multiline
              rows={isMobile ? 2 : 3}
              fullWidth
              placeholder="Write a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: '#1e2c3c',
                  color: 'white',
                  fontSize: isMobile ? '14px' : '16px',
                  '& fieldset': { borderColor: '#1e2c3c' },
                  '&:hover fieldset': { borderColor: '#1da1f2' },
                  '&.Mui-focused fieldset': { borderColor: '#1da1f2' }
                }
              }}
            />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
              <Button 
                variant="contained" 
                sx={{ 
                  bgcolor: '#1da1f2',
                  minHeight: isMobile ? '44px' : 'auto',
                  px: isMobile ? 3 : 2,
                  fontSize: isMobile ? '14px' : '13px'
                }}
                onClick={() => handleCommentSubmit()}
                disabled={!newComment.trim()}
              >
                Comment
              </Button>
            </Box>
          </Box>
          
          {/* Display comments */}
          {loadingComments ? (
            <Typography 
              variant="body2" 
              sx={{ 
                color: '#8899a6', 
                textAlign: 'center', 
                py: 2,
                fontSize: isMobile ? '14px' : '16px'
              }}
            >
              Loading comments...
            </Typography>
          ) : comments.length === 0 ? (
            <Typography 
              variant="body2" 
              sx={{ 
                color: '#8899a6', 
                textAlign: 'center', 
                py: 2,
                fontSize: isMobile ? '14px' : '16px'
              }}
            >
              No comments yet. Be the first to comment!
            </Typography>
          ) : (
            <Box sx={{ 
              maxHeight: isMobile ? '300px' : '400px', 
              overflowY: 'auto' 
            }}>
              {comments
                .filter(comment => !comment.parent_id)
                .map(comment => renderComment(comment))
              }
            </Box>
          )}
        </Box>
      </Collapse>
      
      {/* Repost Dialog */}
      <Dialog 
        open={showRepostDialog} 
        onClose={() => setShowRepostDialog(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
        PaperProps={{
          sx: {
            backgroundColor: '#172331',
            color: 'white',
            border: '1px solid #1e2c3c',
            margin: isMobile ? 0 : 2,
            borderRadius: isMobile ? 0 : '12px'
          }
        }}
      >
        <DialogTitle sx={{ 
          color: 'white', 
          borderBottom: '1px solid #1e2c3c',
          fontSize: isMobile ? '18px' : '20px',
          px: isMobile ? 2 : 3
        }}>
          Repost Review
        </DialogTitle>
        <DialogContent sx={{ 
          pt: 2,
          px: isMobile ? 2 : 3
        }}>
          <TextField
            multiline
            rows={isMobile ? 2 : 3}
            fullWidth
            placeholder="Add a comment to your repost (optional)..."
            value={repostText}
            onChange={(e) => setRepostText(e.target.value)}
            sx={{
              mb: 2,
              '& .MuiOutlinedInput-root': {
                backgroundColor: '#1e2c3c',
                color: 'white',
                fontSize: isMobile ? '14px' : '16px',
                '& fieldset': { borderColor: '#1e2c3c' },
                '&:hover fieldset': { borderColor: '#1da1f2' },
                '&.Mui-focused fieldset': { borderColor: '#1da1f2' }
              }
            }}
          />
          
          {/* Preview of the original review */}
          <Box sx={{ 
            p: isMobile ? 1.5 : 2, 
            backgroundColor: '#1e2c3c', 
            borderRadius: isMobile ? '8px' : '12px',
            border: '1px solid #2f3336'
          }}>
            <Typography 
              variant="body2" 
              sx={{ 
                color: '#8899a6', 
                mb: 1,
                fontSize: isMobile ? '12px' : '14px'
              }}
            >
              Reposting from @{username}
            </Typography>
            <Typography 
              variant="body2" 
              sx={{ 
                color: 'white',
                fontSize: isMobile ? '14px' : '16px',
                wordBreak: 'break-word'
              }}
            >
              {text}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ 
          borderTop: '1px solid #1e2c3c', 
          p: isMobile ? 2 : 2,
          gap: isMobile ? 1 : 0,
          flexDirection: isMobile ? 'column' : 'row'
        }}>
          <Button 
            onClick={() => setShowRepostDialog(false)}
            sx={{ 
              color: '#8899a6',
              minHeight: isMobile ? '44px' : 'auto',
              width: isMobile ? '100%' : 'auto',
              order: isMobile ? 3 : 0
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={() => handleRepost(false)}
            sx={{ 
              color: '#1da1f2', 
              mr: isMobile ? 0 : 1,
              minHeight: isMobile ? '44px' : 'auto',
              width: isMobile ? '100%' : 'auto',
              order: isMobile ? 2 : 0
            }}
          >
            Repost
          </Button>
          <Button 
            onClick={() => handleRepost(true)}
            variant="contained"
            sx={{ 
              bgcolor: '#1da1f2',
              minHeight: isMobile ? '44px' : 'auto',
              width: isMobile ? '100%' : 'auto',
              order: isMobile ? 1 : 0
            }}
            disabled={!repostText.trim()}
          >
            Repost with Comment
          </Button>
        </DialogActions>
      </Dialog>

      {/* 3-dot Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
        PaperProps={{
          sx: {
            backgroundColor: '#172331',
            border: '1px solid #1e2c3c',
            borderRadius: '12px',
            minWidth: 150
          }
        }}
      >
        <MenuItem 
          onClick={handleDeleteClick}
          sx={{ 
            color: '#f44336',
            '&:hover': { 
              backgroundColor: 'rgba(244, 67, 54, 0.1)' 
            },
            fontSize: isMobile ? '14px' : '16px',
            py: isMobile ? 1.5 : 1
          }}
        >
          <FontAwesomeIcon 
            icon={faTrash} 
            style={{ marginRight: '12px' }} 
          />
          Delete Review
        </MenuItem>
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        maxWidth="sm"
        fullWidth={!isMobile}
        fullScreen={isMobile}
        PaperProps={{
          sx: {
            backgroundColor: '#172331',
            color: 'white',
            border: '1px solid #1e2c3c',
            borderRadius: isMobile ? 0 : '12px'
          }
        }}
      >
        <DialogTitle sx={{ 
          color: 'white',
          borderBottom: '1px solid #1e2c3c',
          fontSize: isMobile ? '18px' : '20px'
        }}>
          Delete Review
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography sx={{ 
            color: 'white',
            fontSize: isMobile ? '14px' : '16px'
          }}>
            Are you sure you want to delete this review? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ 
          borderTop: '1px solid #1e2c3c',
          gap: isMobile ? 1 : 0,
          flexDirection: isMobile ? 'column' : 'row',
          p: isMobile ? 2 : 2
        }}>
          <Button 
            onClick={handleDeleteCancel}
            disabled={isDeleting}
            sx={{ 
              color: '#8899a6',
              minHeight: isMobile ? '44px' : 'auto',
              width: isMobile ? '100%' : 'auto'
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleDeleteConfirm}
            disabled={isDeleting}
            variant="contained"
            sx={{ 
              bgcolor: '#f44336',
              minHeight: isMobile ? '44px' : 'auto',
              width: isMobile ? '100%' : 'auto',
              '&:hover': { bgcolor: '#d32f2f' },
              '&:disabled': { bgcolor: '#666', color: '#999' }
            }}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
};

export default PostCard;