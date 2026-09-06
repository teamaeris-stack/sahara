import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sahara.disaster',
  appName: 'Sahara',
  webDir: 'mobile-dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
