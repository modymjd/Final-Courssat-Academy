# وثيقة تسليم واستكمال العمل (EduSmart Project Continuation & Handover Document)

**تاريخ الحفظ والتوثيق:** 2026-08-06  
**حالة المشروع الحالية:** تم إنجاز صفحة دليل المدربين الشاملة بالكامل (Backend + Frontend) مع نجاح 100% في جميع اختبارات الوحدة واختبارات الـ N+1 والتخزين المؤقت.

---

## 📌 أولاً: ما تم إنجازه واختباره وتأكيده (Completed Tasks)

1. **دليل المدربين العام (Public Instructors Directory & Cards)**:
   - **Backend ORM**: تم دمج الـ Subqueries بأمان بنمط `.order_by().values().annotate().values()` وحل مشكلة الـ Cartesian Product و N+1 queries نهائياً.
   - **الـ Cache Key Versioning**: ربط الـ Signals لتأمين كاش دليل المدربين وتحديثه فورياً عند توثيق مدرب دون مسح كاش النظام.
   - **Frontend UI/UX**: بطاقة المدرب التفاعلية `InstructorCard.tsx` بـ Framer Motion، وشارات `Verified` و `Featured` و `is_new` المحسوبة ديناميكياً، مع دعم WebP و lazy loading والوصولية.
   - **الشبكة والفلاتر (`Instructors.tsx`)**: شريط البحث، تصفية التخصصات، الترتيب حسب الطلاب والتقييمات والدورات، مع حالات التحميل الهيكلي (Skeletons) والخطأ والقائمة الفارغة.
   - **اختبارات الوحدة**: نجاح 3 اختبارات backend بـ `CaptureQueriesContext` ونجاح جميع اختبارات frontend.

2. **إصلاح اتصال الشبكة المحلية والموبايل (Mobile & LAN Network Fix)**:
   - تم ضبط خادم الباك إند Django ليسمح بالاتصال من كافة واجهات الشبكة `0.0.0.0:8000` مع التزام تام بالبورت **8000**.
   - تم تحديث عملاء HTTP في الفرونت إند لاستخراج عنوان الخادم ديناميكياً (`window.location.hostname:8000/api/v1`) مما يتيح التصفح من أي موبايل أو جهاز على الشبكة المحلية دون تعديل إعدادات.

---

## 🚀 ثانياً: خطة المهام القادمة فور الاستيقاظ (Next Work Items Breakdown)

عند استكمال العمل فوراً، تم تحديد 5 محاور رئيسية تم إعداد تشخيص مبدئي لها:

### 1. إكمال صفحات الفوتر الناقصة (Footer Links Audit & Missing Pages)
- **التشخيص**: رابط سياسة الخصوصية `/privacy` وشروط الاستخدام `/terms` والأسئلة الشائعة `/faq` ومكان مركز المساعدة غير متصلة بروابط حقيقية بل بصيغة `<a href="/privacy">`.
- **الخطة**:
  - إنشاء صفحة `Privacy.tsx` (سياسة الخصوصية).
  - إنشاء صفحة `Terms.tsx` (شروط الاستخدام والإسترجاع).
  - إنشاء صفحة `Faq.tsx` (الأسئلة الشائعة مع Accordions).
  - إنشاء صفحة `HelpCenter.tsx` (مركز المساعدة والدعم الفني).
  - تحديث الـ Routes في `App.tsx` وتحديث المكون `Footer.tsx`.

---

### 2. مراجعة وتعديل أخطاء UX/UI في صفحة الأسعار (`Pricing.tsx`)
- **التشخيص**:
  - صفحة الأسعار الحالية تحتوي على بطاقات تحتاج تحسينات في التباين البصري (Visual Contrast) في Dark Mode.
  - طريقة عرض الخصم السنوي (Yearly Billing Toggle) تحتاج ضبط في التوزيع واستجابة الأجهزة الذكية.
  - تحسين شكل الكوبونات وحقول إدخال الأكواد ورسائل التأكيد.

---

### 3. إعادة هيكلة باقات الاشتراكات وصلاحيات الحسابات (Plans & Entitlements Architecture)
- **التشخيص**:
  - يوجد تداخل بين نوع الحساب (Student, Instructor, Admin) وخطة الاشتراك (`subscription_plan`: FREE, PRO, INSTITUTIONAL).
  - الـ Backend يحتوي على موديل جديد متطور للميزات `Feature`, `RoleFeaturePermission`, `PlanFeaturePermission`, `OrganizationFeatureOverride`.
- **الخطة**:
  - مراجعة مصفوفة الصلاحيات الديناميكية في `entitlements.py`.
  - توحيد واجهات مبيعات الباقات وإدارة الاشتراكات للطلاب والمدربين.

---

### 4. تشخيص وإصلاح أخطاء تسجيل مدرب جديد (New Instructor Registration Fixes)
- **السبب العلمي المكتشف في الكود**:
  في ملف `Backend/apps/accounts/serializers.py` في الكلاس `RegisterSerializer`:
  ```python
  def create(self, validated_data):
      return User.objects.create_user(role=UserRole.STUDENT, **validated_data)
  ```
  الـ Serializer الحالي يقوم بعمل **Hardcoding** لـ `role=UserRole.STUDENT` ويمنع استقبال حقل `role` أثناء التسجيل!
- **الخطة**:
  - تحديث `RegisterSerializer` لاستقبال حقل `role` (سواء `student` أو `instructor`).
  - التأكد من إنشاء `InstructorProfile` وتعيين الصلاحيات الأولية بسلاسة دون أخطاء 400 Bad Request.

---

### 5. إصلاح شاشة السوبر أدمن (`/super-admin/*`)
- **التشخيص**:
  - فحص مسارات التوثيق وحماية السوبر أدمن `SuperAdminGuard.tsx`.
  - التأكد من مطابقة استدعاءات API السوبر أدمن مع `super_admin_views.py` و `super_admin_urls.py`.
  - إصلاح أي أخطاء في تحميل قائمة المستخدمين وتعديل الأدوار والتحكم بالميزات.

---


## 📲 إعدادات اختبار تسجيل دخول جوجل من الموبايل (Google OAuth Mobile Setup)

تسجيل الدخول عبر جوجل (**Google OAuth**) يفرض قيوداً أمنية تمنع قبول IP المحليات المباشرة على الموبايل كـ Authorized Origin إلا عبر النفق أو ضبط النطاق:

### الطرق المعتمدة للاختبار من الموبايل:
1. **استخدام نفق HTTPS مجاني (Localtunnel / Ngrok) - (مستحسن جداً 🚀)**:
   ```bash
   npx localtunnel --port 8080
   ```
   - نسخ الرابط المولد (مثال: `https://edusmart-app.loca.lt`).
   - إضافته في Google Cloud Console 👈 قسم **Credentials** 👈 في:
     - **Authorized JavaScript origins**: `https://edusmart-app.loca.lt`
     - **Authorized redirect URIs**: `https://edusmart-app.loca.lt`
2. **إضافة IP الشبكة المحلية (إن سمحت اللوحة)**:
   - إضافة `http://192.168.1.8:8080` في Authorized Origins.

---

## 🛠️ كيفية استكمال العمل فور الاستيقاظ (Resuming Workflow)

عند بدء الجلسة الجديدة، يمكنك مباشرة إرسال الأمر:
> *"يلا نرجع نصلح مشكلة تسجيل المدرب الجديد ثم نعمل صفحات الفوتر"*

وسيتم التنفيذ فوراً بناءً على هذا الملف دون الحاجة لإعادة شرح أي شيء! 😴✨

