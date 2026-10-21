// The HUD's icons: thin white lines on a 24 grid, the same in both views. And the Concierge's own graphics for what
// exists only in its eye (credits): crisp lines on a 64 grid, drawn in its colour, as projections are.

const SVG_ATTRS = 'fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';

/** Line icons on a 24 grid. */
const ICONS: Record<string, string> = {
  eyes: '<path d="M2 12s3.8-6.5 10-6.5S22 12 22 12s-3.8 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3.2"/>',
  hands: '<path d="M7 12V6.5a1.5 1.5 0 0 1 3 0V11M10 11V4.5a1.5 1.5 0 0 1 3 0V11M13 11V5.5a1.5 1.5 0 0 1 3 0V12M16 12V8.5a1.5 1.5 0 0 1 3 0V15a6.5 6.5 0 0 1-6.5 6.5h-1A6.5 6.5 0 0 1 6 18.6l-2.7-3.4a1.5 1.5 0 0 1 2.3-1.9L7 15"/>',
  heart: '<path d="M12 20s-7.2-4.4-9.3-8.8C1.3 8.1 3.1 5 6.4 5c2.1 0 3.3 1.2 4 2.3.4.6 1 .6 1.3 0 .8-1.1 2-2.3 4-2.3 3.4 0 5.2 3.1 3.7 6.2C17.3 15.6 12 20 12 20z"/>',
  feet: '<path d="M12 2.5c2.3 0 3.6 2.3 3.6 5.2S14.4 14 12.3 14 8.9 10.9 8.9 7.9 9.7 2.5 12 2.5zM11.1 16.2c1.5 0 2.6 1.1 2.6 2.6s-1 2.7-2.2 2.7-2.7-1.2-2.7-2.7.8-2.6 2.3-2.6z"/>',
  // a hand closing under a small box: taking it
  take: '<rect x="9.5" y="2.5" width="7" height="6" rx="1"/><path d="M3 15.5l3.6-1.9a2.4 2.4 0 0 1 2-.1l3.4 1.3a1.4 1.4 0 0 1-.9 2.7l-2.6-.6M3 21l4.2-1.7h5.9l6.4-4.6a1.5 1.5 0 0 0-1.8-2.4l-4.4 2.7"/>',
  // the verbs' ball with no verb chosen: a ring with four ticks, choose what to do
  verbs: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v3.5M12 18v3.5M2.5 12H6M18 12h3.5"/>',
  // the view switch: the dot behind her eye
  view: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.2"/>',
  // the Concierge's bell
  ask: '<path d="M3 18h18M5 18a7 7 0 0 1 14 0M12 11V8.5M10.5 8h3M4 21h16"/>',
  notebook: '<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M9 3v18M12 8h4M12 11.5h4"/>',
  // shut, its elastic band round it: not here, it can see
  locked: '<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M9 3v18"/><path d="M15.5 1.5v21" stroke-width="2.4"/>',
  satchel: '<path d="M4.5 9h15l-1.2 11.2a1 1 0 0 1-1 .8H6.7a1 1 0 0 1-1-.8L4.5 9z"/><path d="M9 9V7a3 3 0 0 1 6 0v2"/>',
  map: '<path d="M3 6.5l5.5-2.5 7 2.5L21 4v13.5L15.5 20l-7-2.5L3 20z"/><path d="M8.5 4v13.5M15.5 6.5V20"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  // a ribbon marking a page: her saves
  saves: '<path d="M7 3h10v18l-5-4-5 4z"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
};

/** Its own graphics, on a 64 grid: what exists only in its eye, and how it draws a thing it has no picture of. */
const AR: Record<string, string> = {
  parcel: '<path d="M10 22l22-10 22 10v24L32 56 10 46z"/><path d="M10 22l22 10 22-10M32 32v24"/><path class="accent" d="M21 17l22 10v8"/>',
  credits: '<rect x="10" y="18" width="44" height="28" rx="4"/><rect class="accent" x="17" y="25" width="13" height="11" rx="1.5"/><path d="M37 27h11M37 32h11M37 37h7"/>',
  matches: '<rect x="10" y="28" width="44" height="20" rx="2"/><path d="M10 34h44M40 28l7-12"/><circle class="accent" cx="48" cy="14" r="2.6"/>',
  cigarettes: '<path d="M18 26h28v28H18z"/><path d="M18 33h28M24 26V12h6v14M34 26V16h6v10"/><path class="accent" d="M24 12h6"/>',
  map: '<path d="M8 14l16-4 16 4 16-4v38l-16 4-16-4-16 4z"/><path d="M24 10v38M40 14v38"/><path class="accent" d="M14 40c6-4 8-12 16-10s8 10 16 6 6-10 10-10" stroke-dasharray="3 4"/>',
  valve: '<path d="M22 46V22a10 10 0 0 1 20 0v24z"/><path d="M20 46h24v6H20zM26 52v6M32 52v6M38 52v6"/><path class="accent" d="M28 40V28l4 6 4-6v12"/>',
};

export const icon = (name: string, size: number) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" stroke-width="1.6" ${SVG_ATTRS}>${ICONS[name] ?? ''}</svg>`;

export const arIcon = (name: string, size: number) =>
  `<svg class="ar" width="${size}" height="${size}" viewBox="0 0 64 64" stroke-width="1.6" ${SVG_ATTRS}>${AR[name] ?? AR.parcel}</svg>`;
