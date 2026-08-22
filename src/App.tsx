import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { useAuthSession } from './features/auth/useAuthSession';
import { useOnboardingGate } from './features/onboarding/useOnboardingGate';
import { useSyncEngine } from './sync/useSyncEngine';
import { LoginPage } from './routes/LoginPage';
import { SignupPage } from './routes/SignupPage';
import { OnboardingPage } from './routes/OnboardingPage';
import { PantryPage } from './routes/PantryPage';
import { IngredientDetailPage } from './routes/IngredientDetailPage';
import { RecipesPage } from './routes/RecipesPage';
import { RecipeDetailPage } from './routes/RecipeDetailPage';
import { LogPage } from './routes/LogPage';
import { LogsPage } from './routes/LogsPage';
import { GroupsPage } from './routes/GroupsPage';
import { InvitePage } from './routes/InvitePage';
import { SyncStatusPage } from './routes/SyncStatusPage';
import { RequireAuth } from './routes/RequireAuth';
import { RedirectIfAuthed } from './routes/RedirectIfAuthed';
import { RequireOnboarded } from './routes/RequireOnboarded';
import { RedirectIfOnboarded } from './routes/RedirectIfOnboarded';

function App() {
  const { initializing } = useAuthSession();
  const { checking } = useOnboardingGate();
  useSyncEngine();

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
          {/* Only RequireAuth, not RequireOnboarded — routes.md notes this
              route must work for a logged-in user clicking a link from
              anywhere, so accepting an invite isn't blocked behind
              onboarding completion. See docs/pending-deviations.md (Ticket 11). */}
          <Route path="/invite/:inviteCode" element={<InvitePage />} />
          <Route element={<RequireOnboarded />}>
            <Route path="/" element={<Navigate to="/pantry" replace />} />
            <Route path="/pantry" element={<PantryPage />} />
            <Route path="/pantry/:ingredientId" element={<IngredientDetailPage />} />
            <Route path="/recipes" element={<RecipesPage />} />
            <Route path="/recipes/:recipeId" element={<RecipeDetailPage />} />
            <Route path="/log" element={<LogPage />} />
            <Route path="/logs" element={<LogsPage />} />
            {/* Same component as the personal routes above, just with a
                :groupId param present — see routes.md's "Personal vs. group"
                note and docs/pending-deviations.md (Ticket 12). */}
            <Route path="/groups/:groupId/pantry" element={<PantryPage />} />
            <Route path="/groups/:groupId/pantry/:ingredientId" element={<IngredientDetailPage />} />
            <Route path="/groups/:groupId/recipes" element={<RecipesPage />} />
            <Route path="/groups/:groupId/recipes/:recipeId" element={<RecipeDetailPage />} />
            <Route path="/groups/:groupId/log" element={<LogPage />} />
            <Route path="/groups" element={<GroupsPage />} />
            <Route path="/sync-status" element={<SyncStatusPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
