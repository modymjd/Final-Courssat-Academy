import { useEffect, useState, RefObject } from 'react';
import { toast } from '@/components/ui/use-toast';

interface UseVideoSecurityProps {
  videoRef: RefObject<HTMLVideoElement>;
  enabled?: boolean;
}

export function useVideoSecurity({ videoRef, enabled = true }: UseVideoSecurityProps) {
  const [isBlurred, setIsBlurred] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    if (!enabled) return;

    // 1. Blur on focus loss (Anti Snipping Tool / OS Recorders)
    const handleBlur = () => {
      setIsBlurred(true);
      if (videoRef.current && !videoRef.current.paused) {
        videoRef.current.pause();
        toast({
          variant: "destructive",
          title: "تم إيقاف التشغيل",
          description: "تم تعتيم الشاشة وإيقاف الفيديو للحماية ضد التسجيل.",
        });
      }
      
      // Attempt to clear clipboard
      try {
        navigator.clipboard.writeText('');
      } catch (e) {
        // ignore
      }
    };

    const handleFocus = () => {
      setIsBlurred(false);
    };

    // 2. Prevent right-click / Context menu
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    // 3. Prevent DevTools shortcuts and Copy/Paste
    const handleKeyDown = (e: KeyboardEvent) => {
      // PrintScreen
      if (e.key === 'PrintScreen') {
        e.preventDefault();
        setWarnings(prev => [...prev, 'PrintScreen']);
        toast({ variant: "destructive", title: "مخالفة أمنية", description: "محاولة التقاط الشاشة ممنوعة." });
      }

      // DevTools (F12, Ctrl+Shift+I)
      if (e.key === 'F12' || ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'i')) {
        e.preventDefault();
        setWarnings(prev => [...prev, 'DevTools']);
      }

      // Copy/Paste shortcuts
      if ((e.ctrlKey || e.metaKey) && ['c', 'v', 'x', 's'].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
    };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, videoRef]);

  return { isBlurred, warnings };
}
