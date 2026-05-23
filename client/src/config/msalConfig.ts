import { type Configuration, LogLevel } from '@azure/msal-browser'

const authority = (import.meta.env.VITE_ENTRA_AUTHORITY as string | undefined) ?? ''
const clientId  = (import.meta.env.VITE_ENTRA_CLIENT_ID  as string | undefined) ?? ''

function knownAuthorities(url: string): string[] {
  try { return [new URL(url).hostname] } catch { return [] }
}

export const msalConfig: Configuration = {
  auth: {
    clientId,
    authority,
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
    knownAuthorities: knownAuthorities(authority),
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      logLevel: import.meta.env.DEV ? LogLevel.Warning : LogLevel.Error,
      loggerCallback: (_level, message) => console.log(`[MSAL] ${message}`),
    },
  },
}

const scopeString = (import.meta.env.VITE_ENTRA_SCOPES as string | undefined) ?? 'openid offline_access'

export const loginRequest = {
  scopes: scopeString.split(' ').filter(Boolean),
}
