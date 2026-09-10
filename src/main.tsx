import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/700.css";
import { theme } from "./theme/theme";
import App from "./App.tsx";
import { UpdatePrompt } from "./pwa/UpdatePrompt.tsx";
import { NotificationProvider } from "./components/NotificationProvider";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider theme={theme} defaultMode="system">
      <CssBaseline enableColorScheme />
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        {/* Wraps both App and UpdatePrompt (not just App) — UpdatePrompt's
            own "new version available" toast (see that file) fires from
            outside App's router/auth-gated tree, at the true app root, so
            it needs useNotification() available here too, not only inside
            App's own screens. See NotificationProvider.tsx. */}
        <NotificationProvider>
          <App />
          <UpdatePrompt />
        </NotificationProvider>
      </LocalizationProvider>
    </ThemeProvider>
  </StrictMode>,
);
