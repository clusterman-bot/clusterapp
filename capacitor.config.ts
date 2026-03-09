import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.clusterapp',
  appName: 'clusterapp',
  webDir: 'dist',
  server: {
    url: 'https://9e54efec-8b5b-434e-9487-4d4ec94f20d4.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
};

export default config;
