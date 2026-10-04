
import { Link } from "react-router-dom";
import { Book, Facebook, Twitter, Linkedin, Youtube, Instagram } from "lucide-react";
import { usePlatformTheme } from "@/hooks/usePlatformTheme";

const Footer = () => {
  const { data: themeData } = usePlatformTheme();

  const siteName = (themeData?.site_name || themeData?.siteName)?.replace(/ - إديوسمارت|إديوسمارت| - EduSmart|EduSmart/g, "") || "كورسات";
  const siteTagline = themeData?.site_tagline || themeData?.siteTagline || "منصة تعليمية متكاملة تقدم دورات عالية الجودة في مختلف المجالات.";

  const supportEmail = themeData?.support_email || themeData?.supportEmail;
  const supportPhone = themeData?.support_phone || themeData?.supportPhone;
  const faqUrl = themeData?.faq_url || themeData?.faqUrl || "/faq";
  const termsUrl = themeData?.terms_url || themeData?.termsUrl || "/terms";
  const privacyUrl = themeData?.privacy_url || themeData?.privacyUrl || "/privacy";
  const logoSrc = themeData?.logoUrl || themeData?.logo_url || "/logo.png";

  const facebookUrl = themeData?.facebook_url || themeData?.facebookUrl;
  const twitterUrl = themeData?.twitter_url || themeData?.twitterUrl;
  const linkedinUrl = themeData?.linkedin_url || themeData?.linkedinUrl;
  const youtubeUrl = themeData?.youtube_url || themeData?.youtubeUrl;
  const instagramUrl = themeData?.instagram_url || themeData?.instagramUrl;

  return (
    <footer className="bg-slate-100/90 dark:bg-card/50 border-t border-slate-200 dark:border-border/80 mt-auto">
      <div className="container mx-auto px-4 py-10">
        <div className="grid grid-cols-1 xxs:grid-cols-2 md:grid-cols-4 gap-6 xxs:gap-4 sm:gap-8">
          <div className="col-span-1 space-y-3">
            <Link to="/" className="flex items-center gap-2 mb-2">
              <img
                src={logoSrc}
                alt={siteName}
                className="h-9 max-w-[140px] object-contain"
              />
              <span className="text-xl font-bold text-primary">{siteName}</span>
            </Link>
            <p className="text-slate-600 dark:text-muted-foreground text-xs sm:text-sm leading-relaxed">
              {siteTagline}
            </p>
            {supportEmail && (
              <p className="text-xs text-slate-600 dark:text-muted-foreground mt-2">
                الدعم: <a href={`mailto:${supportEmail}`} className="text-primary font-semibold hover:underline">{supportEmail}</a>
              </p>
            )}
            {supportPhone && (
              <p className="text-xs text-slate-600 dark:text-muted-foreground mt-1">
                الهاتف: <span className="font-mono font-bold text-slate-800 dark:text-foreground">{supportPhone}</span>
              </p>
            )}
          </div>
          
          <div className="col-span-1">
            <h3 className="text-sm font-bold text-slate-900 dark:text-foreground mb-4">روابط سريعة</h3>
            <ul className="space-y-2.5 text-xs sm:text-sm font-medium">
              <li><Link to="/courses" className="text-slate-600 dark:text-muted-foreground hover:text-primary transition-colors">الدورات التدريبية</Link></li>
              <li><Link to="/instructors" className="text-slate-600 dark:text-muted-foreground hover:text-primary transition-colors">نخبة المدربين</Link></li>
              <li><Link to="/pricing" className="text-slate-600 dark:text-muted-foreground hover:text-primary transition-colors">خطط الباقات والأسعار</Link></li>
            </ul>
          </div>
          
          <div className="col-span-1">
            <h3 className="text-sm font-bold text-slate-900 dark:text-foreground mb-4">الدعم والتعليمات</h3>
            <ul className="space-y-2.5 text-xs sm:text-sm font-medium">
              <li><a href={faqUrl} className="text-slate-600 dark:text-muted-foreground hover:text-primary transition-colors">الأسئلة الشائعة</a></li>
              <li><Link to="/about" className="text-slate-600 dark:text-muted-foreground hover:text-primary transition-colors">مركز المساعدة والمعلومات</Link></li>
            </ul>
          </div>
          
          <div className="col-span-1">
            <h3 className="text-sm font-bold text-slate-900 dark:text-foreground mb-4">عن المنصة</h3>
            <ul className="space-y-2.5 text-xs sm:text-sm font-medium">
              <li><Link to="/about" className="text-slate-600 dark:text-muted-foreground hover:text-primary transition-colors">من نحن ({siteName})</Link></li>
              <li><a href={privacyUrl} className="text-slate-600 dark:text-muted-foreground hover:text-primary transition-colors">سياسة الخصوصية</a></li>
              <li><a href={termsUrl} className="text-slate-600 dark:text-muted-foreground hover:text-primary transition-colors">شروط الاستخدام</a></li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-slate-200/80 dark:border-border/60 mt-8 pt-6 flex flex-col md:flex-row items-center justify-between">
          <p className="text-xs sm:text-sm text-slate-500 dark:text-muted-foreground font-medium">
            &copy; {new Date().getFullYear()} {siteName}. جميع الحقوق محفوظة.
          </p>
          <div className="flex items-center gap-4 mt-4 md:mt-0 text-slate-500 dark:text-muted-foreground">
            {facebookUrl && (
              <a href={facebookUrl} target="_blank" rel="noreferrer" className="hover:text-primary transition-colors" aria-label="فيسبوك">
                <Facebook size={18} />
              </a>
            )}
            {twitterUrl && (
              <a href={twitterUrl} target="_blank" rel="noreferrer" className="hover:text-primary transition-colors" aria-label="تويتر">
                <Twitter size={18} />
              </a>
            )}
            {linkedinUrl && (
              <a href={linkedinUrl} target="_blank" rel="noreferrer" className="hover:text-primary transition-colors" aria-label="لينكد إن">
                <Linkedin size={18} />
              </a>
            )}
            {youtubeUrl && (
              <a href={youtubeUrl} target="_blank" rel="noreferrer" className="hover:text-primary transition-colors" aria-label="يوتيوب">
                <Youtube size={18} />
              </a>
            )}
            {instagramUrl && (
              <a href={instagramUrl} target="_blank" rel="noreferrer" className="hover:text-primary transition-colors" aria-label="إنستغرام">
                <Instagram size={18} />
              </a>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
};


export default Footer;
