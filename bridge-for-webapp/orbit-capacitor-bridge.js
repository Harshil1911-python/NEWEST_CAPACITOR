/**
 * OrbitBills — Capacitor native bridge
 * ------------------------------------
 * Drop this file into your web app repo (e.g. next to orbit-native.js) and
 * include it with:  <script src="orbit-capacitor-bridge.js"></script>
 *
 * How it works:
 * The Capacitor Android wrapper loads your LIVE site (orbitbillsphoneapp.onrender.com)
 * directly inside its WebView (see capacitor.config.json -> server.url). Capacitor
 * still injects its JS runtime into that WebView, so `window.Capacitor` and
 * `window.Capacitor.Plugins` are available on your existing pages with ZERO
 * changes to your backend or hosting — you don't need to bundle your site
 * inside the apk.
 *
 * This file exposes a small `OrbitNative` helper object that:
 *   - Uses native Capacitor plugins (Camera, Share, LocalNotifications) when
 *     running inside the Android app.
 *   - Falls back to normal web APIs (input[type=file], navigator.share,
 *     Notification API) when running in a regular browser.
 *
 * Wire your existing buttons in orbit-native.js / billing.html / etc. to call
 * these functions instead of (or in addition to) the browser APIs.
 */

(function (window) {
  const isNativeApp = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

  function getPlugin(name) {
    return isNativeApp && window.Capacitor.Plugins ? window.Capacitor.Plugins[name] : null;
  }

  const OrbitNative = {
    isNativeApp,

    /**
     * Take a photo or pick one from gallery.
     * Returns a Promise<string> resolving to a base64 data URL (usable directly
     * in <img src="...">, or convert to Blob for upload).
     */
    async takePhoto({ allowEditing = false, source = "PROMPT" } = {}) {
      const Camera = getPlugin("Camera");
      if (Camera) {
        const photo = await Camera.getPhoto({
          quality: 85,
          allowEditing,
          resultType: "dataUrl", // 'dataUrl' | 'uri' | 'base64'
          source, // 'CAMERA' | 'PHOTOS' | 'PROMPT'
        });
        return photo.dataUrl;
      }
      // Web fallback: trigger a hidden file input with capture attribute
      return new Promise((resolve, reject) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.capture = "environment";
        input.onchange = () => {
          const file = input.files && input.files[0];
          if (!file) return reject(new Error("No photo selected"));
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        };
        input.click();
      });
    },

    /** Request camera permission explicitly (native only; browsers prompt automatically). */
    async requestCameraPermission() {
      const Camera = getPlugin("Camera");
      if (!Camera) return { camera: "granted" }; // browser handles its own prompt
      return Camera.requestPermissions({ permissions: ["camera"] });
    },

    /**
     * Share text / a URL / an invoice PDF / an image to WhatsApp and other
     * installed apps via the native Android share sheet.
     * `filePath` (optional) should be a `file://` URI (e.g. from Filesystem
     * plugin) if sharing a generated PDF or image.
     */
    async share({ title, text, url, filePath } = {}) {
      const Share = getPlugin("Share");
      if (Share) {
        return Share.share({
          title,
          text,
          url,
          files: filePath ? [filePath] : undefined,
          dialogTitle: "Share via",
        });
      }
      // Web fallback
      if (navigator.share) {
        return navigator.share({ title, text, url });
      }
      // Last-resort fallback: open WhatsApp web/deep link with text
      const waText = encodeURIComponent([text, url].filter(Boolean).join(" "));
      window.open(`https://wa.me/?text=${waText}`, "_blank");
    },

    /**
     * Save a base64/data-URL file (e.g. invoice PDF) to the device and return
     * a native file:// URI that can be passed to `share()`.
     */
    async saveFileForSharing(base64Data, fileName) {
      const Filesystem = getPlugin("Filesystem");
      if (!Filesystem) return null; // web builds can use a normal <a download> instead
      const cleanBase64 = base64Data.includes(",") ? base64Data.split(",")[1] : base64Data;
      const result = await Filesystem.writeFile({
        path: fileName,
        data: cleanBase64,
        directory: "CACHE",
      });
      return result.uri;
    },

    /** Schedule a local reminder/notification (e.g. "Invoice due tomorrow"). */
    async scheduleNotification({ id, title, body, at }) {
      const LocalNotifications = getPlugin("LocalNotifications");
      if (!LocalNotifications) {
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification(title, { body });
        }
        return;
      }
      const perm = await LocalNotifications.checkPermissions();
      if (perm.display !== "granted") {
        await LocalNotifications.requestPermissions();
      }
      await LocalNotifications.schedule({
        notifications: [
          {
            id: id || Date.now() % 100000,
            title,
            body,
            schedule: at ? { at: new Date(at) } : undefined,
          },
        ],
      });
    },

    /** Ask for notification permission up front (call once on app start / login). */
    async requestNotificationPermission() {
      const LocalNotifications = getPlugin("LocalNotifications");
      if (LocalNotifications) return LocalNotifications.requestPermissions();
      if ("Notification" in window) return Notification.requestPermission();
    },
  };

  window.OrbitNative = OrbitNative;
})(window);
