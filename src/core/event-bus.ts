type EventCallback = (data?: unknown) => void;

export class EventBus {
  private listeners = new Map<string, Set<EventCallback>>();

  on(event: string, cb: EventCallback): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(cb);
    return () => { this.listeners.get(event)?.delete(cb); };
  }

  emit(event: string, data?: unknown): void {
    this.listeners.get(event)?.forEach(cb => {
      try { cb(data); } catch (e) { console.error(`[event-bus] Error in "${event}" handler:`, e); }
    });
  }

  clear(): void {
    this.listeners.clear();
  }
}
