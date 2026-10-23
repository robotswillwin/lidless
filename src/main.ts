// Lidless: boot. Loads the world, the look and the hero, starts a game session (src/game/game.ts) and runs its frames.
// The address can ask for ?new (start over), ?scene=id&spawn=place, ?view=raw, ?variant=rain (the scenes in a variant,
// whatever the story says), ?q=low|medium|high, ?debug (tier and frame rate), and for tests ?t=seconds (a still frame),
// ?cam=x (the camera held there) and ?fast (a story's pauses cut short); ?terminal=id opens an old machine's screen
// (public/assets/terminals/id.json) at once. The title screen shows as it opens, except for an address that asks for a
// scene, a new game or a machine; the player's settings are kept in the browser (game/settings.ts).

import './style.css';
import { loadSprite, setTexelBudget, spriteDefaults } from './engine/assets';
import { loadProjectLook } from './engine/look';
import { loadPresets } from './engine/presets';
import { QUALITY, Renderer, type Tier } from './engine/renderer';
import { Game } from './game/game';
import type { CloseupDef, Item, Notebook } from './game/hud';
import { bindInput } from './game/input';
import type { MessagesFile } from './game/messages';
import type { Replies } from './game/replies';
import { clearSave, loadSave } from './game/save';
import { loadWorld } from './game/scenefile';
import { loadSettings, READING, TEXT_SCALE, type Settings } from './game/settings';
import { showTitle, takeBegin, titleAtStart } from './game/title';
import { waitingEye } from './game/eye';

const params = new URLSearchParams(location.search);
const canvas = document.getElementById('game') as HTMLCanvasElement;
const stats = document.getElementById('stats') as HTMLElement;
const errorBox = document.getElementById('error') as HTMLElement;
// held upright on a phone, the game asks to be turned sideways (style.css), until told to play upright anyway
const turn = document.getElementById('turn');
turn?.querySelector('button')?.addEventListener('click', () => turn.classList.add('dismissed'));
const number = (key: string) => (params.has(key) ? Number(params.get(key)) : null);

function pickTier(): Tier {
  const q = params.get('q');
  if (q === 'low' || q === 'medium' || q === 'high') return q;
  return matchMedia('(pointer: coarse)').matches ? 'medium' : 'high';
}

/** The settings as the game takes them: the graphics tier (the address's ?q first), and whether motion is reduced. */
const tierOf = (s: Settings): Tier => (params.has('q') || s.quality === 'auto' ? pickTier() : s.quality);
const reducedOf = (s: Settings): boolean => (s.motion === 'auto' ? matchMedia('(prefers-reduced-motion: reduce)').matches : s.motion === 'reduced');
// the wait under the game's name, as the page opens: the eye opens while the game loads (with the player's motion setting)
waitingEye(() => (document.documentElement.dataset.motion ?? (reducedOf(loadSettings()) ? 'reduced' : 'full')) === 'reduced')?.play();

