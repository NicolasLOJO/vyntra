import type { Transport } from "./transport";

export interface NowPlaying {
  title: string | null;
  artist: string | null;
  album: string | null;
  app: string | null;
  is_playing: boolean;
  position_ms: number | null;
  duration_ms: number | null;
  artwork_url: string | null;
}

export interface VynMedia {
  nowPlaying(): Promise<NowPlaying>;
  play(): Promise<void>;
  pause(): Promise<void>;
  next(): Promise<void>;
  previous(): Promise<void>;
  subscribe(cb: (np: NowPlaying) => void): () => void;
}

export function createMedia(t: Transport): VynMedia {
  return {
    nowPlaying: () => t.call("media.nowPlaying"),
    play: () => t.call("media.play"),
    pause: () => t.call("media.pause"),
    next: () => t.call("media.next"),
    previous: () => t.call("media.previous"),
    subscribe: (cb) => t.on("media.change", (p) => cb(p as NowPlaying)),
  };
}
