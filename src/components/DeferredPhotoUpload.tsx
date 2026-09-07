import { useEffect, useRef, useState, type ChangeEvent } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import PhotoCameraOutlinedIcon from "@mui/icons-material/PhotoCameraOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import { PhotoThumbnail } from "./PhotoThumbnail";

// Stages a picked file locally (preview via a blob URL) instead of
// uploading it immediately, the way PhotoUpload does — the parent form is
// responsible for calling uploadPhoto() with the staged file at actual
// submit time, via onFileSelected. This means nothing touches R2 until
// the form is genuinely submitted, so cancelling never orphans an
// uploaded-but-unused photo. Used by IngredientForm/RecipeForm/RecipeDetail
// — see docs/pending-deviations.md (Ticket 15) for why avatar keeps using
// PhotoUpload's immediate-upload behavior instead.
//
// No uploading/error-from-upload state here — there's no async work
// happening in this component. An upload failure at submit time surfaces
// through the parent form's own existing error Alert/submitting state,
// the same way any other submit failure already does.
export function DeferredPhotoUpload({
  photoUrl,
  onChange,
  onFileSelected,
  alt,
  size = 52,
}: {
  photoUrl: string | null;
  onChange: (url: string | null) => void;
  onFileSelected: (file: File | null) => void;
  alt: string;
  size?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  useEffect(() => {
    previewUrlRef.current = previewUrl;
  }, [previewUrl]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  function stagePreview(file: File | null) {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    setError(null);
    stagePreview(file);
    onFileSelected(file);
  }

  function handleRemove() {
    setError(null);
    if (previewUrl) {
      // Cancels the staged pick, reverting to the last-saved photoUrl —
      // nothing was ever uploaded, so there's nothing to undo server-side.
      stagePreview(null);
      onFileSelected(null);
    } else {
      // Removing the actual saved photo — takes effect through the form's
      // normal submit flow, same as today.
      onChange(null);
    }
  }

  const displayUrl = previewUrl ?? photoUrl;

  return (
    <Box>
      <Box sx={{ position: "relative", width: size, height: size }}>
        <PhotoThumbnail photoUrl={displayUrl} alt={alt} size={size} />

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={handleFileChange}
        />

        <IconButton
          aria-label={displayUrl ? `Change ${alt} photo` : `Add ${alt} photo`}
          onClick={() => inputRef.current?.click()}
          sx={{
            position: "absolute",
            inset: 0,
            borderRadius: "12px",
            bgcolor: "rgba(0, 0, 0, 0.15)",
            color: "common.white",
            opacity: 0,
            "&:hover, &:focus-visible": { opacity: 1 },
          }}
        >
          <PhotoCameraOutlinedIcon fontSize="small" />
        </IconButton>

        {/* Always-visible affordance badge — see PhotoUpload.tsx's identical
            comment for why (no hover state on touch devices). */}
        <Box
          sx={{
            position: "absolute",
            bottom: -4,
            right: -4,
            width: 22,
            height: 22,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: "primary.main",
            color: "primary.contrastText",
            boxShadow: 1,
            pointerEvents: "none",
          }}
        >
          <PhotoCameraOutlinedIcon sx={{ fontSize: 13 }} />
        </Box>

        {displayUrl && (
          <IconButton
            aria-label={`Remove ${alt} photo`}
            size="small"
            onClick={handleRemove}
            sx={{
              position: "absolute",
              top: -8,
              right: -8,
              bgcolor: "background.paper",
              boxShadow: 1,
              "&:hover": { bgcolor: "background.paper" },
            }}
          >
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mt: 1 }}>
          {error}
        </Alert>
      )}
    </Box>
  );
}
