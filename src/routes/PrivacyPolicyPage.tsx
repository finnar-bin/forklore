import Typography from "@mui/material/Typography";
import { LegalPageLayout } from "../components/LegalPageLayout";

const LAST_UPDATED = "August 25, 2026";
const CONTACT_EMAIL = "narc.ph@gmail.com";

// Public route (App.tsx keeps this outside RequireAuth) — must be reachable
// while logged out, since Google's OAuth consent screen review needs a
// working privacy policy URL that doesn't require signing in first.
export function PrivacyPolicyPage() {
  return (
    <LegalPageLayout title="Privacy Policy">
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Last updated: {LAST_UPDATED}
      </Typography>

      <Typography component="p">
        Forklore ("Forklore," "we," "us") is a personal pantry, recipe, and
        calorie-tracking app. This policy explains what information we collect,
        how we use it, and who we share it with.
      </Typography>

      <Typography component="h2">Information we collect</Typography>
      <Typography component="p">
        <strong>Account information.</strong> When you sign up, we collect your
        email address and, if you sign in with Google, your name and profile
        photo as provided by Google.
      </Typography>
      <Typography component="p">
        <strong>Profile and health information.</strong> Information you choose
        to enter, such as your height, weight, birthdate, and weight goals, used
        to calculate figures like BMI and daily calorie targets shown back to
        you in the app.
      </Typography>
      <Typography component="p">
        <strong>Content you create.</strong> Pantry items, recipes, and food log
        entries you add, along with any photos you upload for them or for your
        profile avatar.
      </Typography>
      <Typography component="p">
        <strong>Group information.</strong> If you create or join a group, your
        membership and the pantry, recipe, and log data shared within that group
        is visible to other members of that same group.
      </Typography>

      <Typography component="h2">How we use this information</Typography>
      <Typography component="p">
        We use your information solely to provide the app's functionality:
        storing your pantry, recipes, and logs; calculating the nutrition and
        progress figures the app displays; syncing your data across your
        devices; and sharing group content with the group members you've chosen
        to invite.
      </Typography>
      <Typography component="p">
        We do not use your information for advertising, and we do not use
        third-party analytics or advertising trackers.
      </Typography>

      <Typography component="h2">Where your information is stored</Typography>
      <ul>
        <li>
          Account data, profile data, and app content are stored in a Postgres
          database hosted by Supabase.
        </li>
        <li>
          Photos (ingredient, recipe, and avatar images) are stored in a
          Cloudflare R2 bucket. These images are stored at unguessable, id-based
          addresses but are not access-controlled — anyone with the exact image
          address could view it.
        </li>
        <li>
          A copy of your data is also stored locally on your device (via your
          browser's local storage) so the app keeps working offline and syncs
          changes once you're back online.
        </li>
      </ul>

      <Typography component="h2">Who we share information with</Typography>
      <Typography component="p">
        We don't sell your information or share it with third parties for
        marketing. Your data is processed by the infrastructure providers above
        (Supabase and Cloudflare) solely to operate the app, and — where you've
        joined a group — with the other members of that group, limited to the
        content shared within it.
      </Typography>

      <Typography component="h2">Data retention and deletion</Typography>
      <Typography component="p">
        We retain your information for as long as your account is active. To
        request deletion of your account and associated data, contact us at{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </Typography>

      <Typography component="h2">Children's privacy</Typography>
      <Typography component="p">
        Forklore is not directed at children under 13, and we do not knowingly
        collect information from children under 13.
      </Typography>

      <Typography component="h2">Changes to this policy</Typography>
      <Typography component="p">
        We may update this policy from time to time. Material changes will be
        reflected by updating the "Last updated" date above.
      </Typography>

      <Typography component="h2">Contact us</Typography>
      <Typography component="p">
        Questions about this policy or your data can be sent to{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </Typography>
    </LegalPageLayout>
  );
}
