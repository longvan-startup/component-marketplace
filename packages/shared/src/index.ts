/**
 * @marketplace/shared — shared constants, utilities & API contracts.
 * Contracts (`src/contracts/`) are the single source of truth for API
 * payloads consumed by BOTH apps; apps never redeclare these shapes.
 */

export * from './contracts/catalog'
export * from './contracts/common'

export const APP_NAME = 'component-marketplace'
export const APP_VERSION = '0.1.0'

export interface AppInfo {
  name: string
  version: string
}

export function getAppInfo(): AppInfo {
  return { name: APP_NAME, version: APP_VERSION }
}
