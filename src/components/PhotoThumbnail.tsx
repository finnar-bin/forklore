import Box from "@mui/material/Box";
import PhotoCameraOutlinedIcon from "@mui/icons-material/PhotoCameraOutlined";

// Generic "no photo" placeholder tile — used identically for ingredients,
// recipes, and avatars per design-system.md (no per-category iconography).
export function PhotoThumbnail({
  photoUrl,
  alt,
  size = 52,
}: {
  photoUrl: string | null;
  alt: string;
  size?: number;
}) {
  if (photoUrl) {
    return (
      <Box
        component="img"
        src={photoUrl}
        alt={alt}
        sx={{
          width: size,
          height: size,
          borderRadius: "12px",
          objectFit: "cover",
          flexShrink: 0,
        }}
      />
    );
  }

  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: "12px",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "text.secondary",
        background: (theme) =>
          theme.palette.mode === "dark"
            ? "linear-gradient(135deg, #3A4650, #2D373C)"
            : "linear-gradient(135deg, #E8DDBB, #D9CC9F)",
      }}
    >
      <PhotoCameraOutlinedIcon sx={{ fontSize: size * 0.4 }} />
    </Box>
  );
}
