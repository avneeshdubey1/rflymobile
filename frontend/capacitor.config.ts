import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rfly.operations.staging',
  appName: 'RFLY Operations',
  webDir: 'dist',
  server: {
    // Staging internal address — VPN required.
    // Production builds must use HTTPS and must remove this cleartext setting.
    url: 'http://172.20.96.10:8089',
    cleartext: true,
  },
  android: {
    minSdkVersion: 26,
    backgroundColor: '#1A2B44',
  },
};

export default config;
