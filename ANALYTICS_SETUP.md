# Telemark analytics setup

The website uses GA4 for anonymous traffic and interaction events, local
storage plus portable JSON files for no-account progress, Firebase
Authentication and Firestore for optional cloud sync and Sharp AI, and one
Firebase callable function for secure aggregate reporting.

## 1. Firebase and billing

1. Open the `telemark-e9159` Firebase project.
2. Upgrade the project to the Blaze plan so Cloud Functions can call the Google
   Analytics Data API.
3. Under Authentication → Sign-in method, enable Google.
4. Under Authentication → Settings → Authorized domains, confirm
   `telemarkfirst.github.io` is listed.
5. Deploy the owner-only progress rules:

   ```bash
   npm run deploy:firestore
   ```

These rules allow each optionally signed-in learner to access only
`users/{theirUid}/telemark/progress`. Admin reporting uses the Firebase Admin SDK
inside the callable function and does not depend on browser rule access.

## 2. GA4 reporting access

The public measurement ID is already configured as `G-VXW7YL7R06`. The backend
also needs the property's numeric ID:

1. In Google Analytics, open Admin → Property details and copy the numeric
   Property ID.
2. Enable **Google Analytics Data API** in the Google Cloud project associated
   with `telemark-e9159`.
3. Deploy the function once and identify its runtime service account in Google
   Cloud Functions/Cloud Run.
4. In Google Analytics Admin → Property access management, add that runtime
   service account with the Viewer role.
5. For local deployment, create `functions/.env.telemark-e9159`:

   ```dotenv
   GA4_PROPERTY_ID=123456789
   TELEMARK_ADMIN_EMAIL=admin@example.com
   TELEMARK_ALLOWED_ORIGINS=https://telemarkfirst.github.io
   ```

   Replace the example with the real numeric property ID, then run:

   ```bash
   npm run deploy:functions
   ```

Do not place service-account JSON or the GA property ID in browser code.

## 3. GitHub Actions

Create these repository secrets:

- `GA4_PROPERTY_ID`: the numeric GA4 property ID.
- `FIREBASE_SERVICE_ACCOUNT_TELEMARK`: JSON credentials for a deployment
  service account permitted to deploy Firebase Cloud Functions.

Create these repository variables:

- `TELEMARK_ADMIN_EMAIL`: the verified Google account allowed to open `/admin`.
- `TELEMARK_ALLOWED_ORIGINS`: comma-separated production origins accepted by
  Firebase callable functions. During the staged migration this may contain
  both GitHub Pages origins; remove the legacy origin after redirects activate.
- `TELEMARK_REDIRECTS_ENABLED`: leave unset or `false` until the destination
  site is live, then set it to `true` in the legacy repository only.

When the service-account secret exists, pushes to `main` deploy both GitHub Pages
and the callable function. Without it, the function job safely skips deployment.

## 4. Verification

1. Open GA4 DebugView and confirm `curriculum_start`, `lesson_complete`,
   `unit_complete`, `simulator_launch`, `progress_export`, and `progress_import`.
2. Visit `/admin` signed out and confirm the login page appears.
3. Sign in with a different Google account and confirm access is denied.
4. Sign in with the configured administrator account and test the 7, 28, and
   90-day reports.
5. Confirm the function response contains no names, email addresses, or UIDs.

GA4 traffic and event history starts when tracking is deployed. `Total users`
is an estimate based on GA4 browser identities, while `curriculum_start`
identifies visitors who opened a lesson. Existing Firebase accounts and cloud
progress documents are included in their separate aggregate totals immediately;
progress kept only in a learner's browser is intentionally not visible to the
admin backend.
