# Security Notes

## Required deployment settings

- Set `CORS_ORIGINS` on the API to the exact frontend origin, for example `https://jdnclinic.vercel.app`.
- Use a long random `NURSE_TOKEN` value. At least 32 characters is recommended.
- Keep `SUPABASE_SERVICE_ROLE_KEY` only on the API service. Never expose it in the frontend.
- Create the `CLINIC_IMAGES_BUCKET` bucket in Supabase intentionally. The API no longer creates public buckets automatically.

## Secret hygiene

The repository now ignores `.env` files and `node_modules`. If real secrets were already committed, rotate these values in Supabase and your hosting provider:

- `SUPABASE_SERVICE_ROLE_KEY`
- `NURSE_PASSWORD`
- `NURSE_TOKEN`

Removing a secret from the latest commit does not remove it from Git history.
