import type { ExpoConfig } from 'expo/config'

const config: ExpoConfig = {
  name: 'Luva UI',
  slug: 'luva-ui',
  scheme: 'luva',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'ui.luva.marketplace',
  },
  android: {
    package: 'ui.luva.marketplace',
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: './assets/favicon.png',
  },
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000',
  },
  plugins: ['expo-secure-store'],
}

export default config
