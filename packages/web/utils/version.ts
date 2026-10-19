import rootPackage from '../../../package.json'

// Vite supplies the desktop channel's version without changing Electron/web.
export const appVersion = import.meta.env.VITE_APP_VERSION || rootPackage.version
