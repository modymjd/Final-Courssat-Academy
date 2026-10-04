import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { GraduationCap, Presentation, Building2, Users } from "lucide-react";

interface RoleSelectorProps {
  selectedRole: "student" | "instructor" | "guardian" | "center";
  onSelectRole: (role: "student" | "instructor" | "guardian" | "center") => void;
}

export const RoleSelector: React.FC<RoleSelectorProps> = ({ selectedRole, onSelectRole }) => {
  return (
    <Card className="rounded-3xl border border-border/80 shadow-md overflow-hidden bg-card">
      <CardContent className="p-4 sm:p-6">
        <Label className="text-sm font-bold text-foreground block mb-3">اختر نوع الحساب:</Label>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div
            onClick={() => onSelectRole("student")}
            className={`cursor-pointer p-4 rounded-2xl border-2 transition-all flex flex-col items-center text-center gap-2.5 ${
              selectedRole === "student"
                ? "border-primary bg-primary/10 text-primary shadow-sm ring-2 ring-primary/20"
                : "border-border/60 bg-background hover:bg-muted/40 text-muted-foreground"
            }`}
          >
            <div className={`p-3 rounded-2xl shrink-0 ${selectedRole === "student" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
              <GraduationCap size={24} />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-foreground">حساب طالب</h3>
              <p className="text-xs text-muted-foreground">حضور الدورات والتمارين</p>
            </div>
          </div>

          <div
            onClick={() => onSelectRole("instructor")}
            className={`cursor-pointer p-4 rounded-2xl border-2 transition-all flex flex-col items-center text-center gap-2.5 ${
              selectedRole === "instructor"
                ? "border-primary bg-primary/10 text-primary shadow-sm ring-2 ring-primary/20"
                : "border-border/60 bg-background hover:bg-muted/40 text-muted-foreground"
            }`}
          >
            <div className={`p-3 rounded-2xl shrink-0 ${selectedRole === "instructor" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
              <Presentation size={24} />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-foreground">حساب محاضر</h3>
              <p className="text-xs text-muted-foreground">نشر الدورات وإدارة الطلاب</p>
            </div>
          </div>

          <div
            onClick={() => onSelectRole("center")}
            className={`cursor-pointer p-4 rounded-2xl border-2 transition-all flex flex-col items-center text-center gap-2.5 ${
              selectedRole === "center"
                ? "border-primary bg-primary/10 text-primary shadow-sm ring-2 ring-primary/20"
                : "border-border/60 bg-background hover:bg-muted/40 text-muted-foreground"
            }`}
          >
            <div className={`p-3 rounded-2xl shrink-0 ${selectedRole === "center" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
              <Building2 size={24} />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-foreground">سنتر تعليمي</h3>
              <p className="text-xs text-muted-foreground">إدارة المعلمين وتوليد الأكواد</p>
            </div>
          </div>

          <div
            onClick={() => onSelectRole("guardian")}
            className={`cursor-pointer p-4 rounded-2xl border-2 transition-all flex flex-col items-center text-center gap-2.5 ${
              selectedRole === "guardian"
                ? "border-primary bg-primary/10 text-primary shadow-sm ring-2 ring-primary/20"
                : "border-border/60 bg-background hover:bg-muted/40 text-muted-foreground"
            }`}
          >
            <div className={`p-3 rounded-2xl shrink-0 ${selectedRole === "guardian" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
              <Users size={24} />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-foreground">حساب ولي أمر</h3>
              <p className="text-xs text-muted-foreground">متابعة درجات وغياب الطالب</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
