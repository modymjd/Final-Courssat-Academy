import { useState, useEffect, useRef, useCallback } from "react";
import { updateLessonProgress, sendLessonProgressBeacon } from "../api";

interface UseLessonProgressOptions {
  lessonId: number;
  initialPosition: number;
  serverWatchedPercent?: number;
  isPlayingRef: React.MutableRefObject<boolean>;
  currentTimeRef: React.MutableRefObject<number>;
}

export function useLessonProgress({
  lessonId,
  initialPosition,
  serverWatchedPercent = 0,
  isPlayingRef,
  currentTimeRef,
}: UseLessonProgressOptions) {
  const [watchedPercent, setWatchedPercent] = useState<number>(serverWatchedPercent);
  const [showResumeBanner, setShowResumeBanner] = useState<boolean>(false);

  const lessonIdRef = useRef<number>(lessonId);
  lessonIdRef.current = lessonId;

  const lastSyncedPosRef = useRef<number>(initialPosition);
  const lastSentPositionRef = useRef<number>(-1);
  const lastSentTimestampRef = useRef<number>(0);

  // Initialize progress and resume banner when lesson changes
  useEffect(() => {
    if (lessonId > 0) {
      setWatchedPercent(serverWatchedPercent);
      currentTimeRef.current = initialPosition;
      lastSyncedPosRef.current = initialPosition;
      if (initialPosition > 5) {
        setShowResumeBanner(true);
      }
    }
  }, [lessonId, initialPosition, serverWatchedPercent, currentTimeRef]);

  // Auto-dismiss resume notification after 7 seconds
  useEffect(() => {
    if (showResumeBanner) {
      const timer = setTimeout(() => setShowResumeBanner(false), 7000);
      return () => clearTimeout(timer);
    }
  }, [showResumeBanner]);

  // Sync progress function with throttling and duplicate prevention
  const syncProgress = useCallback(
    async (final: boolean = false) => {
      const currentPos = Math.floor(currentTimeRef.current);
      const currentLessonId = lessonIdRef.current;
      if (!currentLessonId || currentPos < 0) return;

      const now = Date.now();
      // Guard against duplicate requests within 2 seconds for identical position
      if (
        Math.abs(currentPos - lastSentPositionRef.current) < 2 &&
        now - lastSentTimestampRef.current < 2000
      ) {
        return;
      }

      // Avoid spamming if position didn't change by >= 5s (unless final)
      if (!final && Math.abs(currentPos - lastSyncedPosRef.current) < 5) {
        return;
      }

      lastSentPositionRef.current = currentPos;
      lastSentTimestampRef.current = now;

      try {
        const res = await updateLessonProgress(currentLessonId, {
          position_seconds: currentPos,
          final,
        });
        lastSyncedPosRef.current = currentPos;
        if (res && typeof res.watched_percent === "number") {
          setWatchedPercent((prev) => Math.max(prev, Math.round(res.watched_percent)));
        }
      } catch {
        // Non-blocking fallback
      }
    },
    [currentTimeRef]
  );

  // Periodic heartbeat: ping progress every 15 seconds while playing
  useEffect(() => {
    const interval = setInterval(() => {
      if (isPlayingRef.current) {
        syncProgress(false);
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [isPlayingRef, syncProgress]);

  // Visibilitychange & Pagehide listeners for final beacon
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        syncProgress(true);
      }
    };

    const handlePageHide = () => {
      const currentPos = Math.floor(currentTimeRef.current);
      const currentLessonId = lessonIdRef.current;
      const now = Date.now();
      if (
        currentLessonId > 0 &&
        currentPos > 0 &&
        !(
          Math.abs(currentPos - lastSentPositionRef.current) < 2 &&
          now - lastSentTimestampRef.current < 2000
        )
      ) {
        lastSentPositionRef.current = currentPos;
        lastSentTimestampRef.current = now;
        sendLessonProgressBeacon(currentLessonId, currentPos);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      syncProgress(true);
    };
  }, [currentTimeRef, syncProgress]);

  return {
    watchedPercent,
    setWatchedPercent,
    showResumeBanner,
    setShowResumeBanner,
    syncProgress,
  };
}
