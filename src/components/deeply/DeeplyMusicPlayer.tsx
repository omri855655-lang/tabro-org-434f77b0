import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Play, Pause, Trash2, Upload, Music, StopCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { startSilentAudio, stopSilentAudio } from "./iosSilentAudio";
import { unlockAudioContext } from "./iosAudioUnlock";
import { resetDeeplyAudioState, setDeeplyAudioState, stopOtherDeeplyAudio } from "./deeplyAudioState";

interface AudioFile {
  name: string;
  url: string;
  path: string;
}

interface DeeplyMusicPlayerProps {
  onPlayingChange?: (playing: boolean) => void;
  themeCard?: string;
  themeMuted?: string;
  themeSubtle?: string;
  themeInput?: string;
}

export function DeeplyMusicPlayer({ onPlayingChange, themeCard, themeMuted, themeSubtle, themeInput }: DeeplyMusicPlayerProps) {
  const { user } = useAuth();
  const [files, setFiles] = useState<AudioFile[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [uploading, setUploading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load files from storage
  const loadFiles = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase.storage
      .from("audio-files")
      .list(user.id, { sortBy: { column: "created_at", order: "desc" } });

    if (error || !data) return;

    const audioFiles: AudioFile[] = data
      .filter(f => f.name.match(/\.(mp3|wav|m4a|ogg|aac|flac)$/i))
      .map(f => {
        const { data: urlData } = supabase.storage
          .from("audio-files")
          .getPublicUrl(`${user.id}/${f.name}`);
        return {
          name: f.name.replace(/\.[^.]+$/, ""),
          url: urlData.publicUrl,
          path: `${user.id}/${f.name}`,
        };
      });

    setFiles(audioFiles);
  }, [user]);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  const stopMusic = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current.remove();
      audioRef.current = null;
    }
    stopSilentAudio();
    setIsPlaying(false);
    setActiveFile(null);
    onPlayingChange?.(false);
    resetDeeplyAudioState("music");
  }, [onPlayingChange]);

  // Sync global state for floating mini-player
  useEffect(() => {
    setDeeplyAudioState("music", {
      playing: isPlaying,
      name: activeFile ? files.find(f => f.path === activeFile)?.name || "" : "",
      stop: () => stopMusic(),
    });

    return () => {
      resetDeeplyAudioState("music");
    };
  }, [isPlaying, activeFile, files, stopMusic]);

  const playFile = useCallback(async (file: AudioFile) => {
    stopMusic();
    stopOtherDeeplyAudio("music");

    // Stop frequency presets when starting music
    if (window._deeplyFreqState?.playing) {
      window._deeplyFreqState.stop();
    }

    // Unlock audio context on user gesture
    unlockAudioContext();

    // Create and unlock audio element SYNCHRONOUSLY in user gesture
    const audio = new Audio();
    audio.loop = true;
    audio.volume = 1;
    audio.setAttribute("playsinline", "true");
    (audio as any).playsInline = true;
    audio.style.display = "none";
    document.body.appendChild(audio);
    audioRef.current = audio;

    // Unlock for iOS — must happen synchronously in gesture
    audio.play().catch(() => {});

    // Now start silent audio and set source
    startSilentAudio();
    audio.src = file.url;

    try {
      await audio.play();
      setIsPlaying(true);
      setActiveFile(file.path);
      onPlayingChange?.(true);
      

      // MediaSession for lock screen
      if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: `Deeply — ${file.name}`,
          artist: "Tabro",
          album: "Deeply Music",
          artwork: [
            { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
            { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
          ],
        });
        navigator.mediaSession.setActionHandler("play", () => {
          audioRef.current?.play().catch(() => {});
        });
        navigator.mediaSession.setActionHandler("pause", () => {
          stopMusic();
        });
      }
    } catch (e) {
      console.error("Failed to play audio file:", e);
      stopMusic();
    }
  }, [stopMusic, onPlayingChange]);

  const toggleFile = useCallback((file: AudioFile) => {
    if (activeFile === file.path && isPlaying) {
      stopMusic();
    } else {
      playFile(file);
    }
  }, [activeFile, isPlaying, stopMusic, playFile]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !e.target.files?.length) return;
    setUploading(true);

    try {
      for (const file of Array.from(e.target.files)) {
        const filePath = `${user.id}/${file.name}`;
        await supabase.storage.from("audio-files").upload(filePath, file, { upsert: true });
      }
      await loadFiles();
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const deleteFile = async (file: AudioFile) => {
    if (activeFile === file.path) stopMusic();
    await supabase.storage.from("audio-files").remove([file.path]);
    await loadFiles();
  };

  // Resume on visibility change
  useEffect(() => {
    const handler = () => {
      if (!document.hidden && audioRef.current && isPlaying) {
        audioRef.current.play().catch(() => {});
        startSilentAudio();
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [isPlaying]);

  if (!user) return null;

  return (
    <Card className={themeCard || "bg-white/5 border-white/5"}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Music className="h-4 w-4 text-purple-400" />
          🎵 מוזיקה אישית — ניגון ברקע
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className={`text-xs ${themeMuted || "text-[#e8e8ed]/40"}`}>
          העלה קבצי MP3/WAV ונגן ברקע — עובד גם עם מסך נעול 🔒
        </p>

        {/* Upload button */}
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            multiple
            onChange={handleUpload}
            className="hidden"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 rounded-full text-xs px-4"
          >
            <Upload className="h-3.5 w-3.5 ml-1.5" />
            {uploading ? "מעלה..." : "העלה קובץ"}
          </Button>
          {isPlaying && (
            <Button
              variant="ghost"
              size="sm"
              onClick={stopMusic}
              className="bg-red-500/20 text-red-300 hover:bg-red-500/30 rounded-full text-xs px-4"
            >
              <StopCircle className="h-3.5 w-3.5 ml-1.5" />
              עצור
            </Button>
          )}
        </div>

        {/* File list */}
        {files.length === 0 ? (
          <p className={`text-xs ${themeMuted || "text-[#e8e8ed]/40"} text-center py-4`}>
            אין קבצים עדיין — העלה MP3 כדי להתחיל 🎶
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-2">
            {files.map(file => (
              <div
                key={file.path}
                className={`flex items-center gap-3 p-3 rounded-xl transition-all text-right ${
                  activeFile === file.path && isPlaying
                    ? "bg-purple-500/20 border border-purple-500/30"
                    : "bg-white/5 border border-transparent hover:bg-white/10"
                }`}
              >
                <button
                  onClick={() => toggleFile(file)}
                  className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center flex-shrink-0"
                >
                  {activeFile === file.path && isPlaying ? (
                    <Pause className="h-4 w-4 text-white" />
                  ) : (
                    <Play className="h-4 w-4 text-white" />
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                </div>
                <button
                  onClick={() => deleteFile(file)}
                  className="text-red-400/60 hover:text-red-400 transition-colors flex-shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
