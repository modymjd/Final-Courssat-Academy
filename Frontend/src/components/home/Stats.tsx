import { useState, useEffect, useRef, memo } from "react";
import { BookOpen, Users, GraduationCap, Globe, type LucideIcon } from "lucide-react";

const STATS = [
  { key: "courses", target: 1000, label: "دورة تدريبية", icon: BookOpen },
  { key: "students", target: 50000, label: "طالب مسجل", icon: Users },
  { key: "instructors", target: 200, label: "مدرب محترف", icon: GraduationCap },
  { key: "countries", target: 60, label: "دولة حول العالم", icon: Globe },
] as const;

// Extracted static class constants to prevent runtime string concatenation overhead
const SECTION_CLASSES = "py-14 bg-card border-y border-border/60";
const ICON_WRAPPER_CLASSES = "inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary mb-3";
const COUNT_CLASSES = "text-3xl sm:text-4xl font-bold text-foreground mb-1";
const LABEL_CLASSES = "text-sm text-muted-foreground";

interface StatItemProps {
  icon: LucideIcon;
  count: number;
  label: string;
}

const StatItem = memo(({ icon: Icon, count, label }: StatItemProps) => (
  <div className="text-center">
    <div className={ICON_WRAPPER_CLASSES}>
      <Icon size={22} />
    </div>
    <h3 className={COUNT_CLASSES}>
      {count.toLocaleString("ar-EG")}+
    </h3>
    <p className={LABEL_CLASSES}>{label}</p>
  </div>
));

StatItem.displayName = "StatItem";

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

const Stats = memo(() => {
  const [counts, setCounts] = useState<Record<string, number>>(() =>
    Object.fromEntries(STATS.map((s) => [s.key, 0]))
  );
  const [hasAnimated, setHasAnimated] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true);

          const duration = 1800;
          const start = performance.now();
          let lastFrameTime = 0;
          const frameInterval = 1000 / 30; // Throttle to 30 FPS for smooth rendering with 50% less main thread load

          function tick(now: number) {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);

            if (now - lastFrameTime >= frameInterval || progress === 1) {
              lastFrameTime = now;
              const eased = easeOutCubic(progress);
              setCounts(
                Object.fromEntries(STATS.map((s) => [s.key, Math.floor(s.target * eased)]))
              );
            }

            if (progress < 1) {
              requestAnimationFrame(tick);
            }
          }

          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasAnimated]);

  return (
    <section ref={sectionRef} className={SECTION_CLASSES}>
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {STATS.map((stat) => (
            <StatItem
              key={stat.key}
              icon={stat.icon}
              count={counts[stat.key]}
              label={stat.label}
            />
          ))}
        </div>
      </div>
    </section>
  );
});

Stats.displayName = "Stats";

export default Stats;
