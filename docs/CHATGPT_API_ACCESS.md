# ChatGPT API Access

Ristak exposes a token-protected external API under `/api/external`.

## Token model

- Each user can have one active API token.
- Tokens are opaque secrets generated with `crypto.randomBytes(32)`.
- The raw token is only returned when it is created or rotated.
- The database stores only the SHA-256 hash, prefix, last four characters, creation time, last-used time, and revocation time.
- Rotation immediately invalidates the previous token.
- Revocation clears the stored hash and disables external access.

## ChatGPT Action setup

1. In Ristak, go to `Configuración > Cuenta > API para ChatGPT`.
2. Generate or rotate the token and copy it immediately.
3. Use this schema URL in the GPT Action editor:

   ```text
   https://YOUR_RENDER_DOMAIN/api/external/openapi.json
   ```

4. Set authentication to API Key / Bearer and paste the user token.
5. Test with:

   ```http
   GET /api/external/me
   Authorization: Bearer ristak_live_...
   ```

## Available external endpoints

- `GET /api/external/me`
- `GET /api/external/dashboard/metrics`
- `GET /api/external/dashboard/funnel`
- `GET /api/external/dashboard/traffic-sources`
- `GET /api/external/reports/summary`
- `GET /api/external/reports/metrics`
- `GET /api/external/reports/contacts`
- `GET /api/external/reports/payments`
- `GET /api/external/reports/campaigns`
- `GET /api/external/reports/contacts/list`
- `GET /api/external/reports/transactions`
- `GET /api/external/contacts`
- `GET /api/external/contacts/search`
- `GET /api/external/contacts/{id}`
- `GET /api/external/contacts/{id}/journey`
- `GET /api/external/transactions`
- `GET /api/external/transactions/stats`
- `GET /api/external/transactions/summary`
- `GET /api/external/transactions/{id}`

## Render notes

- Keep HTTPS enabled.
- Set a strong `JWT_SECRET`; the web session still uses JWT.
- Never put generated API tokens in logs, build env vars, docs, screenshots, or GitHub issues.
- If a token leaks, rotate it from `Configuración > Cuenta`.
