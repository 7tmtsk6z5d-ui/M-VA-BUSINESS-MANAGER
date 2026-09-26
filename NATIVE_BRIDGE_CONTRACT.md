# MŌVA 4.2 Native Bridge Contract

The web app never assumes the native bridge exists.

Supported Android hooks:
- `MovaNative.isAndroidShell`
- `MovaNative.openAuthUrl(JSON.stringify({url}))`
- `MovaNative.purchasePro(JSON.stringify({productId}))`
- `MovaNative.acknowledgeProPurchase(JSON.stringify({purchaseToken}))`
- `MovaNative.setDeviceRole(JSON.stringify({role}))`
- `MovaNative.openNotificationAccess("")`
- `MovaNative.secureStore(JSON.stringify({action,key,value}))`
- `MovaNative.announcePayment(JSON.stringify({text}))`
- `MovaNative.shareReceipt(JSON.stringify({text}))`
- `MovaNative.printReceipt(JSON.stringify({html}))`

The Android shell opens OAuth outside the WebView and returns through `mova://auth/callback`.

The web application does not read private storage of another payment application. Notification parsing is a user-granted convenience signal; official payment verification must come from a provider-side API/webhook.
