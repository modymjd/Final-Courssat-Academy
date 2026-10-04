import React, { useState, useEffect } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export const ThemeToggle: React.FC = () => {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof document !== "undefined") {
      return document.documentElement.classList.contains("dark") ? "dark" : "light";
    }
    return "light";
  });

  useEffect(() => {
    const updateState = () => {
      const isDark = document.documentElement.classList.contains("dark");
      setTheme(isDark ? "dark" : "light");
    };

    window.addEventListener("edusmart:theme-change", updateState);
    window.addEventListener("storage", updateState);
    return () => {
      window.removeEventListener("edusmart:theme-change", updateState);
      window.removeEventListener("storage", updateState);
    };
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("theme", nextTheme);
    setTheme(nextTheme);
    window.dispatchEvent(new CustomEvent("edusmart:theme-change", { detail: nextTheme }));
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label={theme === "light" ? "التبديل إلى الوضع الليلي" : "التبديل إلى الوضع النهاري"}
      title={theme === "light" ? "التبديل إلى الوضع الليلي" : "التبديل إلى الوضع النهاري"}
      className="rounded-xl hover:bg-muted/80 text-foreground transition-all duration-200"
    >
      {theme === "light" ? (
        <Moon size={19} className="text-foreground transition-transform duration-300 hover:rotate-12" />
      ) : (
        <Sun size={19} className="text-amber-400 transition-transform duration-300 hover:rotate-45" />
      )}
    </Button>
  );
};

export default ThemeToggle;

