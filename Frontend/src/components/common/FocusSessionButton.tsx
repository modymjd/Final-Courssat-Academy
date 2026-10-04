import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Flame, Play, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ActiveFocusSession {
  sessionId: string;
  startTimeIso: string;
  totalDurationSeconds: number;
  timeLeftSeconds: number;
  isRunning: boolean;
  mode?: string;
}

export function FocusSessionButton() {
  const [session, setSession] = useState<ActiveFocusSession | null>(null);
  const [displaySeconds, setDisplaySeconds] = useState<number | null>(null);

  const checkSession = () => {
    try {
      const saved = localStorage.getItem('edusmart_focus_session');
      if (saved) {
        const parsed: ActiveFocusSession = JSON.parse(saved);
        if (parsed && parsed.isRunning && parsed.startTimeIso) {
          const elapsed = Math.floor((Date.now() - new Date(parsed.startTimeIso).getTime()) / 1000);
          const remaining = Math.max(0, parsed.totalDurationSeconds - elapsed);

          if (remaining > 0) {
            setSession(parsed);
            setDisplaySeconds(remaining);
            return;
          }
        }
      }
    } catch {
      /* ignore storage parsing error */
    }
    setSession(null);
    setDisplaySeconds(null);
  };

  useEffect(() => {
    checkSession();
    const interval = setInterval(checkSession, 1000);
    window.addEventListener('storage', checkSession);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', checkSession);
    };
  }, []);

  const formatTime = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isSessionActive = session && session.isRunning && displaySeconds !== null && displaySeconds > 0;

  return (
    <AnimatePresence mode="wait">
      {isSessionActive ? (
        <motion.div
          key="active-timer"
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.85, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        >
          <Button
            asChild
            size="sm"
            className="relative overflow-hidden rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 text-white font-bold shadow-lg shadow-emerald-500/25 ring-2 ring-emerald-400/40 hover:brightness-110 transition-all gap-2 px-4 py-2"
          >
            <Link to="/student/focus" className="flex items-center gap-2">
              {/* Glowing Pulse Ring Background */}
              <span className="absolute inset-0 bg-white/10 animate-pulse pointer-events-none" />

              {/* Animated Flame Icon */}
              <div className="relative flex items-center justify-center">
                <Flame className="w-4 h-4 text-amber-300 animate-bounce" />
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-300 rounded-full animate-ping" />
              </div>

              {/* Text & Live Countdown */}
              <div className="flex items-center gap-1.5 font-mono text-xs tracking-wider">
                <span className="font-sans font-semibold text-white/90">جلسة تركيز:</span>
                <span className="bg-black/30 px-2 py-0.5 rounded-lg text-emerald-200 font-bold border border-emerald-400/30 shadow-inner">
                  {formatTime(displaySeconds!)}
                </span>
              </div>

              <Sparkles className="w-3.5 h-3.5 text-amber-200 animate-spin-slow" />
            </Link>
          </Button>
        </motion.div>
      ) : (
        <motion.div
          key="start-button"
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.85, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        >
          <Button
            asChild
            size="sm"
            className="gradient-cta text-white font-bold shadow-md rounded-xl hover:scale-[1.03] transition-transform gap-2"
          >
            <Link to="/student/focus" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>بدء غرفة التركيز</span>
            </Link>
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
