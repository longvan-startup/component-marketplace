/**
 * @marketplace/shared — shared constants & utilities.
 * Skeleton only: KHÔNG chứa business logic.
 */

export const APP_NAME = 'component-marketplace'
export const APP_VERSION = '0.1.0'

export interface AppInfo {
  name: string
  version: string
}

export function getAppInfo(): AppInfo {
  return { name: APP_NAME, version: APP_VERSION }
}
