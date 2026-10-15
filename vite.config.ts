import { defineConfig, type Plugin } from 'vite';
import { Compiler } from 'inkjs/full';

/** Compile .ink dialogue to JSON at build time, so the game ships only the small Ink runtime. */
function ink(): Plugin {
  return {
    name: 'lidless-ink',
    transform(source, id) {
      if (!id.endsWith('.ink')) return null;
      const compiler = new Compiler(source);
      const story = compiler.Compile();
      if (compiler.errors.length) this.error(`${id}\n${compiler.errors.join('\n')}`);
      for (const w of compiler.warnings) this.warn(`${id}: ${w}`);
      return { code: `export default ${JSON.stringify(story.ToJson())};`, map: null };
    },
  };
}

// Relative base so the same build runs from a subpath, from file:// in tests, and inside Capacitor and Tauri.
export default defineConfig({
  base: './',
  plugins: [ink()],
  build: { target: 'es2022', assetsInlineLimit: 0 },
});