async function boot(): Promise<void> {
  if (params.has('new')) clearSave();
  const assets = `${import.meta.env.BASE_URL}assets`;
  let settings = loadSettings();
  const renderer = new Renderer(canvas, QUALITY[tierOf(settings)]), gl = renderer.gl;
  // textures as detailed as the screen shows: a phone, drawing the level at its own size, keeps a quarter of a background
  setTexelBudget(renderer.quality.scale);
  const optional = <T>(file: string, fallback: T) => fetch(`${assets}/${file}`, { cache: 'no-store' }).then((r) => (r.ok ? (r.json() as Promise<T>) : fallback)).catch(() => fallback);
  const [world, projectLook, items, notebook, journal, replies, messages, closeups] = await Promise.all([
    loadWorld(assets), loadProjectLook(assets), optional<Record<string, Item>>('items.json', {}), optional<Notebook>('notebook.json', { pages: [] }),
    optional<Notebook>('journal.json', { pages: [] }), optional<Replies>('replies.json', {}), optional<MessagesFile>('messages.json', { messages: [] }),
    optional<Record<string, CloseupDef>>('closeups.json', {}), loadPresets(assets),
  ]);
  const heroPath = world.hero.sprite, cut = heroPath.lastIndexOf('/');
  const hero = await loadSprite(gl, `${assets}/${heroPath.slice(0, cut)}`, heroPath.slice(cut + 1), spriteDefaults(gl));
  const asked = params.get('scene');
  const fixedT = number('t');
  const game = await Game.start({
    renderer, canvas, stage: document.querySelector('.stage') as HTMLElement, fade: document.getElementById('fade') as HTMLElement,
    assets, world, hero, projectLook, items, notebook, journal, replies, messages, closeups, save: loadSave(),
    reduceMotion: reducedOf(settings), fast: params.has('fast'),
    fixedT, fixedCam: number('cam'), rawView: params.get('view') === 'raw', variant: params.get('variant'),
  }, asked ? { scene: asked, spawn: params.get('spawn') ?? undefined } : undefined);

  bindInput(canvas, game, {
    forceView: import.meta.env.DEV,
    cycleQuality: () => {
      const order: Tier[] = ['low', 'medium', 'high'];
      renderer.quality = QUALITY[order[(order.indexOf(renderer.quality.tier) + 1) % order.length]];
      stats.hidden = false;
    },
    // on the dev server, ` opens the scene editor on the scene she is in, in the view on screen, in a tab of its own
    openEditor: import.meta.env.DEV ? () => { window.open(`./editor.html?scene=${game.scene.file.id}${game.raw ? '&view=raw' : ''}`, 'lidless-editor'); } : undefined,
  });
  // on the dev server: art or a scene file changed
  import.meta.hot?.on('lidless:asset', (data: { files: string[] }) => game.assetsChanged(data.files));

  // the settings, applied now and as they change, from the title screen or the menu
  const stage = document.querySelector('.stage') as HTMLElement;
  const apply = (s: Settings) => {
    settings = s;
    renderer.quality = QUALITY[tierOf(s)];
    document.documentElement.style.setProperty('--ts', String(TEXT_SCALE[s.text]));
    game.talk.speed = game.hud.noteSpeed = game.hud.concierge.speed = READING[s.speed];
    game.setMotion(reducedOf(s));
    document.documentElement.dataset.motion = reducedOf(s) ? 'reduced' : 'full';
  };
  apply(settings);
  const title = () => {
    game.inputLocked = true;
    game.hud.closeAll();
    // begun with no game saved, a new game: its opening
    showTitle(stage, { settings: () => settings, onSettings: apply, onContinue: () => { game.inputLocked = false; game.begin(); } });
  };
  game.hud.settings = () => settings;
  game.hud.onSettings = apply;
  game.hud.onTitle = title;

  stats.hidden = !params.has('debug');
  let frames = 0, fpsAt = performance.now(), fps = 0;
  const draw = () => {
    game.frame();
    frames++;
    const now = performance.now();
    if (now - fpsAt > 500) { fps = (frames * 1000) / (now - fpsAt); frames = 0; fpsAt = now; }
    if (!stats.hidden) stats.textContent = `${renderer.quality.tier} · ${fps.toFixed(0)} fps · ${canvas.width}×${canvas.height}`;
  };
  draw();
  // the first scene drawn: the eye under the name finishes opening (a test's address does not wait for it), then the
  // fade the page opened with lifts; the title screen over the scene
  if (!params.has('fast') && fixedT === null) await waitingEye()?.opened();
  document.documentElement.dataset.ready = '1';
  document.getElementById('fade')?.classList.remove('on', 'boot');
  setTimeout(() => { if (!document.getElementById('fade')?.classList.contains('wait')) waitingEye()?.stop(); }, 400);
  const machine = params.get('terminal');
  if (machine) void game.terminal(machine);
  else if (titleAtStart(params)) title();
  // a new game from the title screen, or asked for (?opening): its opening
  else if (takeBegin() || params.has('opening')) game.begin();
  if (fixedT !== null) return;

  let visible = true, last = 0;
  document.addEventListener('visibilitychange', () => { visible = document.visibilityState === 'visible'; game.resume(); });
  const loop = (now: number) => {
    requestAnimationFrame(loop);
    if (!visible || now - last < 15) return;
    last = now;
    draw();
  };
  requestAnimationFrame(loop);
}

boot().catch((err: unknown) => {
  console.error(err);
  const msg = err instanceof Error ? err.message : String(err);
  errorBox.hidden = false;
  errorBox.textContent = `Lidless could not start: ${msg}`;
  document.documentElement.dataset.err = msg;
});
