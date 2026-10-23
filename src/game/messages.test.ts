import { describe, expect, it } from 'vitest';
import { inbox, unreadWords, type MessagesFile } from './messages';

const file: MessagesFile = {
  messages: [
    { id: 'delivery-4471', from: 'Delivery', arrives: 'intro_morning_started', text: 'DELIVERY 4471', read: 'intro_messages_read' },
    { id: 'athena-invitation', from: 'Athena', arrives: 'intro_morning_started', text: 'Luna! Come down.', read: 'athena_invitation_read' },
    { id: 'later', from: 'Radio Repair', arrives: 'parcel_delivered', text: 'Thank you.' },
  ],
};

describe('her messages', () => {
  it('come once their condition holds, and stay unread until she opens them', () => {
    const story: Record<string, boolean> = { intro_morning_started: false };
    const holds = (c: string | undefined) => !c || story[c] === true;
    expect(inbox(file, holds, new Set())).toEqual([]);
    story.intro_morning_started = true;
    expect(inbox(file, holds, new Set()).map((m) => [m.from, m.unread])).toEqual([['Delivery', true], ['Athena', true]]);
    expect(inbox(file, holds, new Set(['delivery-4471'])).map((m) => m.unread)).toEqual([false, true]);
  });

  it('are counted in words', () => {
    expect(unreadWords(1)).toBe('You have a new message, Luna.');
    expect(unreadWords(2)).toBe('You have two new messages, Luna.');
  });
});
