import React from "react";
import { motion } from "framer-motion";
import { 
  Mail, 
  Phone, 
  MessageSquare, 
  Sparkles, 
  ArrowLeft,
  Facebook,
  Instagram,
  Linkedin,
  Youtube,
  Twitter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface ContactSocialProps {
  email?: string;
  phone?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  linkedinUrl?: string;
  youtubeUrl?: string;
  twitterUrl?: string;
}

export const ContactSocial: React.FC<ContactSocialProps> = ({
  email = "",
  phone = "",
  facebookUrl = "",
  instagramUrl = "",
  linkedinUrl = "",
  youtubeUrl = "",
  twitterUrl = "",
}) => {
  const navigate = useNavigate();

  const socialLinks = [
    {
      name: "Facebook",
      icon: Facebook,
      url: facebookUrl,
      colorClass: "hover:text-[#1877F2] hover:bg-[#1877F2]/10",
    },
    {
      name: "Instagram",
      icon: Instagram,
      url: instagramUrl,
      colorClass: "hover:text-[#E4405F] hover:bg-[#E4405F]/10",
    },
    {
      name: "LinkedIn",
      icon: Linkedin,
      url: linkedinUrl,
      colorClass: "hover:text-[#0A66C2] hover:bg-[#0A66C2]/10",
    },
    {
      name: "YouTube",
      icon: Youtube,
      url: youtubeUrl,
      colorClass: "hover:text-[#FF0000] hover:bg-[#FF0000]/10",
    },
    {
      name: "X (Twitter)",
      icon: Twitter,
      url: twitterUrl,
      colorClass: "hover:text-[#1DA1F2] hover:bg-[#1DA1F2]/10",
    },
  ].filter((item) => Boolean(item.url && item.url.trim()));

  const hasAnyContact = Boolean(email || phone || socialLinks.length > 0);
  if (!hasAnyContact) return null;

  return (
    <section id="contact-section" className="py-16 md:py-24 bg-card/60 border-t border-border">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        
        <motion.div
          className="max-w-4xl mx-auto rounded-3xl bg-card border border-border p-8 sm:p-12 shadow-xl relative overflow-hidden"
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6 }}
        >
          <div className="absolute top-0 left-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            
            {/* Direct Contact Info */}
            <div className="md:col-span-7 space-y-6 text-right">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold border border-primary/20">
                <Sparkles className="w-3.5 h-3.5" />
                <span>نحن هنا لمساعدتك</span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                تواصل معنا أو انضم لرحلتنا
              </h2>

              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                يسعدنا تلقي استفساراتك واقتراحاتك، أو تقديم الدعم لك ولطلابك لبدء تجربة تعلّم رقمية متطورة.
              </p>

              {/* Contact Chips */}
              <div className="flex flex-col sm:flex-row flex-wrap gap-4 pt-2">
                <a
                  href={`mailto:${email}`}
                  className="inline-flex items-center gap-3 p-3.5 rounded-xl bg-muted/60 hover:bg-muted border border-border transition-colors duration-200"
                >
                  <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground font-semibold">بريد الدعم</p>
                    <p className="text-xs font-bold text-foreground dir-ltr">{email}</p>
                  </div>
                </a>

                <a
                  href={`https://wa.me/${phone.replace(/[^0-9]/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-3 p-3.5 rounded-xl bg-muted/60 hover:bg-muted border border-border transition-colors duration-200"
                >
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <Phone className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground font-semibold">الهاتف / واتساب</p>
                    <p className="text-xs font-bold text-foreground dir-ltr">{phone}</p>
                  </div>
                </a>
              </div>

              {/* Social Icons Bar */}
              <div className="pt-4 border-t border-border/50">
                <p className="text-xs font-bold text-muted-foreground mb-3">
                  تابعنا على شبكات التواصل:
                </p>
                <div className="flex items-center gap-3">
                  {socialLinks.map((social, idx) => {
                    const IconComp = social.icon;
                    if (!social.url) return null;
                    return (
                      <a
                        key={idx}
                        href={social.url}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={social.name}
                        className={`w-10 h-10 rounded-xl bg-muted/80 border border-border/80 flex items-center justify-center text-muted-foreground transition-all duration-200 hover:scale-110 ${social.colorClass}`}
                      >
                        <IconComp className="w-5 h-5" />
                      </a>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Action CTA Box */}
            <div className="md:col-span-5 flex flex-col items-center justify-center text-center p-6 rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-background border border-primary/20 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-md">
                <MessageSquare className="w-6 h-6" />
              </div>

              <h3 className="text-lg font-bold text-foreground">
                جاهز لبدء تجربتك المميزة؟
              </h3>

              <p className="text-xs text-muted-foreground">
                احجز استشارة مجانية مع فريق العمل أو استكشف الكورسات المتاحة الآن.
              </p>

              <Button
                size="lg"
                className="w-full gradient-cta text-white font-bold shadow-md hover:shadow-lg transition-all duration-200 gap-2 cursor-pointer"
                onClick={() => navigate("/courses")}
              >
                <span>ابدأ رحلتك الآن</span>
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </div>

          </div>

        </motion.div>

      </div>
    </section>
  );
};

export default ContactSocial;
