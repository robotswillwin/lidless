import { readFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { Compiler, CompilerOptions } from 'inkjs/full';

/**
 * Compile .ink dialogue to JSON at build time, so the game ships only the small Ink runtime. A story can INCLUDE other
 * .ink files, by paths relative to it; on the dev server, changing one of them reloads the story that includes it.
 */
function ink(): Plugin {
  const includedBy = new Map<string, Set<string>>();
  return {
    name: 'lidless-ink',
    configureServer(server) {
      server.watcher.on('change', (file) => {
        for (const story of includedBy.get(file) ?? []) for (const mod of server.moduleGraph.getModulesByFile(story) ?? []) void server.reloadModule(mod);
      });
    },
    transform(source, id) {
      if (!id.endsWith('.ink')) return null;
      const dir = dirname(id), included: string[] = [];
      const fileHandler = {
        ResolveInkFilename: (name: string) => resolve(dir, name),
        LoadInkFileContents: (file: string) => { included.push(file); return readFileSync(file, 'utf-8'); },
      };
      const compiler = new Compiler(source, new CompilerOptions(id, [], false, null, fileHandler));
      const story = compiler.Compile();
      for (const file of included) {
        this.addWatchFile(file);
        if (!includedBy.has(file)) includedBy.set(file, new Set());
        includedBy.get(file)!.add(id);
      }
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

/**
 * Tunnels to the dev server, to try the game on a phone: ngrok gives a new address each time, so every address under its
 * domains is let in (a leading dot takes in every subdomain).
 */
const TUNNELS = ['.ngrok-free.app', '.ngrok-free.dev', '.ngrok.app', '.ngrok.dev', '.ngrok.io'];

/**
 * The save endpoints write files in the project, so they only take requests made on this machine: through a tunnel,
 * anyone with its address could otherwise change the game's files.
 */
function onlyHere(req: IncomingMessage, res: ServerResponse): boolean {
  if (/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(req.headers.host ?? '')) return true;
  res.statusCode = 403;
  res.end('Saving works on this machine only (localhost), not through a tunnel.');
  return false;
}

/** On the dev server, the look panel's Save writes the look as public/assets/look.json: flat numbers only. */
function lookSave(): Plugin {
  return {
    name: 'lidless-look-save',
    configureServer(server) {
      server.middlewares.use('/__look', (req, res) => {
        if (!onlyHere(req, res)) return;
        if (req.method !== 'POST') { res.statusCode = 405; res.end('POST the look as JSON'); return; }
        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk; if (body.length > 100_000) req.destroy(); });
        req.on('end', () => {
          try {
            const data = JSON.parse(body) as Record<string, unknown>;
            // the shared settings as numbers, and the ones split per view under "raw" and "concierge"
            const numbers = (o: unknown) => Object.fromEntries(Object.entries((o && typeof o === 'object' ? o : {}) as Record<string, unknown>).filter(([k, v]) => /^[a-zA-Z]{1,40}$/.test(k) && typeof v === 'number' && Number.isFinite(v)));
            const look: Record<string, unknown> = numbers(data);
            if (!Object.keys(look).length) throw new Error('no settings in the request');
            for (const view of ['raw', 'concierge']) { const split = numbers(data[view]); if (Object.keys(split).length) look[view] = split; }
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

/** On the dev server, the scene editor's Save writes public/assets/scenes/<id>/scene.json and lists a new scene in world.json. */
function sceneSave(): Plugin {
  return {
    name: 'lidless-scene-save',
    configureServer(server) {
      server.middlewares.use('/__scene', (req, res) => {
        if (!onlyHere(req, res)) return;
        const id = new URL(req.url ?? '', 'http://x').searchParams.get('id') ?? '';
        if (req.method !== 'POST' || !/^[a-z0-9][a-z0-9-]{0,39}$/.test(id)) { res.statusCode = 400; res.end('POST a scene to /__scene?id=<id>, the id in lower case letters, digits and dashes'); return; }
        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk; if (body.length > 4_000_000) req.destroy(); });
        req.on('end', async () => {
          try {
            const scene = JSON.parse(body) as Record<string, unknown>;
            if (scene.id !== id || !Array.isArray(scene.layers) || !Array.isArray(scene.lights) || !Array.isArray(scene.hotspots)) throw new Error('that is not a scene file');
            const assets = `${server.config.publicDir}/assets`;
            await mkdir(`${assets}/scenes/${id}`, { recursive: true });
            await writeFile(`${assets}/scenes/${id}/scene.json`, JSON.stringify(scene, null, 1) + '\n');
            const world = JSON.parse(await readFile(`${assets}/world.json`, 'utf8')) as { scenes: string[] };
            if (!world.scenes.includes(id)) { world.scenes.push(id); await writeFile(`${assets}/world.json`, JSON.stringify(world, null, 2) + '\n'); }
            res.statusCode = 200;
            res.end('saved');
          } catch (err) {
            res.statusCode = 400;
            res.end(err instanceof Error ? err.message : String(err));
          }
        });
      });
    },
  };
}

/**
 * On the dev server, the look panel's Save with "This scene" writes the scene's own look settings into its scene file,
 * public/assets/scenes/<id>/scene.json, leaving the rest of the file as it is: flat numbers, and per view under "raw"
 * and "concierge". An empty look takes the scene back to the game's look.
 */
function sceneLookSave(): Plugin {
  return {
    name: 'lidless-scene-look-save',
    configureServer(server) {
      server.middlewares.use('/__scene-look', (req, res) => {
        if (!onlyHere(req, res)) return;
        const q = new URL(req.url ?? '', 'http://x').searchParams, id = q.get('id') ?? '', variant = q.get('variant') ?? '';
        if (req.method !== 'POST' || !/^[a-z0-9][a-z0-9-]{0,39}$/.test(id) || (variant && !/^[a-z0-9][a-z0-9-]{0,39}$/.test(variant))) { res.statusCode = 400; res.end('POST a scene look to /__scene-look?id=<id>[&variant=<variant>]'); return; }
        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk; if (body.length > 100_000) req.destroy(); });
        req.on('end', async () => {
          try {
            const data = JSON.parse(body) as Record<string, unknown>;
            const numbers = (o: unknown) => Object.fromEntries(Object.entries((o && typeof o === 'object' ? o : {}) as Record<string, unknown>).filter(([k, v]) => /^[a-zA-Z]{1,40}$/.test(k) && typeof v === 'number' && Number.isFinite(v)));
            const look: Record<string, unknown> = numbers(data);
            for (const view of ['raw', 'concierge']) { const split = numbers(data[view]); if (Object.keys(split).length) look[view] = split; }
            const file = `${server.config.publicDir}/assets/scenes/${id}/scene.json`;
            const scene = JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>;
            // a variant's settings, over the scene's own, into its variants; the scene's own into its look
            const variants = (scene.variants && typeof scene.variants === 'object' ? scene.variants : {}) as Record<string, Record<string, unknown>>;
            const target = variant ? (variants[variant] ??= {}) : scene;
            if (variant) scene.variants = variants;
            if (Object.keys(look).length) target.look = look;
            else delete target.look;
            await writeFile(file, JSON.stringify(scene, null, 1) + '\n');
            res.statusCode = 200;
            res.end('saved');
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
  server: { allowedHosts: TUNNELS },
  preview: { allowedHosts: TUNNELS },
  plugins: [ink(), assetWatch(), lookSave(), sceneSave(), sceneLookSave()],
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    rolldownOptions: { input: { main: 'index.html', bench: 'bench.html', editor: 'editor.html' } },
  },
});
