import * as React from 'react';
import { useNavigate as useReactRouterNavigate, BrowserRouter } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Container from '@mui/material/Container';
import CssBaseline from '@mui/material/CssBaseline';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormLabel from '@mui/material/FormLabel';
import FormControl from '@mui/material/FormControl';
import Link from '@mui/material/Link';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import MuiCard from '@mui/material/Card';
import { styled, useTheme } from '@mui/material/styles';
import { useMediaQuery } from '@mui/material';

import AppTheme from '../../shared-theme/AppTheme';
import ColorModeSelect from '../../shared-theme/ColorModeSelect';
import { GoogleIcon, FacebookIcon, SitemarkIcon } from '../../../contexts/components/CustomIcons/CustomIcons';
import { useState } from 'react';
import { register } from '../../../api/auth';

const Card = styled(MuiCard)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  width: '100%',
  padding: theme.spacing(4),
  gap: theme.spacing(2),
  margin: 'auto',
  marginTop: theme.spacing(4),
  boxShadow:
    'hsla(220, 30%, 5%, 0.05) 0px 5px 15px 0px, hsla(220, 25%, 10%, 0.05) 0px 15px 35px -5px',
  [theme.breakpoints.up('sm')]: {
    width: '450px',
  },
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(3),
    margin: theme.spacing(1),
    marginTop: theme.spacing(2),
  },
  ...theme.applyStyles('dark', {
    boxShadow:
      'hsla(220, 30%, 5%, 0.5) 0px 5px 15px 0px, hsla(220, 25%, 10%, 0.08) 0px 15px 35px -5px',
  }),
}));

const SignUpContainer = styled(Container)(({ theme }) => ({
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(1),
  },
}));

// Add this custom hook to safely handle navigation both inside and outside Router context
//function useCustomNavigate() {
  // Try to use React Router's navigate, but don't throw if we're outside Router context
//  let navigate;
//  try {
//    navigate = useReactRouterNavigate();
//    return navigate;
//  } catch (e) {
    // If we're outside Router context, return a function that logs the navigation
//    return (path: string) => {
//      console.log(`Would navigate to ${path}`);
      // You could also use window.location.href = path; for actual navigation
      // window.location.href = path;
//    };
//  }
//}

