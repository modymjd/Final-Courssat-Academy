import React from "react";
import { motion } from "framer-motion";
import { Quote, Sparkles, Users } from "lucide-react";
import { TeamMemberDto } from "@/hooks/usePlatformAboutContent";

interface TeamGridProps {
  members?: TeamMemberDto[];
}

export const TeamGrid: React.FC<TeamGridProps> = ({ members = [] }) => {
  const avatarGradients = [
    "from-teal-500 to-emerald-600",
    "from-blue-500 to-indigo-600",
    "from-purple-500 to-pink-600",
    "from-amber-500 to-orange-600",
    "from-emerald-500 to-cyan-600",
  ];

  const getInitials = (name: string) => {
    if (!name) return "TM";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <section className="py-16 md:py-24 bg-card/30 border-t border-border/60">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <motion.div
          className="text-center max-w-2xl mx-auto space-y-3 mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.5 }}
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-secondary text-secondary-foreground text-sm font-semibold border border-border">
            <Sparkles className="w-4 h-4 text-primary" />
            <span>العقول وراء المنصة</span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
            فريق العمل والتطوير
          </h2>

          <p className="text-base text-muted-foreground">
            نخبة متكاملة من المهندسين، الأكاديميين، ومصممي التكنولوجيا التعليمية يعملون بروح الفريق الواحد لخدمتك.
          </p>
        </motion.div>

        {/* Empty State */}
        {(!members || members.length === 0) ? (
          <div className="p-12 text-center rounded-2xl bg-card border border-border max-w-lg mx-auto space-y-3">
            <Users className="w-12 h-12 text-muted-foreground mx-auto" />
            <h3 className="text-lg font-bold text-foreground">لا يوجد أعضاء فريق حالياً</h3>
            <p className="text-xs text-muted-foreground">يتم تحديث قائمة فريق العمل بانتظام من قِبل إدارة المنصة.</p>
          </div>
        ) : (
          /* Grid Container */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {members.map((member, idx) => {
              const photo = member.photoUrl || member.photo;
              const gradClass = avatarGradients[idx % avatarGradients.length];

              return (
                <motion.div
                  key={member.id || idx}
                  className="group relative rounded-2xl bg-card border border-border p-6 shadow-xs hover:shadow-xl hover:border-primary/50 transition-all duration-300 flex flex-col items-center text-center overflow-hidden"
                  initial={{ opacity: 0, y: 25 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.5, delay: idx * 0.1 }}
                  whileHover={{ y: -6 }}
                >
                  <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r from-primary via-emerald-500 to-amber-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                  {/* Avatar Circle */}
                  <div className="relative mb-5">
                    <motion.div
                      className={`w-24 h-24 rounded-full bg-gradient-to-tr ${gradClass} p-1 shadow-md flex items-center justify-center text-white font-black text-2xl tracking-wider overflow-hidden`}
                      whileHover={{ scale: 1.08 }}
                      transition={{ type: "spring", stiffness: 300, damping: 15 }}
                    >
                      {photo ? (
                        <img
                          src={photo}
                          alt={member.name}
                          loading="lazy"
                          className="w-full h-full object-cover rounded-full"
                        />
                      ) : (
                        <div className="w-full h-full rounded-full bg-card/20 backdrop-blur-xs flex items-center justify-center border-2 border-white/40">
                          {getInitials(member.name)}
                        </div>
                      )}
                    </motion.div>

                    <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-xs">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                  </div>

                  {/* Info */}
                  <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors duration-200">
                    {member.name}
                  </h3>

                  <p className="text-xs font-semibold text-primary/90 mt-1 uppercase tracking-wider">
                    {member.role}
                  </p>

                  {/* Quote Bubble */}
                  {member.quote && (
                    <div className="mt-4 pt-4 border-t border-border/60 w-full relative">
                      <Quote className="w-4 h-4 text-primary/40 absolute -top-2.5 right-4 bg-card px-0.5" />
                      <p className="text-xs text-muted-foreground leading-relaxed italic">
                        "{member.quote}"
                      </p>
                    </div>
                  )}

                </motion.div>
              );
            })}
          </div>
        )}

      </div>
    </section>
  );
};

export default TeamGrid;
