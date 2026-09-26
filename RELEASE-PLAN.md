# MŌVA 4.2.5 — Final Release Path

1. Push this package to the existing GitHub repository `7tmtsk6z5d-ui/M-VA-BUSINESS-MANAGER`.
2. GitHub Pages serves the production URL:
   https://7tmtsk6z5d-ui.github.io/M-VA-BUSINESS-MANAGER/
3. Supabase URL Configuration:
   - Site URL: the production URL above.
   - Redirect URLs: the production URL above and `mova://auth/callback`.
4. Google Cloud OAuth Client:
   - Authorized redirect URI: `https://wufjamnqlwrvbxsnvpsa.supabase.co/auth/v1/callback`
5. Supabase Google Provider:
   - Enable Google.
   - Client ID and Client Secret are entered only in Supabase provider settings.
6. Android:
   - Run GitHub Actions workflow `MŌVA Android APK`.
   - Download the generated debug APK artifact and install it on Android.

SPCK is a source editor for this project; it is not the Google OAuth production runtime.
