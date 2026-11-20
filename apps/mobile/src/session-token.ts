import * as SecureStore from 'expo-secure-store'

const SESSION_TOKEN_KEY = 'marketplace.session'

export function saveSessionToken(token: string): Promise<void> {
  return SecureStore.setItemAsync(SESSION_TOKEN_KEY, token)
}

export function readSessionToken(): Promise<string | null> {
  return SecureStore.getItemAsync(SESSION_TOKEN_KEY)
}

export function clearSessionToken(): Promise<void> {
  return SecureStore.deleteItemAsync(SESSION_TOKEN_KEY)
}
