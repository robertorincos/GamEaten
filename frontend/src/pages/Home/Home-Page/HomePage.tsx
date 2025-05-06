import { Box, Container, Tab, Tabs, Typography, AppBar, Toolbar, InputBase } from '@mui/material';
import { useState } from 'react';
import GameFeed from '../../../contexts/components/GameFeed/GameFeed.tsx';
import SearchIcon from '@mui/icons-material/Search';

export const HomePage = () => {
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <Box>
      <AppBar position="static" sx={{ mb: 2 }}>
        <Toolbar sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="h6">Logo</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Typography sx={{ mx: 2 }}>Game List</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', bgcolor: 'rgba(255, 255, 255, 0.15)', borderRadius: 1, px: 1 }}>
              <SearchIcon />
              <InputBase
                placeholder="Search..."
                sx={{ ml: 1, color: 'inherit' }}
              />
            </Box>
          </Box>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl">
        <Box sx={{ display: 'flex', gap: 2, p: 2 }}>
          <Box sx={{ flex: 2 }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
              <Tabs value={tabValue} onChange={handleTabChange}>
                <Tab label="Following" />
                <Tab label="Global" />
                <Tab label="Game News" />
              </Tabs>
            </Box>
            <GameFeed />
          </Box>
          <Box sx={{ flex: 1 }}>
            {/* Game recommendations grid */}
            <Typography variant="h6" gutterBottom>
              Recommended Games
            </Typography>
            {/* Add GameGrid component here */}
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

export default HomePage;