import React, { useRef, useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import Hls from 'hls.js';
import { useVideoSecurity } from '@/hooks/useVideoSecurity';
import { logger } from '@/lib/logger';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Settings,
  Loader2,
  RotateCcw,
  RotateCw,
} from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

export interface SecureVideoPlayerHandle {
  seek: (timeSeconds: number) => void;
  play: () => void;
  pause: () => void;
  restart: () => void;
  dismissEndCard: () => void;
  getCurrentTime: () => number;
}

export interface SecureVideoPlayerProps {
  src: string;
  poster?: string;
  watermarkText: string;
  initialTime?: number;
  onTokenExpired?: () => Promise<string | void> | void;
  onEnded?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onTimeUpdate?: (currentTime: number, duration: number, percent: number) => void;
  endCard?: React.ReactNode;
}

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '00:00';
  const totalSeconds = Math.floor(seconds);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

const SecureVideoPlayer = forwardRef<SecureVideoPlayerHandle, SecureVideoPlayerProps>(
  (
    {
      src,
      poster,
      watermarkText,
      initialTime = 0,
      onTokenExpired,
      onEnded,
      onPlay,
      onPause,
      onTimeUpdate,
      endCard,
    },
    ref
  ) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const hlsRef = useRef<Hls | null>(null);
    const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const initialTimeAppliedRef = useRef(false);
    const initialTimeRef = useRef(initialTime);
    initialTimeRef.current = initialTime;

    const { isBlurred } = useVideoSecurity({ videoRef });

    const [isPlaying, setIsPlaying] = useState(false);
    const [isBuffering, setIsBuffering] = useState(true);
    const [progress, setProgress] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(() => {
      if (typeof window === 'undefined') return 1;
      const saved = localStorage.getItem('edusmart_player_volume');
      return saved !== null ? Number(saved) : 1;
    });
    const [isMuted, setIsMuted] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isCssFullscreen, setIsCssFullscreen] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [showEndCard, setShowEndCard] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(() => {
      if (typeof window === 'undefined') return 1;
      const saved = localStorage.getItem('edusmart_player_rate');
      return saved !== null ? Number(saved) : 1;
    });
    const [levels, setLevels] = useState<{ height: number; bitrate: number }[]>([]);
    const [currentLevel, setCurrentLevel] = useState<number>(-1); // -1 is Auto
    const [watermarkPos, setWatermarkPos] = useState({ top: 10, left: 10 });

    useImperativeHandle(ref, () => ({
      seek: (timeSeconds: number) => {
        if (videoRef.current) {
          videoRef.current.currentTime = timeSeconds;
          setShowEndCard(false);
        }
      },
      play: () => {
        videoRef.current?.play().catch(() => {});
      },
      pause: () => {
        videoRef.current?.pause();
      },
      restart: () => {
        if (videoRef.current) {
          videoRef.current.currentTime = 0;
          setShowEndCard(false);
          videoRef.current.play().catch(() => {});
        }
      },
      dismissEndCard: () => {
        setShowEndCard(false);
      },
      getCurrentTime: () => videoRef.current?.currentTime || 0,
    }));

    // Sync fullscreen state if user exits via Esc key
    useEffect(() => {
      const handleFullscreenChange = () => {
        setIsFullscreen(!!document.fullscreenElement);
      };
      document.addEventListener('fullscreenchange', handleFullscreenChange);
      return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    // iOS Safari / Fallback CSS Fullscreen Scroll Lock & Esc Key
    useEffect(() => {
      if (isCssFullscreen) {
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const handleKeyDown = (e: KeyboardEvent) => {
          if (e.key === 'Escape') {
            setIsCssFullscreen(false);
          }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
          document.body.style.overflow = originalOverflow;
          window.removeEventListener('keydown', handleKeyDown);
        };
      }
    }, [isCssFullscreen]);

    // Seek if initialTime arrives after video element metadata is already loaded
    useEffect(() => {
      const video = videoRef.current;
      if (!video || initialTimeAppliedRef.current || !initialTime || initialTime <= 0) return;
      if (video.readyState >= 1) {
        try {
          video.currentTime = initialTime;
          initialTimeAppliedRef.current = true;
        } catch {
          // ignore
        }
      }
    }, [initialTime]);

    // Initialize HLS or fallback
    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;
      initialTimeAppliedRef.current = false;
      setShowEndCard(false);

      if (!src) {
        setIsBuffering(false);
        return;
      }

      const streamSrc = src;

      const applyInitialTime = () => {
        const target = initialTimeRef.current;
        if (!initialTimeAppliedRef.current && target > 0 && Number.isFinite(target)) {
          try {
            video.currentTime = target;
            initialTimeAppliedRef.current = true;
          } catch {
            // ignore seek error on pre-init
          }
        }
      };

    if (Hls.isSupported()) {
      const hls = new Hls({
        capLevelToPlayerSize: true,
      });
      hlsRef.current = hls;

      hls.loadSource(streamSrc);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        setIsBuffering(false);
        setLevels(data.levels.map(l => ({ height: l.height, bitrate: l.bitrate })));
        applyInitialTime();
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
        setCurrentLevel(data.level);
      });

      hls.on(Hls.Events.ERROR, async (_event, data) => {
        if (data.response?.code === 403 && onTokenExpired) {
          logger.warn('video_player.token_expired_renewing');
          const newUrl = await onTokenExpired();
          if (newUrl && typeof newUrl === 'string') {
            hls.loadSource(newUrl);
            hls.startLoad();
            return;
          }
        }

        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari Native HLS Support
      video.src = streamSrc;
      video.addEventListener('loadedmetadata', () => {
        setIsBuffering(false);
        applyInitialTime();
      });
    } else {
      // Fallback
      video.src = src;
      video.addEventListener('loadedmetadata', () => {
        setIsBuffering(false);
        applyInitialTime();
      });
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [src, onTokenExpired]);

  // Apply saved playback rate and volume on video element mount/update
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
      videoRef.current.volume = volume;
      videoRef.current.muted = isMuted;
    }
  }, [playbackRate, volume, isMuted]);

  // Dynamic Floating Watermark
  useEffect(() => {
    if (!isPlaying) return;
    const moveWatermark = () => {
      setWatermarkPos({
        top: Math.random() * 75 + 5, // 5% to 80%
        left: Math.random() * 75 + 5,
      });
    };
    const interval = setInterval(moveWatermark, 5000);
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Play / Pause Toggle
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          logger.warn('Auto-play prevented', error);
          setIsPlaying(false);
        });
      }
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  // Quick Seek Helpers (Touch-friendly ±10s)
  const seekRelative = useCallback((deltaSeconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    const target = Math.min(video.duration || 0, Math.max(0, video.currentTime + deltaSeconds));
    video.currentTime = target;
    setShowEndCard(false);
  }, []);

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;

    const current = video.currentTime;
    const total = video.duration || 0;
    const pct = total > 0 ? (current / total) * 100 : 0;

    setCurrentTime(current);
    setDuration(total);
    setProgress(pct);

    if (onTimeUpdate) {
      onTimeUpdate(current, total, pct);
    }
  };

  const handleWaiting = () => setIsBuffering(true);
  const handlePlaying = () => {
    setIsBuffering(false);
    setIsPlaying(true);
    setShowEndCard(false);
    onPlay?.();
  };
  const handlePause = () => {
    setIsPlaying(false);
    onPause?.();
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setShowEndCard(true);
    if (onEnded) {
      onEnded();
    }
  };

  const handleSeek = (value: number[]) => {
    const video = videoRef.current;
    if (video && video.duration) {
      const newTime = (value[0] / 100) * video.duration;
      video.currentTime = newTime;
      setProgress(value[0]);
      setCurrentTime(newTime);
      setShowEndCard(false);
    }
  };

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    const video = videoRef.current;
    if (video) {
      video.volume = newVolume;
      setVolume(newVolume);
      setIsMuted(newVolume === 0);
      try {
        localStorage.setItem('edusmart_player_volume', String(newVolume));
      } catch {
        // ignore
      }
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (video) {
      const newMuted = !isMuted;
      video.muted = newMuted;
      setIsMuted(newMuted);
    }
  };

  const changePlaybackRate = (rate: number) => {
    const video = videoRef.current;
    if (video) {
      video.playbackRate = rate;
      setPlaybackRate(rate);
      try {
        localStorage.setItem('edusmart_player_rate', String(rate));
      } catch {
        // ignore
      }
    }
  };

  const changeQualityLevel = (levelIndex: number) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = levelIndex; // -1 for auto
      setCurrentLevel(levelIndex);
    }
  };

  // Fullscreen on container (Keeps overlays, watermarks, controls visible)
  const toggleFullscreen = async () => {
    const container = containerRef.current;
    if (!container) return;

    if (isCssFullscreen) {
      setIsCssFullscreen(false);
      return;
    }

    const hasNativeFullscreen = Boolean(
      (document.fullscreenEnabled || (document as any).webkitFullscreenEnabled) &&
      (container.requestFullscreen || (container as any).webkitRequestFullscreen)
    );

    if (hasNativeFullscreen) {
      try {
        if (!document.fullscreenElement && !(document as any).webkitFullscreenElement) {
          if (container.requestFullscreen) {
            await container.requestFullscreen();
          } else if ((container as any).webkitRequestFullscreen) {
            await (container as any).webkitRequestFullscreen();
          }
          setIsFullscreen(true);
          return;
        } else {
          if (document.exitFullscreen) {
            await document.exitFullscreen();
          } else if ((document as any).webkitExitFullscreen) {
            await (document as any).webkitExitFullscreen();
          }
          setIsFullscreen(false);
          return;
        }
      } catch (err) {
        logger.warn('Native fullscreen failed, falling back to CSS fullscreen', err);
      }
    }

    // iOS Safari / fallback
    setIsCssFullscreen((prev) => !prev);
  };

  // Auto-hide controls when idle
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  };

  // Keyboard Shortcuts (Disabled when typing in inputs/textareas)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) {
        return;
      }

      if (e.key === ' ' || e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        seekRelative(5);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        seekRelative(-5);
      } else if (e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        seekRelative(-10);
      } else if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        seekRelative(10);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const nextVol = Math.min(1, volume + 0.1);
        handleVolumeChange([nextVol]);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const nextVol = Math.max(0, volume - 0.1);
        handleVolumeChange([nextVol]);
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        toggleMute();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [togglePlay, seekRelative, volume]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full bg-black select-none outline-none ${
        isCssFullscreen
          ? 'fixed inset-0 z-[9999] w-screen h-screen h-[100dvh] rounded-none m-0 p-0 shadow-none'
          : 'aspect-video rounded-xl overflow-hidden shadow-2xl group'
      } ${isBlurred ? 'blur-2xl' : ''}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      onContextMenu={(e) => e.preventDefault()}
      tabIndex={0}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        poster={poster}
        className="w-full h-full object-contain cursor-pointer"
        onTimeUpdate={handleTimeUpdate}
        onWaiting={handleWaiting}
        onPlaying={handlePlaying}
        onPause={handlePause}
        onEnded={handleEnded}
        onClick={togglePlay}
        controls={false} // Strict custom controls
        playsInline
      />

      {/* Buffering Spinner */}
      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none bg-black/30 backdrop-blur-[1px]">
          <Loader2 size={48} className="text-primary animate-spin" />
        </div>
      )}

      {/* Dynamic Watermark overlay */}
      {isPlaying && !isBuffering && (
        <div
          className="absolute pointer-events-none text-white/35 text-xs sm:text-sm font-bold font-mono transition-all ease-in-out whitespace-nowrap z-10 drop-shadow-md"
          style={{
            transitionDuration: "4000ms",
            top: `${watermarkPos.top}%`,
            left: `${watermarkPos.left}%`,
          }}
        >
          {watermarkText}
        </div>
      )}

      {/* Security Overlay Warning when blurred */}
      {isBlurred && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-50 p-4 text-center">
          <p className="text-red-400 font-bold text-sm sm:text-base px-5 py-3 bg-red-950/80 rounded-xl border border-red-500/60 shadow-xl">
            تم الإيقاف المؤقت (يرجى التركيز على نافذة المتصفح)
          </p>
        </div>
      )}

      {/* Big Play Button Overlay */}
      {!isPlaying && !isBlurred && !isBuffering && !showEndCard && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center z-10 bg-black/25 transition-opacity"
          aria-label="تشغيل الفيديو"
        >
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-primary/90 hover:bg-primary rounded-full flex items-center justify-center text-white shadow-2xl transition-transform hover:scale-110">
            <Play size={32} className="ms-1 fill-current" />
          </div>
        </button>
      )}

      {/* End-Card Overlay (Displayed inside container so it persists across Fullscreen / iOS modes) */}
      {showEndCard && endCard && (
        <div className="absolute inset-0 z-30 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-300">
          {endCard}
        </div>
      )}

      {/* Custom Controls Bottom Bar - STRICT dir="ltr" */}
      <div
        dir="ltr"
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent pt-14 pb-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] px-3 sm:px-4 transition-opacity duration-300 z-20 ${
          showControls || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress Slider */}
        <div className="mb-3 cursor-pointer group/slider py-1">
          <Slider
            value={[progress]}
            max={100}
            step={0.1}
            onValueChange={handleSeek}
            className="[&_[role=slider]]:h-3.5 [&_[role=slider]]:w-3.5 [&_[role=slider]]:bg-primary [&_[role=slider]]:border-2 [&_[role=slider]]:border-white"
            aria-label="شريط تقدم الفيديو"
          />
        </div>

        {/* Controls Row */}
        <div className="flex items-center justify-between text-white gap-2 text-xs sm:text-sm">
          {/* Left Group (LTR): Play/Pause, ±10s, Volume, Time */}
          <div className="flex items-center gap-1.5 sm:gap-3">
            {/* Play/Pause */}
            <button
              onClick={togglePlay}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center hover:text-primary transition-colors focus:outline-none rounded-lg"
              aria-label={isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}
            >
              {isPlaying ? <Pause size={20} className="fill-current" /> : <Play size={20} className="fill-current" />}
            </button>

            {/* Quick Seek -10s */}
            <button
              onClick={() => seekRelative(-10)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center hover:text-primary transition-colors focus:outline-none rounded-lg relative"
              aria-label="تأخير 10 ثوانٍ"
              title="تأخير 10 ثوانٍ (J)"
            >
              <RotateCcw size={18} />
              <span className="absolute text-[8px] font-bold mt-0.5">10</span>
            </button>

            {/* Quick Seek +10s */}
            <button
              onClick={() => seekRelative(10)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center hover:text-primary transition-colors focus:outline-none rounded-lg relative"
              aria-label="تقديم 10 ثوانٍ"
              title="تقديم 10 ثوانٍ (L)"
            >
              <RotateCw size={18} />
              <span className="absolute text-[8px] font-bold mt-0.5">10</span>
            </button>

            {/* Volume Control */}
            <div className="flex items-center gap-1.5 group/volume">
              <button
                onClick={toggleMute}
                className="min-h-[44px] min-w-[36px] flex items-center justify-center hover:text-primary transition-colors focus:outline-none rounded-lg"
                aria-label={isMuted || volume === 0 ? 'إلغاء كتم الصوت' : 'كتم الصوت'}
              >
                {isMuted || volume === 0 ? <VolumeX size={19} /> : <Volume2 size={19} />}
              </button>
              <div className="w-0 overflow-hidden group-hover/volume:w-20 transition-all duration-300 ease-in-out hidden sm:block">
                <Slider
                  value={[isMuted ? 0 : volume]}
                  max={1}
                  step={0.05}
                  onValueChange={handleVolumeChange}
                  className="w-16 sm:w-20 [&_[role=slider]]:h-3 [&_[role=slider]]:w-3"
                  aria-label="مستوى الصوت"
                />
              </div>
            </div>

            {/* Digital Time Display (Current / Duration) */}
            <div className="font-mono text-[11px] sm:text-xs text-slate-300 select-none ps-1">
              <span className="text-white font-bold">{formatTime(currentTime)}</span>
              <span className="text-slate-500 mx-1">/</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Right Group (LTR): Speed, Quality, Fullscreen */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Playback Rate Dropdown */}
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger
                className="min-h-[44px] px-2 flex items-center justify-center hover:text-primary font-bold font-mono transition-colors focus:outline-none outline-none rounded-lg text-xs sm:text-sm"
                aria-label="سرعة التشغيل"
              >
                {playbackRate}x
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-slate-900/95 border-slate-700 text-white min-w-[100px] z-50">
                {PLAYBACK_RATES.map((rate) => (
                  <DropdownMenuItem
                    key={rate}
                    onClick={() => changePlaybackRate(rate)}
                    className={`cursor-pointer hover:bg-slate-800 ${playbackRate === rate ? 'text-primary font-bold' : ''}`}
                  >
                    {rate}x
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Quality Settings Dropdown */}
            {levels.length > 0 && (
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger
                  className="min-h-[44px] min-w-[36px] flex items-center justify-center hover:text-primary transition-colors focus:outline-none outline-none rounded-lg"
                  aria-label="جودة الفيديو"
                >
                  <Settings size={18} />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-slate-900/95 border-slate-700 text-white min-w-[110px] z-50">
                  <DropdownMenuItem
                    onClick={() => changeQualityLevel(-1)}
                    className={`cursor-pointer hover:bg-slate-800 ${currentLevel === -1 ? 'text-primary font-bold' : ''}`}
                  >
                    Auto
                  </DropdownMenuItem>
                  {[...levels].reverse().map((level, i) => {
                    const originalIndex = levels.length - 1 - i;
                    return (
                      <DropdownMenuItem
                        key={originalIndex}
                        onClick={() => changeQualityLevel(originalIndex)}
                        className={`cursor-pointer hover:bg-slate-800 ${currentLevel === originalIndex ? 'text-primary font-bold' : ''}`}
                      >
                        {level.height}p
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Fullscreen Button */}
            <button
              onClick={toggleFullscreen}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center hover:text-primary transition-colors focus:outline-none rounded-lg"
              aria-label={isFullscreen || isCssFullscreen ? 'تصغير الشاشة' : 'ملء الشاشة'}
              title="ملء الشاشة (F)"
            >
              {isFullscreen || isCssFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

SecureVideoPlayer.displayName = 'SecureVideoPlayer';

export default SecureVideoPlayer;
