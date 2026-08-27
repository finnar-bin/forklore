import { Navigate } from "react-router-dom";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import { useHomePath } from "../store/useAppStore";

// "/" used to redirect straight to /pantry — no longer exists, since every
// account belongs to at least one group now (see docs/pending-deviations.md,
// "Remove personal mode") and Pantry/Recipes/Log are group-scoped-only.
// Waits for useHomePath to resolve (rather than redirecting to /groups
// first and then again once the user's groups load) so this doesn't flash
// through an intermediate screen on every fresh load.
export function HomeRedirect() {
  const homePath = useHomePath();

  if (!homePath) {
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

  return <Navigate to={homePath} replace />;
}
