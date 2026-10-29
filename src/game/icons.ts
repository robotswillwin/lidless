// The HUD's icons: thin white lines on a 24 grid, the same in both views. And the Concierge's own graphics for what
// exists only in its eye (a projection): crisp lines on a 64 grid, drawn in its colour.

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
  // her journal: on her device, a few lines on its screen
  journal: '<rect x="5.5" y="2.5" width="13" height="19" rx="2.5"/><path d="M9 7.5h6M9 11h6M9 14.5h4"/>',
  // shut, its elastic band round it: not here, it can see
  locked: '<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M9 3v18"/><path d="M15.5 1.5v21" stroke-width="2.4"/>',
  satchel: '<path d="M4.5 9h15l-1.2 11.2a1 1 0 0 1-1 .8H6.7a1 1 0 0 1-1-.8L4.5 9z"/><path d="M9 9V7a3 3 0 0 1 6 0v2"/>',
  map: '<path d="M3 6.5l5.5-2.5 7 2.5L21 4v13.5L15.5 20l-7-2.5L3 20z"/><path d="M8.5 4v13.5M15.5 6.5V20"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  // a ribbon marking a page: her saves
  saves: '<path d="M7 3h10v18l-5-4-5 4z"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  // her journal's pages: what she has to do (a ring with its tick), the people she knows, what she has found
  objectives: '<circle cx="12" cy="12" r="8.5"/><path d="M8.3 12.3l2.5 2.5 4.9-5.2"/>',
  people: '<circle cx="12" cy="8.2" r="3.6"/><path d="M4.8 20c.9-3.9 3.7-6.1 7.2-6.1s6.3 2.2 7.2 6.1"/>',
  evidence: '<circle cx="10.5" cy="10.5" r="6.2"/><path d="M15.2 15.2L20.5 20.5"/>',
  // the Concierge's mark: a ring of light with a gap
  co: '<path d="M18.4 7.4a7.5 7.5 0 1 0 0 9.2"/>',
  // a keyboard: what the keys do
  keys: '<rect x="2.5" y="6" width="19" height="12" rx="2.2"/><path d="M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M7.5 14h9"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  // the city map's markers: a home, a shop, a bar, a radio, a door, a lift
  home: '<path d="M4 11.5 12 4l8 7.5"/><path d="M6 10v9h12v-9"/><path d="M10.5 19v-5h3v5"/>',
  shop: '<path d="M4 9h16l-1 3H5z"/><path d="M5 12v7h14v-7"/><path d="M4 9l1-4h14l1 4"/><path d="M10 19v-4h4v4"/>',
  bar: '<path d="M5 4h14l-7 8z"/><path d="M12 12v6"/><path d="M8.5 18h7"/>',
  radio: '<rect x="3" y="8" width="18" height="11" rx="1.5"/><path d="M7 4l10 3.5"/><circle cx="15.5" cy="13.5" r="2.6"/><path d="M6.5 12h3.5M6.5 15h3.5"/>',
  door: '<rect x="6" y="3" width="12" height="18" rx="1"/><path d="M14.5 12h.01"/>',
  lift: '<rect x="5" y="3" width="14" height="18" rx="1.2"/><path d="M12 3v18"/><path d="M8.5 9l1.5-2 1.5 2M13.5 15l1.5 2 1.5-2"/>',
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

/**
 * How to play, drawn: each a small screen with what the hand does on it, on a 120 by 68 grid. `frame` is the screen and
 * what stays (dim), `lit` what is being shown, `fill` a point filled.
 */
