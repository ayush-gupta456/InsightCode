# Authentication and theme setup

The public landing, sign-in, registration, recovery, and workspace pages share a persistent light/dark preference. Motion follows the operating system's reduced-motion preference.

## Google sign-in

1. In Google Cloud Console, configure an OAuth consent screen and create an OAuth client with application type **Web application**.
2. Add this authorized redirect URI exactly:
   `https://insightcode.vercel.app/api/auth/google/callback`
3. In Render's insightcode-api environment, set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` from that client. Set `FRONTEND_ORIGIN=https://insightcode.vercel.app`.
4. Redeploy the backend. The Google button becomes active when both credentials are configured. During Google's testing mode, add permitted test users to the consent screen.

The callback must use the frontend domain: Vercel proxies /api to Render, so the browser's state and session cookies stay on the same host. Do not use the Render domain for this callback. State, browser binding, PKCE, nonce, signature, issuer, audience and verified-email checks protect the exchange. Accounts are identified by Google's subject ID. Existing email/password accounts are not automatically linked by email; use the existing password or recovery flow.

## Password recovery (Resend)

1. Create a Resend account and verify a sending domain you control.
2. Create an API key allowed to send email. Add it to Render as `RESEND_API_KEY`.
3. Set `AUTH_EMAIL_FROM=InsightCode <auth@your-verified-domain>` using a verified sender, and keep `FRONTEND_ORIGIN` set as above.
4. Redeploy, then test Forgot password with an address you control.

Keep client secrets and email API keys only on the backend. Do not use VITE_ prefixes or commit secrets. No paid subscription or provider account has been created automatically.

Reset links expire after 30 minutes. Only token hashes are stored, links are single-use, and changing the password invalidates previous access tokens and refresh sessions. Links use URL fragments to keep tokens out of web-server request logs. A successful request gives the same response for known and unknown email addresses. Without email configuration, recovery explains that it is unavailable rather than pretending to send a message.

## Release verification

Run npm test, npm run build, and the auth/public-experience browser tests. Google consent and real email delivery require the provider configuration above; mocked and rejection-path tests do not establish live provider success.

Known broader review limits: Java detection uses bounded heuristics, not a general compiler; AI complexity claims require human review. Live GitHub OAuth and Docker worker execution need separate integration verification. Render's proxy/rate-limit configuration should be reviewed before increasing authentication traffic.

## Gmail SMTP (no personal domain required)

Gmail SMTP is preferred when SMTP_HOST, SMTP_USER, SMTP_PASS and AUTH_EMAIL_FROM are set. Resend remains an optional alternative.

1. Enable 2-Step Verification on your Google account, then create an app password at https://myaccount.google.com/apppasswords. Use the app password, not your normal Gmail password. Google may restrict app passwords for managed or protected accounts.
2. Add these values to Render → insightcode-api → Environment:

```dotenv
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=create.personal456@gmail.com
SMTP_PASS=YOUR_16_CHARACTER_APP_PASSWORD
AUTH_EMAIL_FROM=InsightCode <create.personal456@gmail.com>
FRONTEND_ORIGIN=https://insightcode.vercel.app
```

Replace the placeholder with the real app password directly in Render; remove the grouping spaces Google displays. Never commit or paste it in chat. Port 587 uses required STARTTLS with certificate validation. Port 465 uses TLS immediately. In Render enter the sender value without surrounding quotes.

3. Save and redeploy. Request a reset for an existing account you control, check inbox/spam, follow the link, and confirm the old password no longer works.

**Hosting requirement:** Render Free web services block outbound SMTP ports 25, 465 and 587. Gmail SMTP therefore requires a paid Render instance or another host that permits SMTP. Adding environment variables alone cannot fix a blocked port. No hosting plan has been changed. If you stay on Render Free, an HTTPS email provider or Gmail API integration is needed instead.

Google sign-in uses separate OAuth credentials; the SMTP app password does not enable Google sign-in. Actual email delivery remains unverified until credentials and an SMTP-capable host are configured.

References: https://render.com/docs/free and https://support.google.com/mail/answer/185833
