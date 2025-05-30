import React, { useState, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Avatar,
  IconButton,
  Typography,
  CircularProgress,
  Alert,
  useTheme,
  useMediaQuery
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCamera, faX, faCheck } from '@fortawesome/free-solid-svg-icons';

interface EditProfileDialogProps {
  open: boolean;
  onClose: () => void;
  onProfileUpdated: (updatedUser: any) => void;
  currentUser: {
    id: number;
    username: string;
    profile_photo?: string;
  };
}

const EditProfileDialog: React.FC<EditProfileDialogProps> = ({
  open,
  onClose,
  onProfileUpdated,
  currentUser
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const [username, setUsername] = useState(currentUser.username || '');
  const [profilePhoto] = useState<string | null>(currentUser.profile_photo || null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        setError('Please select a valid image file (JPEG, PNG, GIF, or WEBP)');
        return;
      }

      // Validate file size (10MB to match backend)
      if (file.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB');
        return;
      }

      setSelectedFile(file);
      setError(null);

      // Create preview URL
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewUrl(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemovePhoto = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadPhoto = async (): Promise<string | null> => {
    if (!selectedFile) return null;

    const formData = new FormData();
    formData.append('file', selectedFile);

    const response = await fetch('/api/profile/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
      },
      body: formData
    });

    const data = await response.json();
    
    if (response.ok && data.status === 'success') {
      return data.photo_url;
    } else {
      throw new Error(data.message || 'Failed to upload photo');
    }
  };

  const updateProfile = async () => {
    if (username.trim() === currentUser.username && !selectedFile) {
      setError('No changes to save');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      let photoUrl = profilePhoto;

      // Upload photo if selected
      if (selectedFile) {
        photoUrl = await uploadPhoto();
      }

      // Update profile information
      if (username.trim() !== currentUser.username) {
        const response = await fetch('/api/profile/update', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          },
          body: JSON.stringify({
            username: username.trim()
          })
        });

        const data = await response.json();
        
        if (!response.ok || data.status !== 'success') {
          throw new Error(data.message || 'Failed to update profile');
        }
      }

      setSuccess('Profile updated successfully!');
      
      // Call the callback with updated user data
      onProfileUpdated({
        ...currentUser,
        username: username.trim(),
        profile_photo: photoUrl
      });

      // Close dialog after a short delay
      setTimeout(() => {
        onClose();
      }, 1500);

    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setUsername(currentUser.username || '');
      setSelectedFile(null);
      setPreviewUrl(null);
      setError(null);
      setSuccess(null);
      onClose();
    }
  };

  const getCurrentPhotoUrl = () => {
    if (previewUrl) return previewUrl;
    if (profilePhoto) return profilePhoto;
    return null;
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      fullScreen={isMobile}
      PaperProps={{
        sx: {
          backgroundColor: '#172331',
          color: 'white',
          border: '1px solid #1e2c3c',
          borderRadius: isMobile ? 0 : '15px'
        }
      }}
    >
      <DialogTitle sx={{ 
        borderBottom: '1px solid #1e2c3c',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        p: 3
      }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Edit Profile
        </Typography>
        {isMobile && (
          <IconButton onClick={handleClose} sx={{ color: 'white' }}>
            <FontAwesomeIcon icon={faX} />
          </IconButton>
        )}
      </DialogTitle>

      <DialogContent sx={{ p: 3 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2, backgroundColor: '#2c1810', color: '#ff6b6b' }}>
            {error}
          </Alert>
        )}
        
        {success && (
          <Alert severity="success" sx={{ mb: 2, backgroundColor: '#1a3421', color: '#51cf66' }}>
            {success}
          </Alert>
        )}

        {/* Profile Photo Section */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 4 }}>
          <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
            Profile Photo
          </Typography>
          
          <Box sx={{ position: 'relative', mb: 2 }}>
            <Avatar
              src={getCurrentPhotoUrl() || undefined}
              sx={{
                width: 120,
                height: 120,
                fontSize: '48px',
                backgroundColor: '#1da1f2',
                cursor: 'pointer',
                border: '3px solid #1e2c3c'
              }}
              onClick={handlePhotoClick}
            >
              {!getCurrentPhotoUrl() && currentUser.username?.charAt(0).toUpperCase()}
            </Avatar>
            
            <IconButton
              onClick={handlePhotoClick}
              sx={{
                position: 'absolute',
                bottom: -8,
                right: -8,
                backgroundColor: '#1da1f2',
                color: 'white',
                '&:hover': {
                  backgroundColor: '#1a91da'
                },
                width: 40,
                height: 40
              }}
            >
              <FontAwesomeIcon icon={faCamera} size="sm" />
            </IconButton>
          </Box>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
            style={{ display: 'none' }}
          />

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Button
              variant="outlined"
              size="small"
              onClick={handlePhotoClick}
              sx={{
                borderColor: '#1da1f2',
                color: '#1da1f2',
                '&:hover': {
                  borderColor: '#1a91da',
                  backgroundColor: 'rgba(29, 161, 242, 0.1)'
                }
              }}
            >
              Choose Photo
            </Button>
            
            {(previewUrl || selectedFile) && (
              <Button
                variant="outlined"
                size="small"
                onClick={handleRemovePhoto}
                sx={{
                  borderColor: '#e0245e',
                  color: '#e0245e',
                  '&:hover': {
                    borderColor: '#c01e4f',
                    backgroundColor: 'rgba(224, 36, 94, 0.1)'
                  }
                }}
              >
                Remove
              </Button>
            )}
          </Box>
        </Box>

        {/* Username Section */}
        <Box>
          <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
            Username
          </Typography>
          
          <TextField
            fullWidth
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter username"
            variant="outlined"
            inputProps={{
              maxLength: 20,
              minLength: 3
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: '#0e1621',
                color: 'white',
                '& fieldset': {
                  borderColor: '#1e2c3c'
                },
                '&:hover fieldset': {
                  borderColor: '#1da1f2'
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#1da1f2'
                }
              },
              '& .MuiInputLabel-root': {
                color: '#8899a6'
              }
            }}
          />
          
          <Typography variant="caption" sx={{ color: '#8899a6', mt: 1, display: 'block' }}>
            3-20 characters, letters, numbers and underscores only
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 3, borderTop: '1px solid #1e2c3c' }}>
        <Button
          onClick={handleClose}
          disabled={loading}
          sx={{
            color: '#8899a6',
            '&:hover': {
              backgroundColor: 'rgba(136, 153, 166, 0.1)'
            }
          }}
        >
          Cancel
        </Button>
        
        <Button
          onClick={updateProfile}
          disabled={loading || (!selectedFile && username.trim() === currentUser.username)}
          variant="contained"
          sx={{
            backgroundColor: '#1da1f2',
            '&:hover': {
              backgroundColor: '#1a91da'
            },
            '&:disabled': {
              backgroundColor: '#1e2c3c',
              color: '#8899a6'
            },
            minWidth: 100
          }}
        >
          {loading ? (
            <CircularProgress size={20} sx={{ color: 'white' }} />
          ) : (
            <>
              <FontAwesomeIcon icon={faCheck} style={{ marginRight: '8px' }} />
              Save
            </>
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditProfileDialog; 