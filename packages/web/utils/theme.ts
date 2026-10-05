import settings from '@/web/states/settings'

export const changeTheme = (theme: 'light' | 'dark') => {
  document.body.setAttribute('class', theme)
  if (!window.env?.isElectron) {
    document.documentElement.style.background = theme === 'dark' ? '#000' : '#fff'
  }
}

export const getTheme = () => {
  return document.body.getAttribute('class')
}

export const changeAccentColor = (color: string) => {
  document.body.setAttribute('data-accent-color', color)
}

changeTheme(settings.theme === 'light' ? 'light' : 'dark')
changeAccentColor(settings.accentColor)
