import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Pause, RotateCcw, Volume2, VolumeX, Maximize, Minimize, Flame,
  Sparkles, Music, CheckCircle2, ArrowRight, ShieldAlert, BookOpen,
  History, CheckSquare, Plus, Trash2, Moon, Sun, Bell, AlertTriangle
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import confetti from "canvas-confetti";
import { FeatureGate } from "@/components/FeatureGate";
import { useEnrollments } from "@/features/courses/hooks";
import { submitFocusSession, getFocusSessionHistory, FocusSessionPayload } from "@/features/analytics/focusApi";
import { logger } from "@/lib/logger";

type TimerMode = "pomodoro" | "deep_work" | "custom" | "shortBreak" | "longBreak";

interface SessionPreset {
  name: string;
  minutes: number;
  breakMinutes: number;
  isBreak?: boolean;
}

const PRESETS: Record<TimerMode, SessionPreset> = {
  pomodoro: { name: "جلسة بومودورو (25 د)", minutes: 25, breakMinutes: 5 },
  deep_work: { name: "عمل عميق (50 د)", minutes: 50, breakMinutes: 10 },
  custom: { name: "جلسة مخصصة", minutes: 30, breakMinutes: 5 },
  shortBreak: { name: "استراحة قصيرة", minutes: 5, breakMinutes: 0, isBreak: true },
  longBreak: { name: "استراحة طويلة", minutes: 15, breakMinutes: 0, isBreak: true },
};

const AMBIENT_SOUNDS = [
  { id: "rain", name: "صوت المطر والهدوء", url: "https://actions.google.com/sounds/v1/weather/rain_heavy_loud.ogg", freq: 220 },
  { id: "waves", name: "أمواج البحر المتلاطمة", url: "https://actions.google.com/sounds/v1/water/ocean_waves.ogg", freq: 150 },
  { id: "fireplace", name: "دفء المدفأة", url: "https://actions.google.com/sounds/v1/household/fireplace_crackle.ogg", freq: 180 },
  { id: "lofi", name: "أنغام Lo-Fi هادئة", url: "https://actions.google.com/sounds/v1/ambiences/coffee_shop.ogg", freq: 440 },
];

interface TaskItem {
  id: string;
  text: string;
  completed: boolean;
}

interface LocalSessionState {
  sessionId: string;
  startTimeIso: string;
  mode: TimerMode;
  totalDurationSeconds: number;
  timeLeftSeconds: number;
  distractionsCount: number;
  secondsAway: number;
  isRunning: boolean;
  selectedCourseId: number | null;
  tasks: TaskItem[];
  strictMode: boolean;
}

