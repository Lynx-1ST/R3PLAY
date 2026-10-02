import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import zhCN from './locales/zh-cn.json'
import enUS from './locales/en-us.json'
import viVN from './locales/vi-vn.json'

export const supportedLanguages = ['en-US', 'vi-VN', 'zh-CN'] as const
export type SupportedLanguage = typeof supportedLanguages[number]

declare module 'react-i18next' {
  interface CustomTypeOptions {
    returnNull: false
    resources: {
      'en-US': typeof enUS
      'zh-CN': typeof enUS
      'vi-VN': typeof enUS
    }
  }
}

export const getInitLanguage = () => {
  // Get language from settings
  try {
    const settings = JSON.parse(localStorage.getItem('settings') || '{}')
    if (supportedLanguages.includes(settings.language)) {
      return settings.language
    }
  } catch (e) {
    // ignore
  }

  // Get language from browser
  const browserLanguage = navigator.language.toLowerCase()
  if (browserLanguage.startsWith('zh')) {
    return 'zh-CN'
  }
  if (browserLanguage.startsWith('vi')) {
    return 'vi-VN'
  }

  // Fallback to English
  return 'en-US'
}

const initialLanguage = getInitLanguage()
document.documentElement.lang = initialLanguage
i18next.on('languageChanged', language => {
  document.documentElement.lang = language
})

i18next.use(initReactI18next).init({
  returnNull: false,
  resources: {
    'en-US': { translation: enUS },
    'zh-CN': { translation: zhCN },
    'vi-VN': { translation: viVN },
  },
  lng: initialLanguage,
  fallbackLng: 'en-US',
  supportedLngs: supportedLanguages,
  interpolation: {
    escapeValue: false,
  },
})

export default i18next
