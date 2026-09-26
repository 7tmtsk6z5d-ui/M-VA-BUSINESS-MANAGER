/* MŌVA — RUNTIME CONFIG
 * Public client configuration only.
 * NEVER put sb_secret_..., service_role, or a Google Client Secret here.
 */
window.MOVA_CONFIG = Object.freeze({
  name: "MŌVA",
  version: "4.2.5-final",
  packageId: "id.mova.business",

  webAppUrl: "https://7tmtsk6z5d-ui.github.io/M-VA-BUSINESS-MANAGER/",
  androidAuthCallback: "mova://auth/callback",

  supabaseUrl: "https://wufjamnqlwrvbxsnvpsa.supabase.co",
  supabasePublishableKey: "sb_publishable_vVBwFpi7OC1uhkwWb-EPUw_4sDRSiU8",

  // Google Client ID is metadata for OAuth configuration only.
  // The Google client secret MUST remain in Supabase/Google configuration.
  googleClientId: "439067729305-301tvvcdafsu59t934sc0u82ipjh7j09.apps.googleusercontent.com",

  mission: "Kami hadir untuk membantu Anda mengontrol keuangan bisnis — transaksi, stok, dan arus uang dalam satu tempat.",
  proMonthly: "mova_pro_monthly",
  proYearly: "mova_pro_yearly",
  supabaseJsVersion: "2.117.2"
});
