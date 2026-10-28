// Builds src/client/index.jsx into lib/client.js in dsh's browser module-loader format:
//   window.__ModuleLoader__.load({ id, factory: (require) => module.exports })
// Shared modules (react, @deepseek-ai/*) stay external and are resolved by the platform loader.
import { build } from 'esbuild'
import { readFileSync, writeFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
const result = await build({
  entryPoints: [new URL('./src/client/index.jsx', import.meta.url).pathname],
  bundle: true, write: false, format: 'cjs', platform: 'browser', target: 'es2020',
  jsx: 'automatic', legalComments: 'none', charset: 'utf8',
  external: ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', '@deepseek-ai/*', 'zod'],
})
const body = result.outputFiles[0].text
const out = `window.__ModuleLoader__.load({
\tid: ${JSON.stringify(pkg.name)},
\tfactory: (require) => {
\t\tvar module = { exports: {} };
\t\tvar exports = module.exports;
${body}
\t\tObject.defineProperty(module.exports, Symbol.toStringTag, { value: "Module" });
\t\treturn module.exports;
\t}
});
`
writeFileSync(new URL('./lib/client.js', import.meta.url), out)
console.log(`lib/client.js written (${out.length} bytes)`)
