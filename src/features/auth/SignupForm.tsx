import { useState, type FormEvent } from "react";
import { Link as RouterLink } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { signUpWithEmail } from "./api";
import { friendlyAuthError } from "./errors";

export function SignupForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmEmailSent, setConfirmEmailSent] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { needsEmailConfirmation } = await signUpWithEmail(email, password);
      setConfirmEmailSent(needsEmailConfirmation);
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmEmailSent) {
    return (
      <Stack spacing={3}>
        <Typography variant="h5" fontWeight={500}>
          Check your email
        </Typography>
        <Alert severity="success">
          We sent a confirmation link to {email}. Follow it to finish creating
          your account.
        </Alert>
      </Stack>
    );
  }

  return (
    <Stack spacing={3} component="form" onSubmit={handleSubmit}>
      <Typography variant="h5" fontWeight={500}>
        Create an account
      </Typography>

      {error && <Alert severity="error">{error}</Alert>}

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
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        fullWidth
        helperText="At least 6 characters"
      />

      <Button
        type="submit"
        variant="contained"
        size="large"
        disabled={submitting}
      >
        {submitting ? "Creating account…" : "Create account"}
      </Button>

      <Typography variant="body2" color="text.secondary" textAlign="center">
        Already have an account?{" "}
        <Link component={RouterLink} to="/login">
          Log in
        </Link>
      </Typography>
    </Stack>
  );
}
