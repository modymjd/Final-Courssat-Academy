import { BookOpen, Clock, GraduationCap, MessageSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const features = [
  {
    icon: <BookOpen size={28} />,
    title: "دورات تفاعلية",
    description: "محتوى تعليمي غني يشمل فيديوهات وملفات واختبارات تفاعلية.",
  },
  {
    icon: <Clock size={28} />,
    title: "تعلم في أي وقت",
    description: "وصول غير محدود للمحتوى التعليمي على مدار الساعة بالسرعة التي تناسبك.",
  },
  {
    icon: <GraduationCap size={28} />,
    title: "مدربون محترفون",
    description: "تعلم على يد نخبة من المتخصصين ذوي الخبرة في مجالاتهم.",
  },
  {
    icon: <MessageSquare size={28} />,
    title: "دعم متواصل",
    description: "تواصل مع المدربين والطلاب من خلال نظام الرسائل والمناقشات.",
  },
];

const Features = () => {
  return (
    <section className="py-16 bg-muted/30">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl font-bold text-center mb-4">ما يميزنا</h2>
        <p className="text-muted-foreground text-center mb-12 max-w-xl mx-auto">
          نوفر لك بيئة تعليمية متكاملة تمكّنك من تحقيق أهدافك المهنية
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <Card key={index} className="border-border/60 transition-all duration-250 hover:shadow-md hover:-translate-y-0.5">
              <CardContent className="p-6 flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-bold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
