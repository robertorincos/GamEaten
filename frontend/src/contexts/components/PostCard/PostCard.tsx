import { Card, CardContent, CardHeader, IconButton, Typography, Box, Avatar, Divider, TextField, Button, Collapse } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHeart, faComment, faShare, faEllipsisH, faGamepad, faReply } from '@fortawesome/free-solid-svg-icons';
import { useState } from 'react';
import { parseISO, formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { getReviewComments, createComment, likeUnlikeReview } from '../../../api/funcs';

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
  isHighlighted?: boolean;
  onReviewClick?: () => void;
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
  isHighlighted = false,
  onReviewClick 
}: PostCardProps) => {
  const navigate = useNavigate();
  const [liked, setLiked] = useState(userHasLiked);
  const [likeCount, setLikeCount] = useState(likesCount);
  const [comments, setComments] = useState<Comment[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [actualCommentCount, setActualCommentCount] = useState(commentCount);
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
  const handleReviewClick = () => {
    if (onReviewClick) {
      onReviewClick();
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

  const handleGoToGame = () => {
    window.location.href = `/game/${gameId}`;
  };
  const handleUserClick = () => {
    navigate(`/user/${username}`);
  };

  const renderComment = (comment: Comment, isReply = false) => (
    <Box 
      key={comment.comment_id} 
      sx={{ 
        pl: isReply ? 3 : 0, 
        mb: 1, 
        borderLeft: isReply ? '2px solid #1e2c3c' : 'none' 
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        <Avatar sx={{ width: 32, height: 32, bgcolor: '#1da1f2', fontSize: '14px' }}>
          {comment.username.charAt(0).toUpperCase()}
        </Avatar>
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {comment.username}
            </Typography>
            <Typography variant="caption" sx={{ color: '#8899a6' }}>
              {formatDate(comment.date_created)}
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ mt: 0.5, mb: 1 }}>
            {comment.comment}
          </Typography>
          {comment.gif_url && (
            <Box sx={{ mb: 1 }}>
              <img
                src={comment.gif_url}
                alt="Comment GIF"
                style={{
                  maxWidth: '200px',
                  maxHeight: '150px',
                  borderRadius: '8px',
                  objectFit: 'contain'
                }}
              />
            </Box>
          )}
          <IconButton 
            size="small" 
            sx={{ color: '#8899a6', p: 0.5 }}
            onClick={() => setReplyingTo(replyingTo === comment.comment_id ? null : comment.comment_id)}
          >
            <FontAwesomeIcon icon={faReply} size="xs" />
            <Typography variant="caption" sx={{ ml: 0.5 }}>Reply</Typography>
          </IconButton>
          
          {replyingTo === comment.comment_id && (
            <Box sx={{ mt: 1 }}>
              <TextField
                multiline
                rows={2}
                fullWidth
                placeholder={`Reply to ${comment.username}...`}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: '#1e2c3c',
                    color: 'white',
                    fontSize: '14px',
                    '& fieldset': { borderColor: '#1e2c3c' },
                    '&:hover fieldset': { borderColor: '#1da1f2' },
                    '&.Mui-focused fieldset': { borderColor: '#1da1f2' }
                  }
                }}
              />
              <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                <Button 
                  size="small" 
                  variant="contained" 
                  sx={{ bgcolor: '#1da1f2' }}
                  onClick={() => handleCommentSubmit(comment.comment_id)}
                >
                  Reply
                </Button>
                <Button 
                  size="small" 
                  variant="text" 
                  sx={{ color: '#8899a6' }}
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
      borderRadius: '16px', 
      backgroundColor: isHighlighted ? '#1e2c3c' : '#172331', 
      color: 'white',
      boxShadow: 'none',
      mb: 2,
      border: isHighlighted ? '2px solid #1da1f2' : '1px solid #1e2c3c',
      transition: 'all 0.2s ease'
    }}>
      <Box onClick={handleReviewClick} sx={{ cursor: 'pointer' }}>
        <CardHeader
          avatar={
            <Avatar sx={{ width: 48, height: 48, bgcolor: '#1da1f2' }}>
              {username.charAt(0).toUpperCase()}
            </Avatar>
          }
          action={
            <IconButton sx={{ color: '#8899a6' }}>
              <FontAwesomeIcon icon={faEllipsisH} />
            </IconButton>
          }
          title={
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography 
                variant="subtitle1" 
                sx={{ 
                  fontWeight: 700,
                  cursor: 'pointer',
                  '&:hover': { textDecoration: 'underline' }
                }}
                onClick={handleUserClick}
              >
                {username}
              </Typography>
              <Typography variant="body2" sx={{ ml: 1, color: '#8899a6' }}>@{username.toLowerCase()}</Typography>
              <Typography variant="body2" sx={{ ml: 1, color: '#8899a6' }}>· {formatDate(date)}</Typography>
            </Box>
          }
          subheader={
            <Typography 
              variant="body2" 
              sx={{ 
                color: '#8899a6', 
                mt: 0.5, 
                cursor: 'pointer',
                '&:hover': { textDecoration: 'underline' }
              }}
              onClick={handleGoToGame}
            >
              <FontAwesomeIcon icon={faGamepad} style={{ marginRight: '5px' }} />
              {gameName}
            </Typography>
          }
          sx={{
            '& .MuiCardHeader-title': { display: 'block' },
            '& .MuiCardHeader-subheader': { color: '#8899a6' }
          }}
        />
        
        <CardContent sx={{ pt: 0 }}>
          {/* Display text content if available */}
          {text && (
            <Typography variant="body1" sx={{ mb: gifUrl ? 2 : 2, lineHeight: 1.5, whiteSpace: 'pre-line' }}>
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
                  borderRadius: '16px',
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
                    maxHeight: '300px',
                    borderRadius: '12px',
                    objectFit: 'contain'
                  }}
                  onError={(e) => {
                    // Hide broken GIF images
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </Box>
            </Box>
          )}
          
          <Divider sx={{ borderColor: '#1e2c3c', my: 1 }} />
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 1 }}>            <Box 
              sx={{ 
                display: 'flex',
                alignItems: 'center',
                color: liked ? '#f91880' : '#8899a6', 
                '&:hover': { color: '#f91880' },
                cursor: 'pointer'
              }}
              onClick={handleLike}
            >
              <FontAwesomeIcon icon={faHeart} />
              <Typography variant="body2" fontSize="13px" sx={{ ml: 1 }}>{likeCount}</Typography>
            </Box>
              <Box 
              sx={{ 
                display: 'flex',
                alignItems: 'center',
                color: showComments ? '#1da1f2' : '#8899a6', 
                '&:hover': { color: '#1da1f2' },
                cursor: 'pointer',
                position: 'relative'
              }}
              onClick={handleCommentClick}
            >
              <FontAwesomeIcon icon={faComment} />              <Typography variant="body2" fontSize="13px" sx={{ ml: 1 }}>
                {showComments ? 'Hide Comments' : `${actualCommentCount} Comments`}
              </Typography>
            </Box>
            
            <Box sx={{ 
              display: 'flex',
              alignItems: 'center',
              color: '#8899a6', 
              '&:hover': { color: '#00ba7c' },
              cursor: 'pointer'
            }}>
              <FontAwesomeIcon icon={faShare} />
              <Typography variant="body2" fontSize="13px" sx={{ ml: 1 }}>Share</Typography>
            </Box>
          </Box>
        </CardContent>
      </Box>
        {/* Comments section */}
      <Collapse in={showComments}>
        <Box sx={{ p: 2, pt: 0, borderTop: '1px solid #1e2c3c' }}>
          {/* Add new comment */}
          <Box sx={{ mb: 2 }}>
            <TextField
              multiline
              rows={3}
              fullWidth
              placeholder="Write a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: '#1e2c3c',
                  color: 'white',
                  '& fieldset': { borderColor: '#1e2c3c' },
                  '&:hover fieldset': { borderColor: '#1da1f2' },
                  '&.Mui-focused fieldset': { borderColor: '#1da1f2' }
                }
              }}
            />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
              <Button 
                variant="contained" 
                sx={{ bgcolor: '#1da1f2' }}
                onClick={() => handleCommentSubmit()}
                disabled={!newComment.trim()}
              >
                Comment
              </Button>
            </Box>
          </Box>
          
          {/* Display comments */}
          {loadingComments ? (
            <Typography variant="body2" sx={{ color: '#8899a6', textAlign: 'center', py: 2 }}>
              Loading comments...
            </Typography>
          ) : comments.length === 0 ? (
            <Typography variant="body2" sx={{ color: '#8899a6', textAlign: 'center', py: 2 }}>
              No comments yet. Be the first to comment!
            </Typography>
          ) : (
            <Box sx={{ maxHeight: '400px', overflowY: 'auto' }}>
              {comments
                .filter(comment => !comment.parent_id) // Only show top-level comments
                .map(comment => renderComment(comment))
              }
            </Box>
          )}
        </Box>
      </Collapse>
    </Card>
  );
};

export default PostCard;