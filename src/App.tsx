import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import { useAuthSession } from "./features/auth/useAuthSession";
import { useOnboardingGate } from "./features/onboarding/useOnboardingGate";
import { useSyncEngine } from "./sync/useSyncEngine";
import { LoginPage } from "./routes/LoginPage";
import { SignupPage } from "./routes/SignupPage";
import { OnboardingPage } from "./routes/OnboardingPage";
import { AnimatedAppShell } from "./routes/AnimatedAppShell";
import { HomeRedirect } from "./routes/HomeRedirect";
import { PantryPage } from "./routes/PantryPage";
import { IngredientDetailPage } from "./routes/IngredientDetailPage";
import { RecipesPage } from "./routes/RecipesPage";
import { RecipeDetailPage } from "./routes/RecipeDetailPage";
import { LogPage } from "./routes/LogPage";
import { LogsPage } from "./routes/LogsPage";
import { GroupsPage } from "./routes/GroupsPage";
import { CommunityPantryPage } from "./routes/CommunityPantryPage";
import { InvitePage } from "./routes/InvitePage";
import { SyncStatusPage } from "./routes/SyncStatusPage";
import { RequireAuth } from "./routes/RequireAuth";
import { RedirectIfAuthed } from "./routes/RedirectIfAuthed";
import { RequireOnboarded } from "./routes/RequireOnboarded";
import { RedirectIfOnboarded } from "./routes/RedirectIfOnboarded";
import { RequireGroupMember } from "./routes/RequireGroupMember";
import { RequireGroupOwner } from "./routes/RequireGroupOwner";
import { GroupSettingsPage } from "./routes/GroupSettingsPage";
import { ProgressPage } from "./routes/ProgressPage";
import { ProfilePage } from "./routes/ProfilePage";
import { PrivacyPolicyPage } from "./routes/PrivacyPolicyPage";
import { TermsPage } from "./routes/TermsPage";

function App() {
  const { initializing } = useAuthSession();
  const { checking } = useOnboardingGate();
  useSyncEngine();

  if (initializing || checking) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          bgcolor: "background.default",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Public regardless of auth state — must be reachable while
            logged out (e.g. Google's OAuth consent screen review), so
            these sit outside every auth gate below. */}
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/terms" element={<TermsPage />} />

        {/* Public regardless of auth state — a not-yet-signed-up invitee
            needs to preview an invite, then land back here (still
            authenticated) after signup/login before ever reaching
            onboarding, so they join the group they were actually invited to
            rather than creating a redundant one in onboarding's mandatory
            group step. See docs/pending-deviations.md ("Remove personal
            mode") and AcceptInvite.tsx. */}
        <Route path="/invite/:inviteCode" element={<InvitePage />} />

        <Route element={<RedirectIfAuthed />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
        </Route>

        <Route element={<RequireAuth />}>
          <Route element={<RedirectIfOnboarded />}>
            <Route path="/onboarding" element={<OnboardingPage />} />
          </Route>
          <Route element={<RequireOnboarded />}>
            {/* AnimatedAppShell wraps the router outlet in AnimatePresence
                (push/pop vs. tab-switch transitions) and renders BottomNav
                as a sibling of the animated content — see
                frontend-architecture.md "Navigation animation" and
                docs/pending-deviations.md (Ticket 16). */}
            <Route element={<AnimatedAppShell />}>
              <Route path="/" element={<HomeRedirect />} />
              <Route path="/progress" element={<ProgressPage />} />
              {/* RequireGroupMember guards every route under this parent —
                  see issue #34's audit ("group routes trust the local cache
                  with no server-side membership check"). */}
              <Route path="/groups/:groupId" element={<RequireGroupMember />}>
                <Route path="pantry" element={<PantryPage />} />
                <Route
                  path="pantry/:ingredientId"
                  element={<IngredientDetailPage />}
                />
                <Route path="recipes" element={<RecipesPage />} />
                <Route
                  path="recipes/:recipeId"
                  element={<RecipeDetailPage />}
                />
                <Route path="log" element={<LogPage />} />
                <Route path="logs" element={<LogsPage />} />
                {/* Owner-only, nested inside the membership check above — see
                    docs/pending-deviations.md (Ticket 13). */}
                <Route element={<RequireGroupOwner />}>
                  <Route path="settings" element={<GroupSettingsPage />} />
                </Route>
              </Route>
              <Route path="/groups" element={<GroupsPage />} />
              {/* Browsable by everyone regardless of anyone's opt-in switch
                  — see docs/pending-deviations.md ("Community pantry").
                  IngredientDetailPage (same component as
                  /groups/:groupId/pantry/:ingredientId) reuses its
                  permission gating unchanged. */}
              <Route
                path="/community-pantry"
                element={<CommunityPantryPage />}
              />
              <Route
                path="/community-pantry/:ingredientId"
                element={<IngredientDetailPage />}
              />
              <Route path="/sync-status" element={<SyncStatusPage />} />
              <Route path="/profile" element={<ProfilePage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
