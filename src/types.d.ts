/** .ink files are compiled to Ink's JSON format by the plugin in vite.config.ts. */
declare module '*.ink' {
  const json: string;
  export default json;
}
