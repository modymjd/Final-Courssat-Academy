import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChevronLeft, ChevronRight, Quote } from "lucide-react";

const testimonials = [
  {
    id: 1,
    name: "أحمد محمد",
    role: "مطور ويب",
    text: "لقد غيرت منصة كورسات مساري المهني بالكامل. تعلمت مهارات جديدة في تطوير الويب وحصلت على وظيفة أفضل. المحتوى التعليمي ممتاز والمدربون محترفون جداً.",
  },
  {
    id: 2,
    name: "سارة عبدالله",
    role: "مصممة جرافيك",
    text: "أفضل استثمار قمت به في تعليمي. الدورات عالية الجودة والدعم المستمر من المدربين جعل رحلة التعلم ممتعة وفعالة. أنصح بشدة بمنصة كورسات لكل من يريد تطوير مهاراته.",
  },
  {
    id: 3,
    name: "خالد محمود",
    role: "مدير تسويق",
    text: "دورات التسويق الرقمي على منصة كورسات ساعدتني في فهم استراتيجيات التسويق الحديثة وتطبيقها في عملي. المحتوى عملي وقابل للتطبيق مباشرة.",
  },
  {
    id: 4,
    name: "نورا أحمد",
    role: "طالبة جامعية",
    text: "كطالبة، وجدت في منصة كورسات مكملاً رائعاً لدراستي الجامعية. الدورات التفاعلية والمشاريع العملية ساعدتني في تعميق فهمي للمواد وتطبيق ما تعلمته.",
  },
  {
    id: 5,
    name: "محمد سامي",
    role: "مهندس برمجيات",
    text: "المحتوى التعليمي في منصة كورسات يواكب أحدث التقنيات والاتجاهات في مجال البرمجة. استفدت كثيراً من الدورات المتقدمة والجلسات المباشرة مع المدربين.",
  },
];

const Testimonials = () => {
  const [activeIndex, setActiveIndex] = useState(0);

  const next = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % testimonials.length);
  }, []);

  const prev = useCallback(() => {
    setActiveIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  }, []);

  const visible = [
    testimonials[activeIndex],
    testimonials[(activeIndex + 1) % testimonials.length],
    testimonials[(activeIndex + 2) % testimonials.length],
  ];

  return (
    <section className="py-16 bg-muted/30 overflow-hidden">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl font-bold text-center mb-12">ماذا يقول طلابنا</h2>

        <div className="relative">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {visible.map((testimonial) => (
              <Card
                key={testimonial.id}
                className="transition-all duration-300 animate-in-fade"
              >
                <CardContent className="p-6">
                  <Quote size={24} className="text-primary/20 mb-3" />
                  <p className="text-muted-foreground mb-6 leading-relaxed">
                    {testimonial.text}
                  </p>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
                        {testimonial.name.substring(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h4 className="font-semibold text-sm">{testimonial.name}</h4>
                      <p className="text-xs text-muted-foreground">{testimonial.role}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Navigation — RTL-safe using logical positioning */}
          <button
            onClick={next}
            className="absolute top-1/2 -translate-y-1/2 start-0 w-10 h-10 rounded-full bg-card shadow-md border border-border flex items-center justify-center hover:bg-muted transition-colors hidden lg:flex"
            aria-label="الشهادة التالية"
          >
            <ChevronRight size={18} />
          </button>

          <button
            onClick={prev}
            className="absolute top-1/2 -translate-y-1/2 end-0 w-10 h-10 rounded-full bg-card shadow-md border border-border flex items-center justify-center hover:bg-muted transition-colors hidden lg:flex"
            aria-label="الشهادة السابقة"
          >
            <ChevronLeft size={18} />
          </button>

          {/* Dots indicator */}
          <div className="flex justify-center gap-2 mt-8">
            {testimonials.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveIndex(i)}
                className={`w-2 h-2 rounded-full transition-all duration-200 ${
                  i === activeIndex ? "bg-primary w-6" : "bg-border hover:bg-muted-foreground/40"
                }`}
                aria-label={`عرض الشهادة ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
