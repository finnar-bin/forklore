import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import PhotoCameraOutlinedIcon from '@mui/icons-material/PhotoCameraOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { PhotoThumbnail } from './PhotoThumbnail';
import { uploadPhoto, type PhotoEntity } from '../lib/photoUpload';

// Wraps PhotoThumbnail with a file-picker trigger and the compress ->
// presign -> PUT flow (src/lib/photoUpload.ts). No `capture` attribute on
// the file input — it forces camera-only access on some mobile browsers;
// plain `accept="image/*"` already surfaces camera as a native picker
// option while keeping gallery/file access on both mobile and desktop.
export function PhotoUpload({
  photoUrl,
  onChange,
  alt,
  entity,
  entityId,
  size = 52,
  onUploadingChange,
}: {
  photoUrl: string | null;
  onChange: (url: string | null) => void;
  alt: string;
  entity: PhotoEntity;
  // The existing ingredient/recipe's own id, so the upload overwrites its
  // previous photo in R2 instead of creating a new object each time. Omit
  // when there's no row yet (a create flow) — see src/lib/photoUpload.ts.
  // Not needed for `entity="avatar"`, which is always keyed by the caller's
  // own user id server-side.
  entityId?: string;
  size?: number;
  onUploadingChange?: (uploading: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Must reset to true here, not just rely on the ref's initial value —
    // React StrictMode double-invokes effects on mount (mount -> cleanup ->
    // mount again) precisely to catch bugs like this. Without this line,
    // that dev-mode cycle runs the cleanup below once, permanently leaving
    // mountedRef.current false for the rest of this component's real
    // lifetime, even though it's still mounted — silently breaking every
    // upload's onChange/setUploading call after that.
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setError(null);
    setUploading(true);
    onUploadingChange?.(true);
    try {
      const url = await uploadPhoto(file, entity, entityId);
      // The parent may have unmounted this component while the upload was
      // in flight (e.g. a dialog closed) — calling onChange/setState after
      // that would warn at best and, if the parent doesn't gate navigation
      // on onUploadingChange, silently lose the just-uploaded photo at
      // worst. Every consumer of this component gates its own
      // navigation/submit on onUploadingChange, so this is a defensive
      // backstop, not the primary safeguard.
      if (!mountedRef.current) return;
      onChange(url);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
    } finally {
      if (mountedRef.current) {
        setUploading(false);
        onUploadingChange?.(false);
      }
    }
  }

  return (
    <Box>
      <Box sx={{ position: 'relative', width: size, height: size }}>
        <PhotoThumbnail photoUrl={photoUrl} alt={alt} size={size} />

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={handleFileChange}
          disabled={uploading}
        />

        <IconButton
          aria-label={photoUrl ? `Change ${alt} photo` : `Add ${alt} photo`}
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          sx={{
            position: 'absolute',
            inset: 0,
            borderRadius: '12px',
            bgcolor: 'rgba(0, 0, 0, 0.15)',
            color: 'common.white',
            opacity: 0,
            '&:hover, &:focus-visible': { opacity: 1 },
          }}
        >
          <PhotoCameraOutlinedIcon fontSize="small" />
        </IconButton>

        {/* Always-visible affordance badge — the full-tile IconButton above
            only reveals itself on hover/focus, which never happens on a
            touch device, so without this a tappable photo tile would show
            no indication of that on mobile. Decorative/non-interactive
            (pointer-events: none); the invisible full-tile button already
            handles the actual click/keyboard interaction. */}
        {!uploading && (
          <Box
            sx={{
              position: 'absolute',
              bottom: -4,
              right: -4,
              width: 22,
              height: 22,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              boxShadow: 1,
              pointerEvents: 'none',
            }}
          >
            <PhotoCameraOutlinedIcon sx={{ fontSize: 13 }} />
          </Box>
        )}

        {uploading && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '12px',
              bgcolor: 'rgba(0, 0, 0, 0.35)',
            }}
          >
            <CircularProgress size={Math.min(24, size * 0.4)} sx={{ color: 'common.white' }} />
          </Box>
        )}

        {photoUrl && !uploading && (
          <IconButton
            aria-label={`Remove ${alt} photo`}
            size="small"
            onClick={() => onChange(null)}
            sx={{
              position: 'absolute',
              top: -8,
              right: -8,
              bgcolor: 'background.paper',
              boxShadow: 1,
              '&:hover': { bgcolor: 'background.paper' },
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
