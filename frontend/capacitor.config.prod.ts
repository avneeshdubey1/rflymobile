import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rfly.operations.staging',
  appName: 'RFLY Operations',
  webDir: 'dist',
  server: {
    // Production server — HTTP only until DEC-12 (domain + TLS) is resolved.
    // REMOVE cleartext and switch to HTTPS when a domain is provisioned.
    url: 'http://103.238.230.152:8088',
    cleartext: true,
  },
  android: {
    minSdkVersion: 26,
    backgroundColor: '#1A2B44',
  },
};

export default config;
