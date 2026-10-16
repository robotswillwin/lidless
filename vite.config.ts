import { writeFile } from 'node:fs/promises';
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

/** On the dev server, the look panel's Save writes the look as public/assets/look.json: flat numbers only. */
function lookSave(): Plugin {
  return {
    name: 'lidless-look-save',
    configureServer(server) {
      server.middlewares.use('/__look', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end('POST the look as JSON'); return; }
        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk; if (body.length > 100_000) req.destroy(); });
        req.on('end', () => {
          try {
            const data = JSON.parse(body) as Record<string, unknown>;
            const look = Object.fromEntries(Object.entries(data).filter(([k, v]) => /^[a-zA-Z]{1,40}$/.test(k) && typeof v === 'number' && Number.isFinite(v)));
            if (!Object.keys(look).length) throw new Error('no settings in the request');
            writeFile(`${server.config.publicDir}/assets/look.json`, JSON.stringify(look, null, 2) + '\n').then(
              () => { res.statusCode = 200; res.end('saved'); },
              (err: Error) => { res.statusCode = 500; res.end(err.message); },
            );
          } catch (err) {
            res.statusCode = 400;
            res.end(err instanceof Error ? err.message : String(err));
          }
        });
      });
    },
  };
}

// Relative base so the same build runs from a subpath, from file:// in tests, and inside Capacitor and Tauri.
export default defineConfig({
  base: './',
  plugins: [ink(), assetWatch(), lookSave()],
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    rolldownOptions: { input: { main: 'index.html', bench: 'bench.html' } },
  },
});
