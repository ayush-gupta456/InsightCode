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

## Gmail API on Render Free (recommended for this deployment)

This sends through HTTPS port 443. It does not use SMTP or an app password. Google sign-in retains its existing GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET configuration and only requests identity scopes.

1. In Google Cloud Console, enable **Gmail API**. Prefer a separate OAuth web client for the sending mailbox. Configure the consent screen and add `create.personal456@gmail.com` as a test user while testing.
2. Add `https://developers.google.com/oauthplayground` as an authorized redirect URI for that sending client.
3. Open https://developers.google.com/oauthplayground . In the gear/settings panel select **Use your own OAuth credentials** and enter the sending client's ID and secret. Use offline access and a consent prompt.
4. In Step 1 enter only `https://www.googleapis.com/auth/gmail.send`, select **Authorize APIs**, and sign in as `create.personal456@gmail.com`. This permission lets the application send email from that mailbox. Approve it yourself.
5. In Step 2 select **Exchange authorization code for tokens**. Copy the **refresh token** directly to Render, not to chat or Git. Use your own credentials: Playground's default credentials are unsuitable for persistent production tokens.
6. Set these backend environment variables in Render:

```dotenv
AUTH_EMAIL_PROVIDER=gmail
GMAIL_CLIENT_ID=<sending OAuth client ID>
GMAIL_CLIENT_SECRET=<sending OAuth client secret>
GMAIL_REFRESH_TOKEN=<mailbox refresh token>
AUTH_EMAIL_FROM=InsightCode <create.personal456@gmail.com>
FRONTEND_ORIGIN=https://insightcode.vercel.app
```

7. Remove SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASS from Render once migrating. Keep PORT and your GOOGLE_* sign-in variables. Deploy the latest commit, request a reset for an existing account you control, and verify receipt and successful password change.

Explicit Gmail mode fails safely if credentials are missing or revoked; it does not silently fall back to blocked SMTP. Provider responses and tokens are not returned to the browser. Configuration presence does not establish successful delivery.

**Token lifetime:** Google external apps in Testing normally issue refresh tokens that expire after seven days for Gmail scopes. Before relying on unattended delivery, configure an appropriate production consent status and satisfy Google's applicable verification requirements. Publishing does not prevent revocation or other token expiry conditions. Reauthorize if the token is revoked. Gmail sending quotas still apply.

References: https://developers.google.com/workspace/gmail/api/guides/sending and https://developers.google.com/identity/protocols/oauth2