export const FocusModePage = () => {
  const navigate = useNavigate();

  // 1. Session Setup & State
  const [mode, setMode] = useState<TimerMode>("pomodoro");
  const [customMinutes, setCustomMinutes] = useState(30);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [completedSessions, setCompletedSessions] = useState(0);

  // Session Identification & Timestamps
  const [sessionId, setSessionId] = useState<string>(() => "focus-" + Math.random().toString(36).substring(2, 11));
  const [startTimeIso, setStartTimeIso] = useState<string | null>(null);

  // Distraction & Focus Enforcement Engine
  const [distractionsCount, setDistractionsCount] = useState(0);
  const [secondsAway, setSecondsAway] = useState(0);
  const [strictMode, setStrictMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const awayStartTimeRef = useRef<number | null>(null);

  // Session Tasks Checklist & Goal Linking
  const [tasks, setTasks] = useState<TaskItem[]>([
    { id: "t1", text: "مراجعة الدرس وتدوين الملاحظات", completed: false }
  ]);
  const [newTaskText, setNewTaskText] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);

  // Visual Theme & History Drawer
  const [isFocusTheme, setIsFocusTheme] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);

  // Audio Ambient Player & Synthesizer Fallback
  const [selectedSound, setSelectedSound] = useState<string | null>(null);
  const [volume, setVolume] = useState([50]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  // Real Backend Enrollments Integration
  const { data: enrollmentsRaw } = useEnrollments();
  const enrollmentsList = useMemo(() => {
    if (Array.isArray(enrollmentsRaw)) return enrollmentsRaw;
    return (enrollmentsRaw as any)?.results || (enrollmentsRaw as any)?.data || [];
  }, [enrollmentsRaw]);

  // Web Worker Off-Thread Timer Ref
  const workerRef = useRef<Worker | null>(null);
  const handleSessionCompletedRef = useRef<() => void>(() => {});

  // ---------------------------------------------------------
  // 2. Off-Thread Web Worker Initialization & Ticking Engine
  // ---------------------------------------------------------
  useEffect(() => {
    const workerCode = `
      let timer = null;
      self.onmessage = function(e) {
        if (e.data === 'START') {
          if (timer) clearInterval(timer);
          timer = setInterval(function() {
            self.postMessage('TICK');
          }, 1000);
        } else if (e.data === 'PAUSE' || e.data === 'STOP') {
          if (timer) clearInterval(timer);
          timer = null;
        }
      };
    `;
    const blob = new Blob([workerCode], { type: "application/javascript" });
    const workerUrl = URL.createObjectURL(blob);
    const worker = new Worker(workerUrl);
    workerRef.current = worker;

    worker.onmessage = (e) => {
      if (e.data === "TICK") {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleSessionCompletedRef.current();
            return 0;
          }
          return prev - 1;
        });
      }
    };

    // Request Browser Notification Permission
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }

    return () => {
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
    };
  }, []);

  // Control Worker Ticking when `isRunning` changes
  useEffect(() => {
    if (isRunning) {
      workerRef.current?.postMessage("START");
    } else {
      workerRef.current?.postMessage("PAUSE");
    }
  }, [isRunning]);

  // ---------------------------------------------------------
  // 3. Auto-Resume & Offline Storage Persistence
  // ---------------------------------------------------------
  useEffect(() => {
    const savedState = localStorage.getItem("edusmart_focus_session");
    if (savedState) {
      try {
        const parsed: LocalSessionState = JSON.parse(savedState);
        if (parsed.timeLeftSeconds > 0 && parsed.isRunning) {
          // Calculate elapsed seconds since last saved timestamp
          const elapsed = Math.floor((Date.now() - new Date(parsed.startTimeIso).getTime()) / 1000);
          const remaining = Math.max(0, parsed.totalDurationSeconds - elapsed);
          
          setSessionId(parsed.sessionId);
          setStartTimeIso(parsed.startTimeIso);
          setMode(parsed.mode);
          setTimeLeft(remaining);
          setDistractionsCount(parsed.distractionsCount);
          setSecondsAway(parsed.secondsAway);
          setSelectedCourseId(parsed.selectedCourseId);
          setTasks(parsed.tasks || []);
          setStrictMode(parsed.strictMode || false);
          setIsRunning(remaining > 0);
        }
      } catch (e) {
        logger.warn("Failed to restore focus session state:", e);
      }
    }
  }, []);

  const totalSessionSeconds = mode === "custom" ? customMinutes * 60 : PRESETS[mode].minutes * 60;

  // Continuously sync state to localStorage
  useEffect(() => {
    if (isRunning && startTimeIso) {
      const stateToSave: LocalSessionState = {
        sessionId,
        startTimeIso,
        mode,
        totalDurationSeconds: totalSessionSeconds,
        timeLeftSeconds: timeLeft,
        distractionsCount,
        secondsAway,
        isRunning,
        selectedCourseId,
        tasks,
        strictMode
      };
      localStorage.setItem("edusmart_focus_session", JSON.stringify(stateToSave));
    } else if (!isRunning && timeLeft === totalSessionSeconds) {
      localStorage.removeItem("edusmart_focus_session");
    }
  }, [isRunning, startTimeIso, sessionId, mode, totalSessionSeconds, timeLeft, distractionsCount, secondsAway, selectedCourseId, tasks, strictMode]);

  // ---------------------------------------------------------
  // 4. Distraction Detection Engine & Focus Score Calculation
  // ---------------------------------------------------------
  const calculateFocusScore = useCallback(() => {
    if (distractionsCount === 0 && secondsAway === 0) return 100;
    const penalty = (distractionsCount * 10) + Math.floor(secondsAway / 10) * 5;
    return Math.max(0, 100 - penalty);
  }, [distractionsCount, secondsAway]);

  useEffect(() => {
    const handleVisibilityOrBlur = () => {
      if (!isRunning || PRESETS[mode].isBreak) return;

      if (document.hidden || !document.hasFocus()) {
        if (!awayStartTimeRef.current) {
          awayStartTimeRef.current = Date.now();
          setDistractionsCount((prev) => prev + 1);
        }
      } else {
        if (awayStartTimeRef.current) {
          const awayDurationSecs = Math.floor((Date.now() - awayStartTimeRef.current) / 1000);
          setSecondsAway((prev) => prev + awayDurationSecs);
          awayStartTimeRef.current = null;
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityOrBlur);
    window.addEventListener("blur", handleVisibilityOrBlur);
    window.addEventListener("focus", handleVisibilityOrBlur);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityOrBlur);
      window.removeEventListener("blur", handleVisibilityOrBlur);
      window.removeEventListener("focus", handleVisibilityOrBlur);
    };
  }, [isRunning, mode]);

  // Exit Friction (beforeunload)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isRunning && !PRESETS[mode].isBreak) {
        e.preventDefault();
        e.returnValue = "سوف تخسر التقدّم والـ Streak الحالي إن خرجت قبل نهاية الجلسة!";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isRunning, mode]);

  // Strict Mode Fullscreen Monitor
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFull = !!document.fullscreenElement;
      setIsFullscreen(isFull);
      if (strictMode && isRunning && !isFull && !PRESETS[mode].isBreak) {
        setDistractionsCount((prev) => prev + 1);
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [strictMode, isRunning, mode]);

  // ---------------------------------------------------------
  // 5. Session Handlers & End-of-Session Batch API Sync
  // ---------------------------------------------------------
  const getTotalDurationSeconds = (): number => {
    if (mode === "custom") return customMinutes * 60;
    return PRESETS[mode].minutes * 60;
  };

  const handleStartSession = () => {
    if (!startTimeIso) {
      setStartTimeIso(new Date().toISOString());
    }
    if (strictMode && !document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
    setIsRunning(true);
  };

  const handlePauseSession = () => {
    setIsRunning(false);
  };

  const handleResetSession = () => {
    if (isRunning && !PRESETS[mode].isBreak) {
      if (!window.confirm("هل أنت تأكد من إعادة إعداد الجلسة؟ سيفقد التقدّم الحالي.")) {
        return;
      }
    }
    setIsRunning(false);
    workerRef.current?.postMessage("STOP");
    setTimeLeft(getTotalDurationSeconds());
    setDistractionsCount(0);
    setSecondsAway(0);
    setStartTimeIso(null);
    setSessionId("focus-" + Math.random().toString(36).substring(2, 11));
    localStorage.removeItem("edusmart_focus_session");
  };

  const switchMode = (newMode: TimerMode) => {
    if (isRunning && !PRESETS[mode].isBreak) {
      if (!window.confirm("تغيير النمط أثناء الجلسة سيعيد ضبط التايمر. هل ترغب في المتابعة؟")) {
        return;
      }
    }
    setMode(newMode);
    setIsRunning(false);
    workerRef.current?.postMessage("STOP");
    
    let duration = 25 * 60;
    if (newMode === "custom") duration = customMinutes * 60;
    else duration = PRESETS[newMode].minutes * 60;
    
    setTimeLeft(duration);
    setDistractionsCount(0);
    setSecondsAway(0);
    setStartTimeIso(null);
    setSessionId("focus-" + Math.random().toString(36).substring(2, 11));
    localStorage.removeItem("edusmart_focus_session");
  };

  const handleSessionCompleted = async () => {
    setIsRunning(false);
    workerRef.current?.postMessage("STOP");
    localStorage.removeItem("edusmart_focus_session");

    const focusScore = calculateFocusScore();
    const isFocused = focusScore >= 50 && distractionsCount < 5;

    if (!PRESETS[mode].isBreak) {
      setCompletedSessions((prev) => prev + 1);
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });

      // Trigger Desktop Push Notification
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("🎉 اكتملت جلسة التركيز بنجاح!", {
          body: `أحسنت! درجة تركيزك: ${focusScore}%. استرح الآن لمدة ${PRESETS[mode].breakMinutes} دقائق!`,
          icon: "/favicon.ico"
        });
      }

      // Single Batch POST Payload to Backend
      const payload: FocusSessionPayload = {
        session_id: sessionId,
        start_time: startTimeIso || new Date().toISOString(),
        end_time: new Date().toISOString(),
        duration_seconds: getTotalDurationSeconds(),
        focused: isFocused,
        focus_score: focusScore,
        mode: mode === "shortBreak" || mode === "longBreak" ? "pomodoro" : mode,
        distractions_count: distractionsCount,
        course_id: selectedCourseId
      };

      try {
        await submitFocusSession(payload);
      } catch (err) {
        logger.warn("Error posting focus session to server:", err);
      }
    } else {
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("⏰ انتهت الاستراحة!", {
          body: "حان وقت العودة للجلسة المركزة وإكمال الإنجازات!",
          icon: "/favicon.ico"
        });
      }
    }
  };

  handleSessionCompletedRef.current = handleSessionCompleted;

  // ---------------------------------------------------------
  // 6. Ambient Sound Synthesizer & Controls
  // ---------------------------------------------------------
  const toggleSound = (soundId: string) => {
    if (selectedSound === soundId) {
      stopAmbientSound();
      setSelectedSound(null);
    } else {
      setSelectedSound(soundId);
      startAmbientSound(soundId);
    }
  };

  const startAmbientSound = (soundId: string) => {
    stopAmbientSound();
    const sound = AMBIENT_SOUNDS.find((s) => s.id === soundId);
    if (!sound || !sound.url) return;

    try {
      const audio = new Audio(sound.url);
      audio.loop = true;
      audio.volume = Math.max(0, Math.min(1, volume[0] / 100));
      audio.play().catch((err) => {
        console.warn("Audio playback interrupted by browser autoplay policy:", err);
      });
      audioElementRef.current = audio;
    } catch (e) {
      console.warn("Audio element error:", e);
    }
  };

  const stopAmbientSound = () => {
    if (audioElementRef.current) {
      try {
        audioElementRef.current.pause();
        audioElementRef.current.currentTime = 0;
      } catch (_e) {
        // Ignore audio pause errors
      }
      audioElementRef.current = null;
    }
  };

  useEffect(() => {
    if (audioElementRef.current) {
      audioElementRef.current.volume = Math.max(0, Math.min(1, volume[0] / 100));
    }
  }, [volume]);

  useEffect(() => {
    return () => stopAmbientSound();
  }, []);

  // Fullscreen Handler
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Task Handlers
  const handleAddTask = () => {
    if (!newTaskText.trim()) return;
    setTasks((prev) => [...prev, { id: "t-" + Date.now(), text: newTaskText.trim(), completed: false }]);
    setNewTaskText("");
  };

  const handleToggleTask = (id: string) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)));
  };

  const handleDeleteTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  // Fetch History Modal
  const handleOpenHistory = async () => {
    setShowHistoryModal(true);
    try {
      const data = await getFocusSessionHistory();
      const logs = Array.isArray(data) ? data : (data?.results || []);
      setHistoryLogs(logs);
    } catch (e) {
      console.warn("Failed to load focus history:", e);
    }
  };

  // Timer Display Computations
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const totalDuration = getTotalDurationSeconds();
  const progressPercent = totalDuration > 0 ? ((totalDuration - timeLeft) / totalDuration) * 100 : 0;
  const currentFocusScore = calculateFocusScore();

  return (
    <FeatureGate feature="focus_mode">
      <div className={`min-h-screen flex flex-col justify-between p-4 md:p-6 transition-colors duration-500 dir-rtl ${
        isFocusTheme ? "bg-slate-950 text-slate-100" : "bg-background text-foreground"
      }`}>
        {/* Header Navigation Toolbar */}
        <div className="flex items-center justify-between gap-2 max-w-6xl mx-auto w-full">
          <Button
            variant="ghost"
            onClick={() => navigate("/dashboard")}
            className="gap-2 text-xs md:text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowRight className="w-4 h-4 rtl:rotate-180" />
            العودة للوحة التحكم
          </Button>

          <div className="flex items-center gap-2 md:gap-4">
            {/* Daily Streak & Completed Sessions Badge */}
            <div className="flex items-center gap-2 bg-muted/40 px-3.5 py-1.5 rounded-full border border-border/50 text-xs font-semibold">
              <Flame className="w-4 h-4 text-amber-500 animate-pulse" />
              <span>جلسات اليوم: <strong className="text-primary">{completedSessions}</strong></span>
            </div>

            {/* History Modal Trigger */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenHistory}
              className="gap-1.5 text-xs rounded-full border-border/60"
            >
              <History className="w-3.5 h-3.5 text-primary" />
              <span className="hidden sm:inline">السجل والتحليلات</span>
            </Button>

            {/* Dark Focus Theme Toggle */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => setIsFocusTheme(!isFocusTheme)}
              className="rounded-full w-8 h-8 md:w-9 md:h-9"
              title="تبديل ثيم التركيز الداكن"
            >
              {isFocusTheme ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </Button>

            {/* Fullscreen Mode */}
            <Button
              variant="outline"
              size="icon"
              onClick={toggleFullscreen}
              className="rounded-full w-8 h-8 md:w-9 md:h-9"
              title="ملء الشاشة"
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {/* Main Focus Room Canvas */}
        <div className="flex flex-col items-center justify-center max-w-2xl mx-auto w-full space-y-6 my-auto py-4">
          {/* Mode Switcher Buttons */}
          <div className="flex flex-wrap items-center justify-center bg-muted/60 p-1.5 rounded-2xl border border-border/60 gap-1 max-w-full">
            {(["pomodoro", "deep_work", "custom", "shortBreak", "longBreak"] as TimerMode[]).map((m) => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 ${
                  mode === m
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {PRESETS[m].name}
              </button>
            ))}
          </div>

          {/* Custom Duration Slider (if mode === 'custom') */}
          {mode === "custom" && !isRunning && (
            <div className="w-full max-w-md bg-card/60 p-4 rounded-2xl border border-border/50 space-y-2">
              <div className="flex justify-between text-xs font-semibold">
                <span>مدة الجلسة المخصصة:</span>
                <span className="text-primary font-mono">{customMinutes} دقيقة</span>
              </div>
              <Slider
                value={[customMinutes]}
                onValueChange={(val) => {
                  setCustomMinutes(val[0]);
                  setTimeLeft(val[0] * 60);
                }}
                min={5}
                max={120}
                step={5}
              />
            </div>
          )}

          {/* Course Goal Link & Strict Mode Selector */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-md">
            <div className="flex items-center gap-2 bg-card/80 px-3 py-1.5 rounded-xl border border-border/60 w-full flex-1">
              <BookOpen className="w-4 h-4 text-primary shrink-0" />
              <select
                value={selectedCourseId || ""}
                onChange={(e) => setSelectedCourseId(e.target.value ? Number(e.target.value) : null)}
                disabled={isRunning}
                className="bg-transparent text-xs font-bold outline-none w-full text-foreground cursor-pointer"
              >
                <option value="">ربط المذاكرة بمادة دراسية (اختياري)...</option>
                {enrollmentsList.map((e: any) => {
                  const courseId = e.courseId || e.course?.id || e.course;
                  const courseTitle = e.course_title || e.course?.title || `دورة #${courseId}`;
                  return (
                    <option key={courseId} value={courseId}>
                      {courseTitle}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Strict Mode Toggle */}
            <button
              onClick={() => setStrictMode(!strictMode)}
              disabled={isRunning}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shrink-0 ${
                strictMode
                  ? "bg-amber-500/10 border-amber-500/50 text-amber-600 dark:text-amber-400"
                  : "border-border/60 text-muted-foreground"
              }`}
              title="نمط التركيز الصارم يفرض الشاشة الكاملة ورصد المغادرة الفورية"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>النمط الصارم: {strictMode ? "مميّز" : "معطل"}</span>
            </button>
          </div>

          {/* Dynamic Focus Score & Distraction Monitor Badge */}
          {isRunning && !PRESETS[mode].isBreak && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-4 bg-muted/40 px-4 py-2 rounded-2xl border border-border/60 text-xs"
            >
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">مؤشر التركيز الحلي:</span>
                <strong className={`font-mono text-sm ${
                  currentFocusScore >= 80 ? "text-emerald-500" : currentFocusScore >= 50 ? "text-amber-500" : "text-destructive"
                }`}>
                  {currentFocusScore}%
                </strong>
              </div>
              <div className="h-3 w-px bg-border" />
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                <span>التشتت: <strong className="text-foreground">{distractionsCount}</strong> مرات</span>
              </div>
            </motion.div>
          )}

          {/* Circular SVG Timer Canvas */}
          <div className="relative flex items-center justify-center w-72 h-72 md:w-80 md:h-80">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="44" stroke="currentColor" strokeWidth="4" className="text-muted/30" fill="transparent" />
              <circle
                cx="50"
                cy="50"
                r="44"
                stroke="currentColor"
                strokeWidth="4"
                className={`transition-all duration-1000 ease-linear ${
                  PRESETS[mode].isBreak ? "text-emerald-500" : "text-primary"
                }`}
                fill="transparent"
                strokeDasharray={276}
                strokeDashoffset={276 - (276 * progressPercent) / 100}
                strokeLinecap="round"
              />
            </svg>

            <div className="absolute flex flex-col items-center justify-center text-center space-y-1">
              <span className="text-5xl md:text-6xl font-bold tracking-tight font-mono text-foreground">
                {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
              </span>
              <span className="text-xs font-semibold text-muted-foreground">
                {PRESETS[mode].name}
              </span>
            </div>
          </div>

          {/* Action Control Buttons */}
          <div className="flex items-center gap-4">
            {!isRunning ? (
              <Button
                size="lg"
                onClick={handleStartSession}
                className="px-10 rounded-full h-14 text-base font-bold gradient-cta text-white shadow-xl hover:opacity-90 transition-all gap-2"
              >
                <Play className="w-5 h-5 fill-current ml-0.5" />
                بدء الجلسة
              </Button>
            ) : (
              <Button
                size="lg"
                onClick={handlePauseSession}
                variant="outline"
                className="px-10 rounded-full h-14 text-base font-bold border-amber-500/50 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 gap-2"
              >
                <Pause className="w-5 h-5 fill-current" />
                إيقاف مؤقت
              </Button>
            )}

            <Button
              variant="outline"
              size="icon"
              onClick={handleResetSession}
              className="w-14 h-14 rounded-full border-border/80"
              title="إعادة ضبط الجلسة"
            >
              <RotateCcw className="w-5 h-5 text-muted-foreground" />
            </Button>
          </div>
        </div>

        {/* Bottom Section: Checklist & Ambient Audio Synthesizer Dock */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-5xl mx-auto w-full">
          {/* Tasks Checklist Card */}
          <Card className="p-4 glass rounded-2xl border-border/60 shadow-lg flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold">
                <CheckSquare className="w-4 h-4 text-primary" />
                <span>قائمة مهمات الجلسة ({tasks.filter(t => t.completed).length}/{tasks.length}):</span>
              </div>
            </div>

            <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
              {tasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between gap-2 p-2 rounded-xl bg-muted/30 border border-border/40 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={() => handleToggleTask(task.id)}
                      className="w-4 h-4 rounded border-border accent-primary shrink-0"
                    />
                    <span className={`truncate ${task.completed ? "line-through text-muted-foreground" : "font-medium"}`}>
                      {task.text}
                    </span>
                  </label>
                  <button onClick={() => handleDeleteTask(task.id)} className="text-muted-foreground hover:text-destructive p-1">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Input
                placeholder="إضافة مهمة مذاكرة جديدة..."
                value={newTaskText}
                onChange={(e) => setNewTaskText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
                className="text-xs rounded-xl bg-background/80"
              />
              <Button size="sm" onClick={handleAddTask} className="rounded-xl shrink-0 text-xs gap-1">
                <Plus className="w-3.5 h-3.5" /> إضافة
              </Button>
            </div>
          </Card>

          {/* Ambient Sound Dock */}
          <Card className="p-4 glass rounded-2xl border-border/60 shadow-lg flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs font-bold">
                <Music className="w-4 h-4 text-primary" />
                <span>الخلفيات الصوتية المحفزة:</span>
              </div>
              <div className="flex items-center gap-3 w-1/3">
                {selectedSound ? <Volume2 className="w-4 h-4 text-primary shrink-0" /> : <VolumeX className="w-4 h-4 text-muted-foreground shrink-0" />}
                <Slider value={volume} onValueChange={setVolume} max={100} step={1} />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {AMBIENT_SOUNDS.map((sound) => (
                <button
                  key={sound.id}
                  onClick={() => toggleSound(sound.id)}
                  className={`p-2.5 rounded-xl border text-xs font-medium transition-all duration-200 text-center ${
                    selectedSound === sound.id
                      ? "bg-primary/10 border-primary text-primary shadow-xs font-bold"
                      : "border-border/50 text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  {sound.name}
                </button>
              ))}
            </div>
          </Card>
        </div>

        {/* History & Analytics Modal */}
        <AnimatePresence>
          {showHistoryModal && (
            <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-md flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-card border border-border/80 p-6 rounded-3xl max-w-xl w-full shadow-2xl space-y-4 max-h-[85vh] flex flex-col"
              >
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <div className="flex items-center gap-2 font-bold text-base">
                    <History className="w-5 h-5 text-primary" />
                    <span>سجل جلسات التركيز والإنجازات</span>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setShowHistoryModal(false)} className="rounded-xl">
                    إغلاق
                  </Button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                  {historyLogs.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground space-y-2">
                      <Sparkles className="w-10 h-10 mx-auto text-primary opacity-50" />
                      <p className="font-bold text-sm">لا توجد جلسات مسجلة سابقاً في الباك إند</p>
                      <p className="text-xs">أكمل أول جلسة بومودورو لتزامن إنجازاتك تلقائياً!</p>
                    </div>
                  ) : (
                    historyLogs.map((log: any) => (
                      <div key={log.id} className="p-3.5 rounded-2xl bg-muted/40 border border-border/50 flex items-center justify-between text-xs">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 font-bold">
                            <Badge variant="outline" className="text-[10px] uppercase">{log.mode}</Badge>
                            <span>مدة {Math.round(log.duration_seconds / 60)} دقيقة</span>
                          </div>
                          <p className="text-muted-foreground text-[11px]">
                            {new Date(log.start_time).toLocaleDateString("ar-EG")} | عدد التشتت: {log.distractions_count}
                          </p>
                        </div>
                        <div className="text-left">
                          <span className={`font-mono font-bold text-sm ${
                            log.focus_score >= 80 ? "text-emerald-500" : log.focus_score >= 50 ? "text-amber-500" : "text-destructive"
                          }`}>
                            {log.focus_score}%
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </FeatureGate>
  );
};

export default FocusModePage;
