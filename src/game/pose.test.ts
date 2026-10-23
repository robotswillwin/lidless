import { describe, expect, it } from 'vitest';
import type { SpriteDef } from '../engine/assets';
import { blinking } from './anim';
import { isDoor, poseAt, poseFrame, TURN_AFTER } from './pose';

const still = { going: false, moving: false, talking: false, out: false, stillSince: 0 };

describe('her front and back', () => {
  it('her back to us going in at a door, to us coming out of one until she moves', () => {
    expect(poseAt(10, { ...still, going: true, stillSince: 10 })).toBe('back');
    expect(poseAt(10, { ...still, out: true, stillSince: 10 })).toBe('front');
    expect(poseAt(15, { ...still, out: true, stillSince: 10 })).toBe('front');
    // walking off, she is side on at once; talking, she turns to whoever it is
    expect(poseAt(10, { ...still, moving: true, out: true })).toBe(null);
    expect(poseAt(10, { ...still, talking: true, out: true })).toBe(null);
  });

  it('turns to us once she has stood still a while, and not while she talks', () => {
    expect(poseAt(TURN_AFTER - 0.1, still)).toBe(null);
    expect(poseAt(TURN_AFTER, still)).toBe('front');
    expect(poseAt(TURN_AFTER + 30, { ...still, talking: true })).toBe(null);
  });

  it('a door is a way within the scene, even at an end of the walk; an end of the street reaches its edge', () => {
    expect(isDoor([1200, 250, 80, 160], 2400)).toBe(true);
    // the radio repair's door, where the street's walk begins, and a room's door where its walk ends
    expect(isDoor([32, 270, 66, 160], 2400)).toBe(true);
    expect(isDoor([786, 230, 60, 128], 960)).toBe(true);
    expect(isDoor([2370, 0, 30, 540], 2400)).toBe(false);
    expect(isDoor([0, 300, 30, 150], 2400)).toBe(false);
  });

  it('only where her sprite has the frames', () => {
    const def = { anims: { idle: { from: 0, count: 16 }, front: { from: 160, count: 1 }, back: { from: 161, count: 1 } } } as unknown as SpriteDef;
    expect(poseFrame(def, 'front')).toBe(160);
    expect(poseFrame(def, 'back')).toBe(161);
    expect(poseFrame(def, null)).toBe(null);
    expect(poseFrame({ anims: { idle: { from: 0, count: 16 } } } as unknown as SpriteDef, 'front')).toBe(null);
    // facing us, she blinks as she does side on
    const blinks = { anims: { ...def.anims, blinkFront: { from: 162, count: 1 } } } as unknown as SpriteDef;
    const ts = Array.from({ length: 3000 }, (_, i) => i / 100), shut = ts.find(blinking)!, open = ts.find((t) => !blinking(t))!;
    expect(poseFrame(blinks, 'front', shut)).toBe(162);
    expect(poseFrame(blinks, 'front', open)).toBe(160);
    expect(poseFrame(blinks, 'back', shut)).toBe(161);
  });
});
