declare module 'wait-on' {
  interface WaitOnOptions {
    resources: string[]
    timeout?: number
    [key: string]: unknown
  }

  type WaitOnCallback = (err?: Error) => void

  function waitOn(options: WaitOnOptions, callback?: WaitOnCallback): Promise<void> | void
  export default waitOn
}
