import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, BookOpen, Clock, FileText, Calendar, Moon, Sun, Home, GraduationCap, X, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CommandItem {
  id: string;
  title: string;
  category: "Navigation" | "Study Tools" | "Courses" | "Actions";
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const commandItems: CommandItem[] = [
    {
      id: "nav-dashboard",
      title: t("common.dashboard", "Ù„ÙˆØ­Ø© Ø§Ù„ØªØ­ÙƒÙ…"),
      category: "Navigation",
      icon: <Home className="w-4 h-4 text-primary" />,
      shortcut: "G D",
      action: () => { navigate("/dashboard"); onClose(); }
    },
    {
      id: "nav-courses",
      title: t("common.courses", "Ø§Ù„Ø¯ÙˆØ±Ø§Øª Ø§Ù„ØªØ¯Ø±ÙŠØ¨ÙŠØ©"),
      category: "Navigation",
      icon: <GraduationCap className="w-4 h-4 text-primary" />,
      shortcut: "G C",
      action: () => { navigate("/courses"); onClose(); }
    },
    {
      id: "tool-focus",
      title: t("common.focus_room", "ØºØ±ÙØ© Ø§Ù„ØªØ±ÙƒÙŠØ² ÙˆØ§Ù„Ø¬Ø§Ù…ÙˆØ¯ÙˆØ±Ùˆ"),
      category: "Study Tools",
      icon: <Clock className="w-4 h-4 text-achievement" />,
      shortcut: "G F",
      action: () => { navigate("/student/focus"); onClose(); }
    },
    {
      id: "tool-notebook",
      title: t("common.notebook", "Ø¯ÙØªØ± Ø§Ù„Ù…Ù„Ø§Ø­Ø¸Ø§Øª Ø§Ù„Ø°ÙƒÙŠ"),
      category: "Study Tools",
      icon: <FileText className="w-4 h-4 text-teal-500" />,
      shortcut: "G N",
      action: () => { navigate("/student/notebook"); onClose(); }
    },
    {
      id: "nav-calendar",
      title: t("common.calendar", "Ø§Ù„ØªÙ‚ÙˆÙŠÙ… ÙˆØ¬Ø¯ÙˆÙ„ Ø§Ù„Ù…ÙˆØ§Ø¹ÙŠØ¯"),
      category: "Navigation",
      icon: <Calendar className="w-4 h-4 text-blue-500" />,
      shortcut: "G S",
      action: () => { navigate("/calendar"); onClose(); }
    },
    {
      id: "action-theme",
      title: "ØªØºÙŠÙŠØ± Ø§Ù„Ù…Ø¸Ù‡Ø± (Ø¯Ø§ÙƒÙ† / ÙØ§ØªØ­)",
      category: "Actions",
      icon: document.documentElement.classList.contains("dark") ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />,
      action: () => {
        const nextTheme = document.documentElement.classList.contains("dark") ? "light" : "dark"; if(nextTheme === "dark") { document.documentElement.classList.add("dark"); } else { document.documentElement.classList.remove("dark"); } localStorage.setItem("theme", nextTheme); window.dispatchEvent(new CustomEvent("edusmart:theme-change", { detail: nextTheme }));
        onClose();
      }
    }
  ];

  const filteredItems = commandItems.filter(item =>
    item.title.toLowerCase().includes(query.toLowerCase()) ||
    item.category.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % (filteredItems.length || 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredItems.length) % (filteredItems.length || 1));
      } else if (e.key === "Enter" && filteredItems[selectedIndex]) {
        e.preventDefault();
        filteredItems[selectedIndex].action();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, filteredItems, selectedIndex]);

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent size="lg" hideCloseButton className="p-0 overflow-hidden">
        <div className="flex items-center px-4 py-3 border-b border-border/50 gap-3">
          <Search className="w-5 h-5 text-muted-foreground shrink-0" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t("common.search_placeholder", "Ø§Ø¨Ø­Ø« Ø¹Ù† ØµÙØ­Ø©ØŒ Ø¯Ø±Ø³ØŒ Ø£Ø¯Ø§Ø© Ø¯Ø±Ø§Ø³ÙŠØ©ØŒ Ø£Ùˆ Ø¥Ø¬Ø±Ø§Ø¡...")}
            className="w-full bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground text-sm font-medium"
            autoFocus
          />
          <button
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-[340px] overflow-y-auto p-2 space-y-1">
          {filteredItems.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              {t("common.no_results", "Ù„Ù… ÙŠØªÙ… Ø§Ù„Ø¹Ø«ÙˆØ± Ø¹Ù„Ù‰ Ù†ØªØ§Ø¦Ø¬ Ù…Ø·Ø§Ø¨Ù‚Ø©")}
            </div>
          ) : (
            filteredItems.map((item, index) => (
              <div
                key={item.id}
                onClick={item.action}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-150 ${
                  index === selectedIndex
                    ? "bg-primary/10 text-primary font-medium shadow-xs"
                    : "hover:bg-muted/50 text-foreground"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted/60">
                    {item.icon}
                  </div>
                  <div>
                    <p className="text-sm leading-tight">{item.title}</p>
                    <span className="text-[11px] text-muted-foreground">{item.category}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {item.shortcut && (
                    <kbd className="px-2 py-0.5 text-[10px] font-semibold bg-muted rounded border border-border/60 text-muted-foreground">
                      {item.shortcut}
                    </kbd>
                  )}
                  <ChevronRight className="w-4 h-4 text-muted-foreground opacity-50 rtl:rotate-180" />
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between px-4 py-2 bg-muted/40 text-[11px] text-muted-foreground border-t border-border/40">
          <div className="flex items-center gap-3">
            <span><kbd className="px-1.5 py-0.5 bg-background rounded border">â†‘</kbd> <kbd className="px-1.5 py-0.5 bg-background rounded border">â†“</kbd> Ù„Ù„ØªÙ†Ù‚Ù„</span>
            <span><kbd className="px-1.5 py-0.5 bg-background rounded border">Enter</kbd> Ù„Ù„Ø§Ø®ØªÙŠØ§Ø±</span>
          </div>
          <span><kbd className="px-1.5 py-0.5 bg-background rounded border">Esc</kbd> Ù„Ù„Ø¥ØºÙ„Ø§Ù‚</span>
        </div>
      </DialogContent>
    </Dialog>
  );
};
