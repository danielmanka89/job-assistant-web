// "Why should I hire you?" answers on the Job Board: the word limit, shared by the page and the API.

export const MAX_PITCH_WORDS = 300;
export const MAX_PITCH_CHARS = 3000; // a backstop: 300 normal words are well under this

/** Words in a piece of text (runs of non-space characters). */
export function countWords(text: string): number {
  const words = text.trim().match(/\S+/g);
  return words ? words.length : 0;
}

/** The text cut off after its `max`-th word, keeping the spacing and line breaks before it. */
export function limitWords(text: string, max = MAX_PITCH_WORDS): string {
  if (countWords(text) <= max) return text; // under the limit: keep it exactly as typed
  const re = /\S+/g;
  let count = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    count++;
    if (count === max) return text.slice(0, match.index + match[0].length);
  }
  return text;
}
