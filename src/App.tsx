import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { useAuthSession } from './features/auth/useAuthSession';
import { useOnboardingGate } from './features/onboarding/useOnboardingGate';
import { LoginPage } from './routes/LoginPage';
import { SignupPage } from './routes/SignupPage';
import { OnboardingPage } from './routes/OnboardingPage';
import { PantryPage } from './routes/PantryPage';
import { IngredientDetailPage } from './routes/IngredientDetailPage';
import { RequireAuth } from './routes/RequireAuth';
import { RedirectIfAuthed } from './routes/RedirectIfAuthed';
import { RequireOnboarded } from './routes/RequireOnboarded';
import { RedirectIfOnboarded } from './routes/RedirectIfOnboarded';

function App() {
  const { initializing } = useAuthSession();
  const { checking } = useOnboardingGate();

  if (initializing || checking) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          bgcolor: 'background.default',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<RedirectIfAuthed />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
        </Route>

        <Route element={<RequireAuth />}>
          <Route element={<RedirectIfOnboarded />}>
            <Route path="/onboarding" element={<OnboardingPage />} />
          </Route>
          <Route element={<RequireOnboarded />}>
            <Route path="/" element={<Navigate to="/pantry" replace />} />
            <Route path="/pantry" element={<PantryPage />} />
            <Route path="/pantry/:ingredientId" element={<IngredientDetailPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
