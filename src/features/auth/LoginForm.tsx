import { useState, type FormEvent } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { getPendingInviteCode } from "../../lib/pendingInviteStorage";
import { signInWithEmail, signInWithGoogle } from "./api";
import { friendlyAuthError } from "./errors";
import { GoogleIcon } from "./GoogleIcon";

export function LoginForm() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signInWithEmail(email, password);
      // Unlike signup/Google (redirect-driven, so the invite page itself is
      // the next thing rendered), email/password login resolves in place —
      // nothing else would send an invited existing user back to the invite
      // they came from. See docs/pending-deviations.md ("Remove personal
      // mode").
      const pendingInviteCode = getPendingInviteCode();
      if (pendingInviteCode) {
        navigate(`/invite/${pendingInviteCode}`, { replace: true });
      }
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    setGoogleSubmitting(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(friendlyAuthError(err));
      setGoogleSubmitting(false);
    }
  }

  return (
    <Stack spacing={3} component="form" onSubmit={handleSubmit}>
      <Typography variant="h5" fontWeight={500}>
        Log in
      </Typography>

      {error && <Alert severity="error">{error}</Alert>}

      <Button
        variant="outlined"
        size="large"
        startIcon={<GoogleIcon />}
        onClick={handleGoogle}
        disabled={googleSubmitting || submitting}
      >
        Continue with Google
      </Button>

      <Divider>or</Divider>

      <TextField
        label="Email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        fullWidth
      />
      <TextField
        label="Password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        fullWidth
      />

      <Button
        type="submit"
        variant="contained"
        size="large"
        disabled={submitting || googleSubmitting}
      >
        {submitting ? "Logging in…" : "Log in"}
      </Button>

      <Typography variant="body2" color="text.secondary" textAlign="center">
        New here?{" "}
        <Link component={RouterLink} to="/signup">
          Create an account
        </Link>
      </Typography>
    </Stack>
  );
}