const HOW: Record<string, string> = {
  walk: '<path class="frame" d="M8 52h104"/><circle cx="26" cy="29" r="3.2"/><path d="M26 32.5v11M26 43.5l-3.5 8M26 43.5l3.5 8M26 36l-4.5 5M26 36l4.5 5"/>'
    + '<path class="lit" d="M35 47.5h42" stroke-dasharray="3 3"/><path class="lit" d="M74 44.5l4 3-4 3"/><circle class="fill" cx="88" cy="47.5" r="2.4"/><circle class="lit" cx="88" cy="47.5" r="6.5"/>',
  do: '<rect x="50" y="18" width="16" height="13" rx="2"/><rect class="lit" x="45.5" y="13.5" width="25" height="22" rx="3.5" stroke-dasharray="3 3"/>'
    + '<circle class="frame" cx="52" cy="54" r="4.5"/><circle class="frame" cx="64" cy="54" r="4.5"/><circle class="fill" cx="76" cy="54" r="4.5"/><circle class="frame" cx="88" cy="54" r="4.5"/><circle cx="104" cy="54" r="7"/>'
    + '<path class="lit" d="M76 47.5c0-6 -8-6 -14-11"/>',
  co: '<rect class="lit" x="8" y="8" width="52" height="11" rx="5.5"/><path class="lit" d="M17.4 11.4a3.2 3.2 0 1 0 0 4.2M22.5 13.5h30"/>'
    + '<rect x="8" y="23" width="52" height="36" rx="4.5"/><path class="frame" d="M14 31h38M14 37h30M14 43h34"/><rect class="frame" x="14" y="49" width="13" height="5.5" rx="2.75"/><rect class="frame" x="30" y="49" width="21" height="5.5" rx="2.75"/>',
  things: '<circle cx="16" cy="54" r="7"/><rect x="27" y="44.5" width="51" height="19" rx="4.5"/><rect class="frame" x="30.5" y="48" width="13" height="12" rx="2"/>'
    + '<rect class="fill-soft" x="47" y="48" width="13" height="12" rx="2"/><rect class="frame" x="63.5" y="48" width="13" height="12" rx="2"/>'
    + '<rect class="lit" x="38" y="9" width="52" height="27" rx="4.5"/><rect class="lit" x="42.5" y="13.5" width="14" height="14" rx="2"/><path class="frame" d="M61 16h24M61 22h18"/><path class="lit" d="M53.5 44.5v-6"/>',
  top: '<circle class="lit" cx="70" cy="13" r="5"/><circle class="lit" cx="83" cy="13" r="5"/><circle class="lit" cx="96" cy="13" r="5"/><circle class="lit" cx="109" cy="13" r="5"/>'
    + '<path class="frame" d="M66.5 22h7"/><circle class="frame" cx="16" cy="54" r="7"/><circle class="frame" cx="104" cy="54" r="7"/>',
  keys: '<rect x="20.5" y="16" width="11" height="11" rx="2"/><rect x="8.5" y="29" width="11" height="11" rx="2"/><rect x="20.5" y="29" width="11" height="11" rx="2"/><rect x="32.5" y="29" width="11" height="11" rx="2"/>'
    + '<path class="frame" d="M26 24.5v-5M24 21.5l2-2 2 2"/>'
    + '<rect class="lit" x="52" y="16" width="11" height="11" rx="2"/><rect class="lit" x="66" y="16" width="11" height="11" rx="2"/><rect class="lit" x="80" y="16" width="11" height="11" rx="2"/><rect class="lit" x="94" y="16" width="11" height="11" rx="2"/>'
    + '<rect class="lit" x="52" y="29" width="18" height="11" rx="2"/><rect x="8.5" y="46" width="35" height="11" rx="2"/>'
    + '<text x="57.5" y="24.6">E</text><text x="71.5" y="24.6">I</text><text x="85.5" y="24.6">M</text><text x="99.5" y="24.6">J</text><text x="61" y="37.6">Esc</text><text x="26" y="54.6">Shift</text>',
};

/** A drawing of how to play, on its small screen. */
export const howTo = (name: string) =>
  `<svg class="how" viewBox="0 0 120 68" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect class="screen" x="1.5" y="1.5" width="117" height="65" rx="7"/>${HOW[name] ?? ''}</svg>`;

export const icon = (name: string, size: number) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" stroke-width="1.6" ${SVG_ATTRS}>${ICONS[name] ?? ''}</svg>`;

export const arIcon = (name: string, size: number) =>
  `<svg class="ar" width="${size}" height="${size}" viewBox="0 0 64 64" stroke-width="1.6" ${SVG_ATTRS}>${AR[name] ?? AR.parcel}</svg>`;
