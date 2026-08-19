import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { useColorScheme } from '@mui/material/styles';
import { shadows } from '../theme/theme';

export function AuthLayout({ children }: { children: ReactNode }) {
  const { mode } = useColorScheme();
  const tokens = mode === 'dark' ? shadows.dark : shadows.light;

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'background.default',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 3,
      }}
    >
      <Box sx={{ width: '100%', maxWidth: 400 }}>
        <Typography variant="h4" fontWeight={700} textAlign="center" sx={{ mb: 3 }}>
          Forklore
        </Typography>
        <Paper sx={{ p: 4, borderRadius: '14px', boxShadow: tokens.sh2 }}>{children}</Paper>
      </Box>
    </Box>
  );
}
