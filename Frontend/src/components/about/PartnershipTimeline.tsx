import React from "react";
import { motion } from "framer-motion";
import { Calendar, Handshake, Sparkles, CheckCircle, Award } from "lucide-react";
import { PartnershipDto } from "@/hooks/usePlatformAboutContent";

interface PartnershipTimelineProps {
  items?: PartnershipDto[];
}

export const PartnershipTimeline: React.FC<PartnershipTimelineProps> = ({
  items = [],
}) => {
  return (
    <section id="partnership-timeline" className="py-16 md:py-24 bg-background relative overflow-hidden">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <motion.div
          className="text-center max-w-2xl mx-auto space-y-4 mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.5 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold border border-primary/20">
            <Handshake className="w-4 h-4" />
            <span>مسيرة النمو والتطوير</span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
            تايم لاين الشراكات والإنجازات
          </h2>

          <p className="text-base sm:text-lg text-muted-foreground">
            محطات رئيسية شكلت مسيرتنا في بناء منصة تعليمية رائدة بالشراكة مع قادة التعليم والتكنولوجيا.
          </p>
        </motion.div>

        {/* Empty State */}
        {(!items || items.length === 0) ? (
          <div className="p-12 text-center rounded-2xl bg-card border border-border max-w-lg mx-auto space-y-3">
            <Award className="w-12 h-12 text-muted-foreground mx-auto" />
            <h3 className="text-lg font-bold text-foreground">لا توجد محطات مسجلة حالياً</h3>
            <p className="text-xs text-muted-foreground">سيتم إدراج الشراكات والإنجازات القادمة هنا فور اعتمادها.</p>
          </div>
        ) : (
          /* Timeline Container */
          <div className="relative max-w-4xl mx-auto">
            <div className="absolute top-0 bottom-0 right-4 md:right-1/2 w-0.5 bg-gradient-to-b from-primary via-emerald-500 to-amber-500 transform md:translate-x-1/2" />

            <div className="space-y-12">
              {items.map((item, idx) => {
                const isEven = idx % 2 === 0;
                const partnerName = item.partnerName || item.partner_name || "الشريك الإستراتيجي";
                const photo = item.photoUrl || item.photo;

                return (
                  <motion.div
                    key={item.id || idx}
                    className={`relative flex flex-col md:flex-row items-start md:items-center ${
                      isEven ? "md:flex-row-reverse" : ""
                    }`}
                    initial={{ opacity: 0, y: 30, x: isEven ? -20 : 20 }}
                    whileInView={{ opacity: 1, y: 0, x: 0 }}
                    viewport={{ once: true, margin: "-60px" }}
                    transition={{ duration: 0.6, delay: idx * 0.1 }}
                  >
                    
                    {/* Timeline Center Node Icon */}
                    <div className="absolute right-4 md:right-1/2 transform md:translate-x-1/2 z-10 -translate-y-1 md:translate-y-0">
                      <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg ring-4 ring-background">
                        <Sparkles className="w-4 h-4" />
                      </div>
                    </div>

                    {/* Content Card Side */}
                    <div className="w-full md:w-1/2 pr-12 md:pr-0 md:px-8">
                      <div className="p-6 rounded-2xl bg-card border border-border shadow-md hover:shadow-lg hover:border-primary/40 transition-all duration-300 relative group overflow-hidden">
                        
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-primary bg-primary/10 px-3 py-1 rounded-full">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>{item.date}</span>
                          </div>
                          {item.badgeText && (
                            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-md">
                              {item.badgeText}
                            </span>
                          )}
                        </div>

                        {photo && (
                          <div className="mb-3 h-32 w-full rounded-xl overflow-hidden bg-muted">
                            <img
                              src={photo}
                              alt={partnerName}
                              loading="lazy"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}

                        <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors duration-200">
                          بالشراكة مع {partnerName}
                        </h3>

                        <p className="text-sm text-foreground/80 leading-relaxed mt-2">
                          {item.description}
                        </p>

                        <div className="mt-4 pt-2 border-t border-border/40 flex items-center gap-1 text-xs text-muted-foreground">
                          <CheckCircle className="w-3.5 h-3.5 text-primary" />
                          <span>محطة إنجاز موثقة</span>
                        </div>

                      </div>
                    </div>

                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </section>
  );
};

export default PartnershipTimeline;
