import Typography from '@mui/material/Typography';
import { LegalPageLayout } from '../components/LegalPageLayout';

const LAST_UPDATED = 'August 25, 2026';
const CONTACT_EMAIL = 'narc.ph@gmail.com';

// Public route (App.tsx keeps this outside RequireAuth) — same reasoning as
// PrivacyPolicyPage: needs to be reachable while logged out.
export function TermsPage() {
  return (
    <LegalPageLayout title="Terms of Service">
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Last updated: {LAST_UPDATED}
      </Typography>

      <Typography component="p">
        These Terms of Service ("Terms") govern your use of Forklore ("Forklore," "we," "us"), a
        personal pantry, recipe, and calorie-tracking app. By creating an account or using the
        app, you agree to these Terms.
      </Typography>

      <Typography component="h2">The service</Typography>
      <Typography component="p">
        Forklore lets you track pantry items, recipes, and food logs, optionally share them with
        a group you create or join, and view progress figures like BMI and daily calorie targets
        based on information you provide. It's offered free of charge, as a personal project, "as
        is" and "as available," without uptime guarantees.
      </Typography>

      <Typography component="h2">Your account</Typography>
      <Typography component="p">
        You're responsible for keeping your login credentials secure and for all activity under
        your account. You must provide accurate information and are responsible for keeping your
        account details up to date.
      </Typography>

      <Typography component="h2">Your content</Typography>
      <Typography component="p">
        You retain ownership of the pantry items, recipes, log entries, photos, and other content
        you add. By adding it, you give us permission to store and display it back to you (and,
        for anything you add to a group, to that group's other members) solely to provide the
        app's functionality.
      </Typography>
      <Typography component="p">
        If you join or create a group, you understand that any content you add to that group
        becomes visible to its other members, and content already shared to a group generally
        can't be un-shared retroactively — leaving a group stops future access, not past access
        already granted.
      </Typography>

      <Typography component="h2">Acceptable use</Typography>
      <Typography component="p">
        Don't use Forklore for anything illegal, don't try to access another user's account or
        data without permission, and don't abuse the group-invite system (e.g. to spam or harass
        people).
      </Typography>

      <Typography component="h2">Not medical advice</Typography>
      <Typography component="p">
        Any calorie target, BMI, weight-goal, or other figure Forklore calculates or displays is
        provided for general informational purposes only. It is not medical, dietary, or
        professional advice, and shouldn't be treated as a substitute for guidance from a
        qualified healthcare provider.
      </Typography>

      <Typography component="h2">Disclaimer and limitation of liability</Typography>
      <Typography component="p">
        Forklore is provided without warranties of any kind, express or implied. To the fullest
        extent permitted by law, we aren't liable for any damages arising from your use of, or
        inability to use, the app.
      </Typography>

      <Typography component="h2">Termination</Typography>
      <Typography component="p">
        You may stop using Forklore at any time, and may request deletion of your account by
        contacting us at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. We may suspend
        or terminate access for anyone who violates these Terms.
      </Typography>

      <Typography component="h2">Changes to these Terms</Typography>
      <Typography component="p">
        We may update these Terms from time to time. Material changes will be reflected by
        updating the "Last updated" date above.
      </Typography>

      <Typography component="h2">Contact us</Typography>
      <Typography component="p">
        Questions about these Terms can be sent to{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </Typography>
    </LegalPageLayout>
  );
}
