import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import dotenv from 'dotenv'
import { join } from 'path'
import { PluginOption } from 'vite'
import { createSvgIconsPlugin } from 'vite-plugin-svg-icons'
import { visualizer } from 'rollup-plugin-visualizer'
import { VitePWA } from 'vite-plugin-pwa'
// defineConfig from vitest/config = vite's defineConfig + `test` typing (vitest 4+)
import { defineConfig } from 'vitest/config'
import filenamesToType from './vitePluginFilenamesToType'
import { appName } from './utils/const'
import rootPackage from '../../package.json'
import tauriPackage from '../tauri/package.json'

dotenv.config({ path: join(__dirname, '../../.env') })
const IS_ELECTRON = process.env.IS_ELECTRON
const IS_TAURI = process.env.IS_TAURI === 'yes'
const ELECTRON_DEV_NETEASE_API_PORT = Number(process.env.ELECTRON_DEV_NETEASE_API_PORT || 30001)
const ELECTRON_WEB_SERVER_PORT = Number(process.env.ELECTRON_WEB_SERVER_PORT || 42710)

/**
 * @see https://vitejs.dev/config/
 */
export default defineConfig({
  // clearScreen: IS_ELECTRON ? false : true,
  clearScreen: false,
  mode: process.env.NODE_ENV,
  root: './',
  base: '/',
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(
      IS_TAURI ? tauriPackage.version : rootPackage.version
    ),
  },
  resolve: {
    alias: {
      '@': join(__dirname, '..'),
      'hls.js': 'hls.js/dist/hls.min.js',
    },
  },
  plugins: [
    tailwindcss(),
    !IS_TAURI
      ? (visualizer({
          emitFile: true,
          filename: 'stats.html',
        }) as PluginOption)
      : undefined,
    react(),
    filenamesToType([
      {
        dictionary: './assets/icons',
        typeFile: './components/Icon/iconNamesType.ts',
      },
    ]),

    /**
     * @see https://vite-plugin-pwa.netlify.app/guide/generate.html
     */
    !IS_ELECTRON && !IS_TAURI
      ? VitePWA({
          registerType: 'autoUpdate',
          manifest: {
            name: appName,
            short_name: appName,
            description: 'A third-party NetEase Cloud Music player for desktop and web',
            theme_color: '#000',
            icons: [
              {
                src: 'pwa-192x192.png',
                sizes: '192x192',
                type: 'image/png',
              },
              {
                src: 'pwa-512x512.png',
                sizes: '512x512',
                type: 'image/png',
              },
              {
                src: 'pwa-512x512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any maskable',
              },
            ],
          },
        })
      : undefined,

    /**
     * @see https://github.com/vbenjs/vite-plugin-svg-icons
     */
    createSvgIconsPlugin({
      iconDirs: [join(__dirname, './assets/icons')],
      symbolId: 'icon-[name]',
    }),
  ],
  build: {
    // 'modules' alias was removed in vite 7; 'es2020' is its equivalent
    // (chrome87 / firefox78 / safari14 — browsers with native ESM support).
    target: IS_ELECTRON ? 'esnext' : 'es2020',
    sourcemap: !IS_TAURI || process.env.TAURI_ENV_DEBUG === 'true',
    outDir: IS_TAURI ? './dist-tauri' : './dist',
    emptyOutDir: true,
    rollupOptions: {
      plugins: [],
    },
  },
  server: {
    host: IS_TAURI ? '127.0.0.1' : undefined,
    port: IS_TAURI ? 1420 : ELECTRON_WEB_SERVER_PORT,
    strictPort: !!IS_ELECTRON || IS_TAURI,
    proxy: {
      '/netease/': {
        target: `http://127.0.0.1:${ELECTRON_DEV_NETEASE_API_PORT}`,
        changeOrigin: true,
        rewrite: path => (IS_ELECTRON ? path : path.replace(/^\/netease/, '')),
      },
      '/r3playx/': {
        target: `http://127.0.0.1:${ELECTRON_DEV_NETEASE_API_PORT}`,
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: ELECTRON_WEB_SERVER_PORT,
  },
  test: {
    environment: 'jsdom',
  },
})
