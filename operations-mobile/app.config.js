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
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  if (!apiUrl && (isProd || isStaging)) {
    throw new Error('EXPO_PUBLIC_API_URL must be defined for staging and production builds.');
  }

  return {
    ...config,
    name: appName,
    slug: 'rfly-operations-companion',
    version: '1.0.0',
    orientation: 'portrait',
    userInterfaceStyle: 'light',
    ios: {
      supportsTablet: true,
      bundleIdentifier: packageId
    },
    android: {
      package: packageId,
      permissions: []
    }
  };
};
