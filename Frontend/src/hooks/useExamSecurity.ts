import { useEffect, useState, useCallback, useRef } from 'react';
import { logger } from '@/lib/logger';

interface UseExamSecurityProps {
  onWarning: (msg: string) => void;
  onForceSubmit: (reason: string) => void;
  maxWarnings?: number;
  enabled?: boolean;
}

export function useExamSecurity({
  onWarning,
  onForceSubmit,
  maxWarnings = 3,
  enabled = true,
}: UseExamSecurityProps) {
  const [warnings, setWarnings] = useState(0);
  const [isBlurred, setIsBlurred] = useState(false);
  const warningsRef = useRef(0);
  warningsRef.current = warnings;

  const addWarning = useCallback((msg: string) => {
    if (!enabled) return;
    const next = warningsRef.current + 1;
    setWarnings(next);
    onWarning(msg);

    if (next >= maxWarnings) {
      onForceSubmit('تم تجاوز الحد الأقصى للمخالفات الأمنية المسموح بها.');
    }
  }, [enabled, maxWarnings, onWarning, onForceSubmit]);

  useEffect(() => {
    if (!enabled) {
      setWarnings(0);
      setIsBlurred(false);
      return;
    }

    // 1. Visibility Change (Tab Switch / Window Minimize)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        addWarning('تم رصد مغادرة نافذة الاختبار أو تغيير التبويب.');
      }
    };

    // 2. Window Blur (Switching Apps / Alt+Tab)
    const handleBlur = () => {
      setIsBlurred(true);
      addWarning('تم رصد فقدان التركيز عن شاشة الاختبار.');
      try {
        if (navigator.clipboard) {
          navigator.clipboard.writeText('');
        }
      } catch {
        /* ignore */
      }
    };

    const handleFocus = () => {
      setIsBlurred(false);
    };

    // 3. Fullscreen Exit
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        addWarning('تم الخروج من وضع ملء الشاشة الإلزامي.');
      }
    };

    // 4. Keyboard Shortcuts Interception (Anti-Cheating / Screenshot)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'PrintScreen' ||
        (e.ctrlKey && ['c', 'v', 'x', 'p', 's', 'u'].includes(e.key.toLowerCase())) ||
        (e.metaKey && ['c', 'v', 'x', 'p', 's', 'u'].includes(e.key.toLowerCase())) ||
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && ['i', 'j', 'c'].includes(e.key.toLowerCase()))
      ) {
        e.preventDefault();
        addWarning(`تم منع اختصار لوحة المفاتيح (${e.key}) لأسباب أمنية.`);
      }
    };

    // 5. Clipboard Events
    const handleClipboard = (e: ClipboardEvent) => {
      e.preventDefault();
      addWarning('عمليات النسخ واللصق معطلة أثناء جلسة الاختبار.');
    };

    // 6. Context Menu (Right Click)
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      addWarning('النقر الأيمن معطل أثناء الاختبار.');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('copy', handleClipboard);
    document.addEventListener('cut', handleClipboard);
    document.addEventListener('paste', handleClipboard);
    document.addEventListener('contextmenu', handleContextMenu);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('copy', handleClipboard);
      document.removeEventListener('cut', handleClipboard);
      document.removeEventListener('paste', handleClipboard);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [addWarning, enabled]);

  return {
    warnings,
    isBlurred,
    enterFullscreen: async () => {
      try {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
      } catch (err) {
        logger.warn("Error attempting to enable fullscreen:", err);
      }
    },
    exitFullscreen: async () => {
      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        }
      } catch (err) {
        logger.warn("Error attempting to exit fullscreen:", err);
      }
    }
  };
}
