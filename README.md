# OrbitBills — Capacitor Android Project

This is a ready-to-build **Capacitor** wrapper that turns your live web app
(`https://orbitbillsphoneapp.onrender.com/`) into a native Android APK.

It does **not** copy/bundle your website's HTML files — instead the app opens
your live Render URL directly inside a native WebView (see `server.url` in
`capacitor.config.json`). This means:

- Every page, route, and feature that already works on the website works in
  the app automatically, with **zero backend changes**.
- Any updates you push to Render show up in the app instantly — no app-store
  rebuild needed for normal web changes.
- The app gains native superpowers on top: **Camera, Notifications, native
  Share sheet (WhatsApp etc.), Filesystem, Network status, in-app Browser,
  Status bar, Splash screen.**

## What's included

```
capacitor.config.json      # points the app at your live Render URL
package.json                # Capacitor core + plugin dependencies
www/                         # minimal placeholder (server.url overrides it)
android/                     # full native Android Studio project
bridge-for-webapp/
  orbit-capacitor-bridge.js  # optional JS helper for your website repo
```

### Plugins installed
| Plugin | Purpose |
|---|---|
| `@capacitor/camera` | Take photos / pick from gallery (e.g. product photos, receipts) |
| `@capacitor/local-notifications` | Local reminders (due invoices, low stock, etc.) |
| `@capacitor/push-notifications` | Push notifications via Firebase (needs your own `google-services.json`, see below) |
| `@capacitor/share` | Native Android share sheet → WhatsApp, Gmail, Drive, etc. |
| `@capacitor/filesystem` | Save generated PDFs/images before sharing |
| `@capacitor/network` | Detect online/offline (useful since your app is IndexedDB/local-first) |
| `@capacitor/app` | Back-button + app-state handling |
| `@capacitor/status-bar`, `@capacitor/splash-screen` | Native look & feel |
| `@capacitor/browser` | Open external links in an in-app browser tab |

Permissions for camera, notifications, storage, and internet are already
declared in `android/app/src/main/AndroidManifest.xml`.

App icon and splash screen were generated from your repo's
`app-icon-512.png` / `splash-boot.png`, using your PWA manifest's brand color
`#0b3d91`.

---

## 1. Build the APK

You need **Node.js 18+**, **Android Studio** (or just the Android SDK +
command-line tools), and a JDK 17. This sandbox cannot compile Android apps
(no Android SDK / no network access to Google's Maven repos), so run these
steps on your own machine or in CI.

```bash
# 1. unzip the project, then:
cd orbitbills-capacitor
npm install

# 2. sync native plugins (safe to re-run any time)
npx cap sync android

# 3a. EASIEST: open in Android Studio and click Run / Build > Build Bundle(s)/APK(s)
npx cap open android

# 3b. OR build from the command line
cd android
./gradlew assembleDebug
# APK will be at: android/app/build/outputs/apk/debug/app-debug.apk

# For a signed release APK:
./gradlew assembleRelease
# then sign + zipalign, or configure a signingConfig in android/app/build.gradle
```

If Android Studio prompts to update Gradle/AGP, accept it — it will just
download the wrapper the first time.

## 2. (Optional) Enable real push notifications

`@capacitor/push-notifications` is installed and permission-declared, but
push requires **your own Firebase project**:

1. Create a Firebase project → Android app with package name
   `com.techserenia.orbitbills`.
2. Download `google-services.json` and place it in `android/app/`.
3. Add the Google services Gradle plugin (Android Studio will offer to do
   this automatically, or see https://firebase.google.com/docs/android/setup).

If you only need local reminders (due dates, low stock alerts, etc.) you
don't need Firebase at all — `@capacitor/local-notifications` works out of
the box.

## 3. Wire native features into your existing website

Because the app loads your live site in a WebView, `window.Capacitor` and
`window.Capacitor.Plugins` are available on your existing pages
automatically — no rebuild of the site needed for the wrapper to work at all.

To actually **use** Camera / Share / Notifications from your web app's
buttons (e.g. in `orbit-native.js`, `billing.html`, `SHARE_FIX.txt` logic),
copy `bridge-for-webapp/orbit-capacitor-bridge.js` into your website repo,
include it via `<script src="orbit-capacitor-bridge.js"></script>`, then
call:

```js
// Take a photo (native camera when in-app, file picker in browser)
const dataUrl = await OrbitNative.takePhoto();

// Share an invoice to WhatsApp / any app
await OrbitNative.share({ title: "Invoice #123", text: "Here is your invoice", url: "https://..." });

// Schedule a reminder
await OrbitNative.scheduleNotification({ title: "Invoice due", body: "Invoice #123 is due tomorrow" });
```

It automatically falls back to normal browser APIs when someone opens the
same site in a regular mobile/desktop browser, so nothing breaks for
non-app users.

## 4. App identity

- **App ID (package name):** `com.techserenia.orbitbills`
- **App name:** OrbitBills

Change these in `capacitor.config.json` and re-run `npx cap sync android`
if you'd like something different — just note that changing the appId after
first install requires uninstalling the old app on test devices.

## 5. Splash screen network delay

Since the app always loads the live Render URL, the first screen the user
sees after the splash is whatever your server returns. If Render's free tier
"cold starts" are slow, you may want to lengthen
`plugins.SplashScreen.launchShowDuration` in `capacitor.config.json`, or add
a lightweight loading page of your own as `server.url`'s initial route.