export default function SignUp(props: { disableCustomTheme?: boolean }) {
  // Replace navigate with our custom hook
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const [emailError, setEmailError] = React.useState(false);
  const [emailErrorMessage, setEmailErrorMessage] = React.useState('');
  const [passwordError, setPasswordError] = React.useState(false);
  const [passwordErrorMessage, setPasswordErrorMessage] = React.useState('');
  const [nameError, setNameError] = React.useState(false);
  const [nameErrorMessage, setNameErrorMessage] = React.useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');
  const [termsError, setTermsError] = useState(false);

  const validateInputs = () => {
    const email = document.getElementById('email') as HTMLInputElement;
    const password = document.getElementById('password') as HTMLInputElement;
    const name = document.getElementById('name') as HTMLInputElement;
    const termsAgreed = document.querySelector('input[name="termsAgreed"]') as HTMLInputElement;

    let isValid = true;

    if (!email.value || !/\S+@\S+\.\S+/.test(email.value)) {
      setEmailError(true);
      setEmailErrorMessage('Please enter a valid email address.');
      isValid = false;
    } else {
      setEmailError(false);
      setEmailErrorMessage('');
    }

    if (!password.value || password.value.length < 6) {
      setPasswordError(true);
      setPasswordErrorMessage('Password must be at least 6 characters long.');
      isValid = false;
    } else {
      setPasswordError(false);
      setPasswordErrorMessage('');
    }

    if (!name.value || name.value.length < 1) {
      setNameError(true);
      setNameErrorMessage('Name is required.');
      isValid = false;
    } else {
      setNameError(false);
      setNameErrorMessage('');
    }

    if (!termsAgreed || !termsAgreed.checked) {
      setTermsError(true);
      setSubmitError('You must agree to the Terms of Service to create an account.');
      isValid = false;
    } else {
      setTermsError(false);
      setSubmitError('');
    }

    return isValid;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    // First validate inputs
    if (!validateInputs()) {
      return;
    }
    
    setIsSubmitting(true);
    setSubmitError('');
    setSubmitSuccess('');
    
    const data = new FormData(event.currentTarget);
    
    try {
      await register({
        user: data.get('name') as string,
        email: data.get('email') as string,
        pass: data.get('password') as string
      });
      
      setSubmitSuccess('Account created successfully! Redirecting to login...');
      
      // Replace the navigate function with direct navigation
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
      
    } catch (error: any) {
      console.error('Registration error:', error);
      
      if (error.status === 409) {
        setSubmitError('Email already registered. Please use a different email address.');
      } else if (error.data && error.data.message) {
        setSubmitError(error.data.message);
      } else {
        setSubmitError('Failed to create account. Please try again later.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render the component in a Router if we detect we're not in one already
  const content = (
    <AppTheme {...props}>
      <CssBaseline enableColorScheme />
      <ColorModeSelect sx={{ position: 'fixed', top: '1rem', right: '1rem' }} />
      <SignUpContainer maxWidth="sm">
        <Card variant="outlined">
          <SitemarkIcon />
          <Typography
            component="h1"
            variant="h4"
            sx={{ width: '100%', textAlign: 'center', fontSize: 'clamp(2rem, 10vw, 2.15rem)' }}
          >
            Sign up
          </Typography>
          
          {submitError && (
            <Alert severity="error" sx={{ width: '100%' }}>
              {submitError}
            </Alert>
          )}
          
          {submitSuccess && (
            <Alert severity="success" sx={{ width: '100%' }}>
              {submitSuccess}
            </Alert>
          )}
          
          <Box
            component="form"
            onSubmit={handleSubmit}
            sx={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%' }}
          >
            <FormControl>
              <FormLabel htmlFor="name">Username</FormLabel>
              <TextField
                autoComplete="name"
                name="name"
                required
                fullWidth
                id="name"
                placeholder="Jon Snow"
                error={nameError}
                helperText={nameErrorMessage}
                color={nameError ? 'error' : 'primary'}
              />
            </FormControl>
            <FormControl>
              <FormLabel htmlFor="email">Email</FormLabel>
              <TextField
                required
                fullWidth
                id="email"
                placeholder="your@email.com"
                name="email"
                autoComplete="email"
                variant="outlined"
                error={emailError}
                helperText={emailErrorMessage}
                color={emailError ? 'error' : 'primary'}
              />
            </FormControl>
            <FormControl>
              <FormLabel htmlFor="password">Password</FormLabel>
              <TextField
                required
                fullWidth
                name="password"
                placeholder="••••••"
                type="password"
                id="password"
                autoComplete="new-password"
                variant="outlined"
                error={passwordError}
                helperText={passwordErrorMessage}
                color={passwordError ? 'error' : 'primary'}
              />
            </FormControl>
            <FormControlLabel
              control={<Checkbox value="allowExtraEmails" color="primary" />}
              label="I want to receive updates via email."
            />
            <FormControlLabel
              required
              control={
                <Checkbox 
                  name="termsAgreed" 
                  color={termsError ? "error" : "primary"} 
                />
              }
              label={
                <Typography variant="body2" color={termsError ? "error" : "textPrimary"}>
                  I agree to the <Link href="https://drive.google.com/file/d/1vS9Gdv9sIFGz9pcD2MRoh1043Kz2kB5b/view?usp=sharing" 
                  target="_blank"
                  rel="noopener noreferrer"
                  >Terms of Service</Link> and Privacy Policy
                </Typography>
              }
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={isSubmitting}
              sx={{
                minHeight: isMobile ? '48px' : '40px',
                fontSize: isMobile ? '16px' : '14px'
              }}
            >
              {isSubmitting ? 'Signing up...' : 'Sign up'}
            </Button>
          </Box>
          <Divider>
            <Typography sx={{ color: 'text.secondary' }}>or</Typography>
          </Divider>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Button
              fullWidth
              variant="outlined"
              onClick={() => alert('Sign up with Google')}
              startIcon={<GoogleIcon />}
              sx={{
                minHeight: isMobile ? '48px' : '40px',
                fontSize: isMobile ? '16px' : '14px'
              }}
            >
              Sign up with Google
            </Button>
            <Button
              fullWidth
              variant="outlined"
              onClick={() => alert('Sign up with Facebook')}
              startIcon={<FacebookIcon />}
              sx={{
                minHeight: isMobile ? '48px' : '40px',
                fontSize: isMobile ? '16px' : '14px'
              }}
            >
              Sign up with Facebook
            </Button>
            <Typography sx={{ textAlign: 'center' }}>
              Already have an account?{' '}
              <Link
                component="a"
                href="/"
                variant="body2"
                sx={{ 
                  alignSelf: 'center', 
                  cursor: 'pointer',
                  fontSize: isMobile ? '16px' : '14px',
                  minHeight: isMobile ? '44px' : 'auto',
                  display: 'inline-flex',
                  alignItems: 'center'
                }}
                onClick={(e) => {
                  e.preventDefault();
                  window.location.href = '/'; // This ensures full navigation
                }}
              >
                Sign in
              </Link>
            </Typography>
          </Box>
        </Card>
      </SignUpContainer>
    </AppTheme>
  );

  // Check if we're inside a Router context
  const isInRouterContext = (() => {
    try {
      useReactRouterNavigate();
      return true;
    } catch {
      return false;
    }
  })();

  // If we're not in a Router context, wrap the content in a Router
  return isInRouterContext ? content : (
    <BrowserRouter>
      {content}
    </BrowserRouter>
  );
}