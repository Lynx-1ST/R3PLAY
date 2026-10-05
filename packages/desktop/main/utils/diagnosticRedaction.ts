export function redactDiagnosticLine(line: string) {
  if (/cookie|token|secret|password|authorization|session.?key|api.?key/i.test(line))
    return '[Sensitive log entry redacted]'
  return line
    .replace(/https?:\/\/[^\s"'<>]+/gi, '[URL]')
    .replace(/[A-Z]:[\\/][^\r\n"'<>]*/gi, '[local path]')
    .replace(/\/(?:Users|home)\/[^\s"'<>]+/g, '[local path]')
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, '[email]')
    .replace(/[a-z0-9_+-]{24,}/gi, '[identifier]')
    .slice(0, 1200)
}
