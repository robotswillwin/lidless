import { describe, expect, it } from 'vitest';
import { cleanLookSet, cleanSceneLook, sceneLookJSON, sceneSets, withScene } from './look';

const project = cleanLookSet({ grain: 0.12, bloom: 0.7, raw: { rawFog: 0.55, rawColour: 1 } });

describe('withScene', () => {
  it('keeps the game’s look where the scene sets nothing', () => {
    const shown = withScene(project, null);
    expect(shown.base.grain).toBe(0.12);
    expect(shown.raw.rawFog).toBe(0.55);
  });

  it('puts the scene’s own settings over the game’s, shared or per view', () => {
    const shown = withScene(project, cleanSceneLook({ rain: 0.35, raw: { actorRed: 0.92 }, concierge: { actorRed: 1.04 } }));
    expect(shown.base.rain).toBe(0.35);
    expect(shown.raw.actorRed).toBe(0.92);
    expect(shown.concierge.actorRed).toBe(1.04);
    expect(shown.base.grain).toBe(0.12);
  });

  it('shares a setting between the views when the scene does, even where the game splits it', () => {
    const shown = withScene(project, cleanSceneLook({ rawFog: 1 }));
    expect(shown.base.rawFog).toBe(1);
    expect('rawFog' in shown.raw).toBe(false);
  });

  it('leaves the game’s look itself alone', () => {
    withScene(project, cleanSceneLook({ grain: 2 }));
    expect(project.base.grain).toBe(0.12);
  });
});

describe('a scene’s own look', () => {
  it('keeps only known settings, within their range', () => {
    const s = cleanSceneLook({ rain: 5, nonsense: 1, raw: { actorRed: 'red', actorBlue: 0.5 } });
    // rain goes up to 2, a downpour
    expect(s.base).toEqual({ rain: 2 });
    expect(s.raw).toEqual({ actorBlue: 0.5 });
  });

  it('is left out of the scene file when it sets nothing', () => {
    expect(sceneLookJSON(cleanSceneLook({}))).toBeUndefined();
    expect(sceneLookJSON(cleanSceneLook({ rain: 0.5, raw: { actorRed: 0.9 } }))).toEqual({ rain: 0.5, raw: { actorRed: 0.9 } });
  });

  it('knows which settings it sets, in either view', () => {
    const s = cleanSceneLook({ rain: 0.5, raw: { actorRed: 0.9 } });
    expect(sceneSets(s, 'rain')).toBe(true);
    expect(sceneSets(s, 'actorRed')).toBe(true);
    expect(sceneSets(s, 'grain')).toBe(false);
  });
});
