import { expect, it } from 'vitest'
import { redactDiagnosticLine } from '../main/utils/diagnosticRedaction'
it('removes credentials, URLs, private paths and email addresses', () => {
  for (const value of [
    'cookie=abc',
    'Authorization: Bearer abc',
    'sessionKey: abc',
    'api_key=abc',
    'password: abc',
  ])
    expect(redactDiagnosticLine(value)).toBe('[Sensitive log entry redacted]')
  const result = redactDiagnosticLine(
    'GET https://example.test/audio?signature=abc for test@example.com C:\\Users\\Lynx\\file.txt'
  )
  expect(result).not.toContain('signature')
  expect(result).not.toContain('Lynx')
  expect(result).not.toContain('test@example.com')
  expect(redactDiagnosticLine('[error] Audio not found')).toContain('Audio not found')
})
