import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

export interface NowPlayingMeta {
  stationName?: string;
  title?: string;
  artist?: string | null;
  album?: string | null;
  year?: number | null;
  genre?: string | null;
  coverUrl?: string | null;
}

export interface NowPlaying {
  id: string;
  url: string;
  meta?: NowPlayingMeta;
}

interface AudioPlayerState {
  playingId: string | null;
  nowPlaying: NowPlaying | null;
  currentTime: number;
  duration: number;
  volume: number;
  toggle: (id: string, url: string, meta?: NowPlayingMeta) => void;
  seek: (time: number) => void;
  stop: () => void;
  setVolume: (volume: number) => void;
}

const AudioPlayerContext = createContext<AudioPlayerState | null>(null);

export function AudioPlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const stored = window.localStorage.getItem("volume");
      if (stored != null) {
        const parsed = Number(stored);
        if (Number.isFinite(parsed)) {
          const clamped = Math.max(0, Math.min(parsed, 1));
          setVolumeState(clamped);
          if (audioRef.current) {
            audioRef.current.volume = clamped;
          }
        }
      }
    } catch {
      // Ignore localStorage read errors
    }
  }, []);

  const setVolume = useCallback((value: number) => {
    const clamped = Math.max(0, Math.min(value, 1));
    setVolumeState(clamped);

    if (audioRef.current) {
      audioRef.current.volume = clamped;
    }

    if (typeof window === "undefined") return;

    try {
      window.localStorage.setItem("volume", String(clamped));
    } catch {
      // Ignore localStorage write errors
    }
  }, []);

  const toggle = useCallback(
    (id: string, url: string, meta?: NowPlayingMeta) => {
      if (playingId === id) {
        audioRef.current?.pause();
        audioRef.current = null;
        setPlayingId(null);
        setNowPlaying(null);
        setCurrentTime(0);
        setDuration(0);
      } else {
        audioRef.current?.pause();
        setCurrentTime(0);
        setDuration(0);

        const audio = new Audio(url);
        audio.volume = volume;

        const handleLoadedMetadata = () => {
          const d = audio.duration;
          setDuration(Number.isFinite(d) && d > 0 ? d : 0);
        };

        const handleTimeUpdate = () => {
          setCurrentTime(audio.currentTime || 0);
        };

        const handleEnded = () => {
          audioRef.current = null;
          setPlayingId(null);
          setNowPlaying(null);
          setCurrentTime(0);
          setDuration(0);
          audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
          audio.removeEventListener("timeupdate", handleTimeUpdate);
          audio.removeEventListener("ended", handleEnded);
        };

        audio.addEventListener("loadedmetadata", handleLoadedMetadata);
        audio.addEventListener("timeupdate", handleTimeUpdate);
        audio.addEventListener("ended", handleEnded);

        audio.play();
        audioRef.current = audio;
        setPlayingId(id);
        setNowPlaying({ id, url, meta });
      }
    },
    [playingId, volume]
  );

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio) return;

    const d = audio.duration;
    if (!Number.isFinite(d) || d <= 0) return;

    const clamped = Math.max(0, Math.min(time, d));
    audio.currentTime = clamped;
    setCurrentTime(clamped);
  }, []);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlayingId(null);
    setNowPlaying(null);
    setCurrentTime(0);
    setDuration(0);
  }, []);

  return (
    <AudioPlayerContext.Provider
      value={{
        playingId,
        nowPlaying,
        currentTime,
        duration,
        volume,
        toggle,
        seek,
        stop,
        setVolume,
      }}
    >
      {children}
    </AudioPlayerContext.Provider>
  );
}

export function useAudioPlayer() {
  const context = useContext(AudioPlayerContext);
  if (!context) {
    throw new Error("useAudioPlayer must be used within an AudioPlayerProvider");
  }
  return context;
}
