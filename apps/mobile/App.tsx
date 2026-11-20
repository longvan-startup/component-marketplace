import { APP_NAME } from '@marketplace/shared'
import { StatusBar } from 'expo-status-bar'
import { StyleSheet, Text, View } from 'react-native'

import { DEV_API_BASE_URL, resolveApiBaseUrl } from './src/api-base'

const apiBaseUrl = resolveApiBaseUrl(process.env.EXPO_PUBLIC_API_URL ?? DEV_API_BASE_URL)

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{APP_NAME}</Text>
      <Text style={styles.body}>Catalog client. API {apiBaseUrl}</Text>
      <StatusBar style="auto" />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  body: {
    fontSize: 14,
    textAlign: 'center',
  },
})
