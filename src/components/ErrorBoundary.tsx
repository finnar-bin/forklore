import { Component, type ErrorInfo, type ReactNode } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

// Without this, an uncaught render error unmounts the whole app to a blank
// screen with no trace. Must be a class component — no hook equivalent for
// getDerivedStateFromError/componentDidCatch.
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught render error:", error, errorInfo);
  }

  render() {
    if (this.state.error) {
      return (
        <Box
          sx={{
            minHeight: "100vh",
            bgcolor: "background.default",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            p: 2,
          }}
        >
          <Paper
            sx={{
              p: 4,
              maxWidth: 400,
              width: "100%",
              borderRadius: "14px",
              textAlign: "center",
            }}
          >
            <Stack spacing={2} sx={{ alignItems: "center" }}>
              <Typography variant="h6" sx={{ fontWeight: 500 }}>
                Something went wrong
              </Typography>
              <Typography sx={{ color: "text.secondary" }}>
                Forklore ran into an unexpected error. Reloading usually fixes
                it.
              </Typography>
              <Alert severity="error" sx={{ width: "100%" }}>
                {this.state.error.message || "Unknown error"}
              </Alert>
              <Button
                variant="contained"
                size="large"
                fullWidth
                onClick={() => window.location.reload()}
              >
                Reload
              </Button>
            </Stack>
          </Paper>
        </Box>
      );
    }

    return this.props.children;
  }
}
