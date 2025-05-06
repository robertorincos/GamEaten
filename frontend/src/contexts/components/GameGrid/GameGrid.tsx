import { Box, ImageList, ImageListItem, Typography } from '@mui/material';

const GameGrid = () => {
  return (
    <Box>
      <ImageList sx={{ width: '100%' }} cols={2} rowHeight={164}>
        {[1, 2, 3, 4, 5, 6].map((item) => (
          <ImageListItem key={item}>
            <Box
              sx={{
                height: 164,
                bgcolor: 'grey.300',
                borderRadius: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Typography>Game {item}</Typography>
            </Box>
          </ImageListItem>
        ))}
      </ImageList>
    </Box>
  );
};

export default GameGrid;