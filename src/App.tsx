import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import { useColorScheme } from '@mui/material/styles';
import { shadows } from './theme/theme';

function App() {
  const { mode, setMode } = useColorScheme();
  const tokens = mode === 'dark' ? shadows.dark : shadows.light;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar
        position="sticky"
        color="transparent"
        elevation={0}
        sx={{ bgcolor: 'background.paper', boxShadow: tokens.sh1 }}
      >
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 500 }}>
            Forklore
          </Typography>
          <IconButton
            aria-label="Toggle theme"
            onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}
          >
            {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
          </IconButton>
        </Toolbar>
      </AppBar>

      <Stack spacing={3} sx={{ p: 3, maxWidth: 480, mx: 'auto' }}>
        <Paper sx={{ p: 3, borderRadius: '14px', boxShadow: tokens.sh2 }}>
          <Typography variant="subtitle1" fontWeight={500} gutterBottom>
            Scaffold ready
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Vite + React + TypeScript, MUI v6 themed with the Everforest
            palette, and a PWA shell that precaches the app on first visit.
          </Typography>
        </Paper>

        <Button variant="contained" size="large">
          Looks like a real app, not MUI defaults
        </Button>
      </Stack>
    </Box>
  );
}

export default App;
