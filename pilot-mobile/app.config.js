const variants = Object.freeze({
  development: Object.freeze({
    name: "RFLY Pilot (Dev)",
    package: "com.rfly.pilot.dev",
    cleartext: true,
  }),
  staging: Object.freeze({
    name: "RFLY Pilot (Staging)",
    package: "com.rfly.pilot.staging",
    cleartext: true,
  }),
  "production-internal-http": Object.freeze({
    name: "RFLY Pilot",
    package: "com.rfly.pilot",
    cleartext: true,
  }),
  production: Object.freeze({
    name: "RFLY Pilot",
    package: "com.rfly.pilot",
    cleartext: false,
  }),
});

const variantName = process.env.RFLY_APP_VARIANT || "development";
const variant = variants[variantName];

if (!variant) {
  throw new Error(`Unsupported RFLY_APP_VARIANT: ${variantName}`);
}

const apiUrl = process.env.EXPO_PUBLIC_API_URL;
if (variantName === "staging" && apiUrl !== "http://172.20.96.10:8089") {
  throw new Error("The staging APK must target http://172.20.96.10:8089");
}
if (
  variantName === "production-internal-http" &&
  apiUrl !== "http://103.238.230.152:8088"
) {
  throw new Error(
    "The internal HTTP production APK must target http://103.238.230.152:8088",
  );
}
if (
  variantName === "production" &&
  (!apiUrl || !apiUrl.startsWith("https://"))
) {
  throw new Error("The production Pilot app requires an HTTPS API URL");
}

module.exports = {
  expo: {
    name: variant.name,
    slug: "rfly-pilot",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    scheme: "rfly-pilot",
    ios: {
      supportsTablet: true,
      bundleIdentifier: variant.package,
    },
    android: {
      versionCode: 2,
      blockedPermissions: [
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE",
        "android.permission.SYSTEM_ALERT_WINDOW",
      ],
      adaptiveIcon: {
        backgroundColor: "#E6F4FE",
        foregroundImage: "./assets/android-icon-foreground.png",
        backgroundImage: "./assets/android-icon-background.png",
        monochromeImage: "./assets/android-icon-monochrome.png",
      },
      predictiveBackGestureEnabled: false,
      package: variant.package,
    },
    web: {
      favicon: "./assets/favicon.png",
    },
    extra: {
      environment: variantName,
    },
    plugins: [
      "expo-router",
      "expo-status-bar",
      "expo-secure-store",
      "expo-sqlite",
      [
        "expo-build-properties",
        {
          android: {
            usesCleartextTraffic: variant.cleartext,
          },
        },
      ],
      [
        "expo-location",
        {
          locationWhenInUsePermission:
            "RFLY Pilot uses your location only while this app is open and you are assigned to an accepted or active mission.",
          isAndroidBackgroundLocationEnabled: false,
          isAndroidForegroundServiceEnabled: false,
        },
      ],
    ],
  },
};
