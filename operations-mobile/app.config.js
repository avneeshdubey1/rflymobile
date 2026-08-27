module.exports = ({ config }) => {
  const isProd = process.env.APP_ENV === 'production';
  const isStaging = process.env.APP_ENV === 'staging';

  let packageId = 'com.rfly.operations.dev';
  let appName = 'Operations (Dev)';

  if (isProd) {
    packageId = 'com.rfly.operations';
    appName = 'RFLY Operations';
  } else if (isStaging) {
    packageId = 'com.rfly.operations.staging';
    appName = 'Operations (Staging)';
  }

  // Ensure API URL fails closed on physical builds
  const apiUrl = process.env.EXPO_PUBLIC_OC_API_URL;
  if (!apiUrl && (isProd || isStaging)) {
    throw new Error('EXPO_PUBLIC_OC_API_URL must be defined for staging and production builds.');
  }
  if (isStaging && apiUrl !== 'http://172.20.96.10:8089') {
    throw new Error('The staging Operations app must target the VPN-only staging endpoint.');
  }
  if (isProd && (!apiUrl || !apiUrl.startsWith('https://'))) {
    throw new Error('The production Operations app requires an HTTPS API URL.');
  }

  return {
    ...config,
    name: appName,
    slug: 'rfly-operations-companion',
    version: '1.0.0',
    scheme: 'rfly-operations',
    icon: '../frontend/src/assets/logo.png',
    orientation: 'portrait',
    userInterfaceStyle: 'light',
    splash: {
      image: '../frontend/src/assets/logo.png',
      resizeMode: 'contain',
      backgroundColor: '#F7F8FA'
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: packageId
    },
    android: {
      package: packageId,
      adaptiveIcon: {
        foregroundImage: '../frontend/src/assets/logo.png',
        backgroundColor: '#F7F8FA'
      },
      permissions: ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION'],
      blockedPermissions: [
        'android.permission.ACCESS_BACKGROUND_LOCATION',
        'android.permission.FOREGROUND_SERVICE_LOCATION',
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
        'android.permission.SYSTEM_ALERT_WINDOW'
      ]
    },
    extra: {
      environment: isProd ? 'production' : isStaging ? 'staging' : 'development',
      apiUrl
    },
    plugins: [
      'expo-secure-store',
      'expo-notifications',
      ['expo-build-properties', {
        android: {
          usesCleartextTraffic: !isProd
        }
      }],
      ['expo-location', {
        locationWhenInUsePermission: 'RFLY Operations uses your location only while you choose a farm location for an active intake form.',
        isAndroidBackgroundLocationEnabled: false,
        isAndroidForegroundServiceEnabled: false
      }]
    ]
  };
};
