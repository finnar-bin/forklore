import type { ReactNode } from "react";
import Box from "@mui/material/Box";

// Keeps a dialog form's primary button pinned to the bottom of the scrolling
// dialog body, so the mobile sheet never leaves it under the keyboard.
export function StickySubmitBar({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        position: "sticky",
        bottom: 0,
        bgcolor: "background.paper",
        py: 1,
      }}
    >
      {children}
    </Box>
  );
}
