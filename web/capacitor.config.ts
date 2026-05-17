import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.annajah.smartcampus',
  appName: 'Smart Campus',
  webDir: 'build',

  server: {
    cleartext: true,
  },

  android: {
    allowMixedContent: true,
  },
};

export default config;