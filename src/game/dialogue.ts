// Runs the Ink story: knots per conversation, tags for who is speaking.

import { Story } from 'inkjs';
import storyJson from '../story/street.ink';

export type Speaker = 'narration' | 'fixer' | 'concierge';

export interface Line {
  text: string;
  speaker: Speaker;
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

  choose(i: number): Line[] {
    this.story.ChooseChoiceIndex(i);
    return this.lines();
  }

  lines(): Line[] {
    const out: Line[] = [];
    while (this.story.canContinue) {
      const text = (this.story.Continue() ?? '').trim();
      if (!text) continue;
      const tags = this.story.currentTags ?? [];
      out.push({ text, speaker: tags.includes('fixer') ? 'fixer' : tags.includes('concierge') ? 'concierge' : 'narration' });
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
