import React, { useState } from 'react';
import { motion } from 'framer-motion';
import Layout from '@/components/layout/Layout';
import { useCalendarEvents } from '@/features/communications';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, Clock, Video, FileText, Download, Share2, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale/ar';

const Calendar = () => {
  const { data: events, isLoading, error } = useCalendarEvents();
  const [filterType, setFilterType] = useState<string>("all");

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'live_session':
        return <Video size={16} className="text-blue-500" />;
      case 'assignment':
        return <FileText size={16} className="text-amber-500" />;
      case 'exam':
        return <FileText size={16} className="text-destructive" />;
      default:
        return <CalendarIcon size={16} className="text-primary" />;
    }
  };

  const getEventBadge = (type: string) => {
    switch (type) {
      case 'live_session':
        return <Badge variant="secondary" className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20">بث مباشر</Badge>;
      case 'assignment':
        return <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/20">تسليم مهمة</Badge>;
      case 'exam':
        return <Badge variant="destructive">اختبار حاسم</Badge>;
      default:
        return <Badge variant="outline">حدث دراسي</Badge>;
    }
  };

  const exportICal = () => {
    if (!events || events.length === 0) return;
    let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//EduSmart//Educational Calendar//AR\n";

    events.forEach(evt => {
      const dateStr = format(new Date(evt.date), "yyyyMMdd'T'HHmmss'Z'");
      icsContent += `BEGIN:VEVENT\nSUMMARY:${evt.title}\nDESCRIPTION:${evt.description || ""}\nDTSTART:${dateStr}\nEND:VEVENT\n`;
    });

    icsContent += "END:VCALENDAR";

    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "edusmart-schedule.ics");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredEvents = events ? events.filter(e => filterType === "all" || e.type === filterType) : [];

  return (
    <Layout>
      <div className="container mx-auto py-12 px-4 max-w-4xl space-y-8">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card/60 glass p-6 rounded-2xl border border-border/60 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 rounded-2xl text-primary">
              <CalendarIcon size={26} />
            </div>
            <div>
              <h1 className="text-2xl font-bold">التقويم والأحداث الأكاديمية</h1>
              <p className="text-muted-foreground text-sm mt-0.5">تابع مواعيد المحاضرات المباشرة والاختبارات وتسليم الواجبات.</p>
            </div>
          </div>

          <Button onClick={exportICal} className="gap-2 gradient-cta text-white rounded-xl shadow-md">
            <Download size={16} />
            تصدير تقويم iCal / Google
          </Button>
        </div>

        {/* Filter Buttons */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
            <Filter size={14} /> التصفية:
          </span>
          {[
            { id: "all", label: "كافة الأحداث" },
            { id: "live_session", label: "البث المباشر" },
            { id: "exam", label: "الاختبارات" },
            { id: "assignment", label: "المهام" },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilterType(f.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
                filterType === f.id
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-muted animate-pulse rounded-2xl" />
            ))}
          </div>
        ) : error || !events ? (
          <Card className="border-dashed rounded-2xl">
            <CardContent className="py-16 text-center">
              <CalendarIcon size={48} className="mx-auto text-muted-foreground opacity-50 mb-4" />
              <p className="text-lg font-medium">تعذر تحميل التقويم</p>
              <p className="text-muted-foreground">حدث خطأ أثناء جلب الأحداث. يرجى المحاولة لاحقاً.</p>
            </CardContent>
          </Card>
        ) : filteredEvents.length === 0 ? (
          <Card className="border-dashed rounded-2xl">
            <CardContent className="py-16 text-center">
              <CalendarIcon size={48} className="mx-auto text-muted-foreground opacity-50 mb-4" />
              <p className="text-lg font-medium">لا توجد أحداث قادمة</p>
              <p className="text-muted-foreground">جدولك الزمني فارغ حالياً لهذا التصنيف.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredEvents.map((event, index) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
              >
                <Card className="overflow-hidden glass border-border/60 hover:shadow-md transition-all duration-200 relative rounded-2xl">
                  <div className={`absolute top-0 bottom-0 right-0 w-1.5 ${
                    event.type === 'live_session' ? 'bg-blue-500' : 
                    event.type === 'exam' ? 'bg-destructive' : 'bg-amber-500'
                  }`} />
                  <CardContent className="p-0 flex flex-col md:flex-row">
                    <div className="p-6 bg-muted/30 md:w-48 flex flex-col items-center justify-center border-b md:border-b-0 md:border-l border-border/50">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                        {format(new Date(event.date), "MMMM", { locale: ar })}
                      </span>
                      <span className="text-4xl font-extrabold text-primary font-mono">
                        {format(new Date(event.date), "dd")}
                      </span>
                      <span className="text-xs text-muted-foreground mt-1">
                        {format(new Date(event.date), "EEEE", { locale: ar })}
                      </span>
                    </div>
                    <div className="p-6 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start mb-2 gap-2">
                          <h3 className="text-base font-bold">{event.title}</h3>
                          {getEventBadge(event.type)}
                        </div>
                        <p className="text-xs text-muted-foreground mb-4">{event.description || "لا يوجد وصف محدد."}</p>
                      </div>
                      <div className="flex items-center gap-6 text-xs text-muted-foreground mt-auto">
                        <div className="flex items-center gap-1.5">
                          <Clock size={14} />
                          <span className="font-mono">{format(new Date(event.date), "hh:mm a", { locale: ar })}</span>
                        </div>
                        {event.link && (
                          <a href={event.link} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-primary hover:underline font-medium">
                            {getEventIcon(event.type)}
                            <span>الانضمام للجلسة المباشرة</span>
                          </a>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Calendar;
