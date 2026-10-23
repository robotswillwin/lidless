// Her messages: what comes to her inbox through CO-net, in the Concierge's card (a chapter's ## Messages). Each arrives
// once a condition on the story holds and stays; it is read once she opens it, and the story hears of it through the
// variable the message names (read). Raw view has no inbox: it is the Concierge's interface.

/** A message as the story's data has it (messages.json). */
export interface Message {
  id: string;
  /** Who it is from, as her inbox shows it: "Delivery", "Athena". */
  from: string;
  /** From when it is in her inbox: a condition on the story (conditions.ts); none, from the start. */
  arrives?: string;
  text: string;
  /** A variable of the story's the game sets true when she reads it. */
  read?: string;
}

export interface MessagesFile { messages: Message[] }

/** A message in her inbox, as the card lists it. */
export interface Inbox { id: string; from: string; text: string; unread: boolean }

/** Her inbox now: every message that has arrived, in the file's order, and whether she has read it yet. */
export function inbox(file: MessagesFile, holds: (cond: string | undefined) => boolean, read: ReadonlySet<string>): Inbox[] {
  return file.messages.filter((m) => holds(m.arrives)).map((m) => ({ id: m.id, from: m.from, text: m.text, unread: !read.has(m.id) }));
}

const NUMBERS = ['no', 'a', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

/** What the Concierge says of her unread messages, opening its card. */
export function unreadWords(n: number): string {
  return n === 1 ? 'You have a new message, Luna.' : `You have ${NUMBERS[n] ?? n} new messages, Luna.`;
}
