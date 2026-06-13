// Tiny bus that lets the right-side preview ask the chat composer to send
// a message on behalf of the user (e.g. "@段落2 更生动").
type Listener = (text: string) => void;
const map = new Map<string, Set<Listener>>();

export function onChatAsk(projectId: string, fn: Listener): () => void {
  let set = map.get(projectId);
  if (!set) {
    set = new Set();
    map.set(projectId, set);
  }
  set.add(fn);
  return () => {
    set!.delete(fn);
  };
}

export function emitChatAsk(projectId: string, text: string): void {
  map.get(projectId)?.forEach((fn) => fn(text));
}
