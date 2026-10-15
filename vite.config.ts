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

/** Tell open pages which files under public/assets changed, so the asset bench reloads a rebuilt sprite. */
function assetWatch(): Plugin {
  return {
    name: 'lidless-asset-watch',
    configureServer(server) {
      const dir = `${server.config.publicDir.replace(/\\/g, '/')}/assets/`;
      const changed = new Set<string>();
      let timer: ReturnType<typeof setTimeout> | undefined;
      const notify = (file: string) => {
        const f = file.replace(/\\/g, '/');
        if (!f.startsWith(dir)) return;
        changed.add(f.slice(dir.length));
        // a build writes several maps in a row: wait until it is quiet, then send them all at once
        clearTimeout(timer);
        timer = setTimeout(() => {
          server.ws.send({ type: 'custom', event: 'lidless:asset', data: { files: [...changed] } });
          changed.clear();
        }, 150);
      };
      server.watcher.on('change', notify);
      server.watcher.on('add', notify);
    },
  };
}

// Relative base so the same build runs from a subpath, from file:// in tests, and inside Capacitor and Tauri.
export default defineConfig({
  base: './',
  plugins: [ink(), assetWatch()],
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    rolldownOptions: { input: { main: 'index.html', bench: 'bench.html' } },
  },
});
