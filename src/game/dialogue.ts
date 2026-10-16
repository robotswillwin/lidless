// Runs the Ink story: knots per conversation, tags for who is speaking.

import { Story } from 'inkjs';
import storyJson from '../story/main.ink';

/** A speaker tag on a line names who says it: a lowercase id such as lux, fixer or concierge. */
const SPEAKER_TAG = /^[a-z][a-z0-9_]*$/;

export interface Line {
  text: string;
  /** The line's speaker tag, or "narration" for a line without one. */
  speaker: string;
}

export class Dialogue {
  readonly story: Story;

  constructor(saved: string | null) {
    this.story = new Story(storyJson);
    if (saved) {
      try {
        this.story.state.LoadJson(saved);
      } catch {
        // an old or broken save: start the story fresh
      }
    }
  }

  start(knot: string, rawView: boolean): Line[] {
    this.story.variablesState['raw_view'] = rawView;
    this.story.ChoosePathString(knot);
    return this.lines();
  }

  /** The view can switch during a conversation, so the lines after a choice see the view on screen now. */
  choose(i: number, rawView: boolean): Line[] {
    this.story.variablesState['raw_view'] = rawView;
    this.story.ChooseChoiceIndex(i);
    return this.lines();
  }

  lines(): Line[] {
    const out: Line[] = [];
    while (this.story.canContinue) {
      const text = (this.story.Continue() ?? '').trim();
      if (!text) continue;
      const tags = (this.story.currentTags ?? []).map((t) => t.trim());
      out.push({ text, speaker: tags.find((t) => SPEAKER_TAG.test(t)) ?? 'narration' });
    }
    return out;
  }

  get choices(): string[] {
    return this.story.currentChoices.map((c) => c.text);
  }

  get hasRaw(): boolean {
    return Boolean(this.story.variablesState['has_raw']);
  }

  save(): string {
    return this.story.state.ToJson();
  }
}
