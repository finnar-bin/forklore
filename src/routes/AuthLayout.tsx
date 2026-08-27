import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { useColorScheme } from "@mui/material/styles";
import { Link as RouterLink } from "react-router-dom";
import { shadows } from "../theme/theme";

export function AuthLayout({ children }: { children: ReactNode }) {
  const { mode } = useColorScheme();
  const tokens = mode === "dark" ? shadows.dark : shadows.light;

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 3,
      }}
    >
      <Box sx={{ width: "100%", maxWidth: 400 }}>
        <Typography
          variant="h4"
          fontWeight={700}
          textAlign="center"
          sx={{ mb: 3 }}
        >
          Forklore
        </Typography>
        <Paper sx={{ p: 4, borderRadius: "14px", boxShadow: tokens.sh2 }}>
          {children}
        </Paper>
        <Typography
          variant="caption"
          color="text.secondary"
          textAlign="center"
          sx={{ display: "block", mt: 2 }}
        >
          By continuing, you agree to our{" "}
          <Link component={RouterLink} to="/terms" color="inherit">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link component={RouterLink} to="/privacy" color="inherit">
            Privacy Policy
          </Link>
          .
        </Typography>
      </Box>
    </Box>
  );
}
