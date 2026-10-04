# 🔑 EduSmart Platform - User Accounts & Authentication Guide
# دليل حسابات المستخدمين وطريقة الدخول في منصة EduSmart

> **تنبيه أمني:** هذه الحسابات محلية وتجريبية فقط. لا تشغّل أوامر
> `seed_demo` أو `create_role_users` على الإنتاج، ولا تستخدم كلمات المرور
> التالية لأي حساب حقيقي.

هذا الملف يحتوي على جميع حسابات المستخدمين الجاهزة في النظام لكافة الأدوار (`Roles`)، وطريقة تسجيل الدخول من خلال واجهة المستخدم (Frontend) وعبر الواجهة البرمجية (Backend API).

---

## 👥 1. بيانات الحسابات المتاحة لكل نوع مستخدم (User Accounts)

كلمة المرور الموحدة لجميع الحسابات التجريبية هي: **`Passw0rd123!`**

| نوع المستخدم (Role) | البريد الإلكتروني (Email) | كلمة المرور (Password) | الاسم الكامل | الصلاحيات والملف الشخصي |
| :--- | :--- | :--- | :--- | :--- |
| **طالب (Student)** | `student@edusmart.dev` | `Passw0rd123!` | طالب تجريبي | تصفح الدورات، الانضمام للمواد، متابعة التقدم (`StudentProfile`) |
| **مدرب (Instructor)** | `instructor@edusmart.dev` | `Passw0rd123!` | أحمد المدرب | إنشاء وتعديل الدورات، رفع الدروس والمسابقات (`InstructorProfile` - موثق ومميز) |
| **مدير نظام (Admin)** | `admin@edusmart.dev` | `Passw0rd123!` | سارة المشرف | إدارة المستخدمين، مراجعة المحتوى، الإحصائيات (`is_staff=True`, `AdminProfile`) |
| **مدير رئيسي (Super Admin)** | `superadmin@edusmart.dev` | `Passw0rd123!` | المدير الرئيسي | صلاحيات كاملة وفائقة للنظام وقاعدة البيانات (`is_superuser=True`, `is_staff=True`) |

---

## 💻 2. طريقة الدخول من الواجهة الأمامية (Frontend Web App)

1. **تشغيل واجهة المستخدم**:
   ```bash
   cd Frontend
   npm run dev
   ```
2. افتح المتصفح على الرابط: `http://localhost:5173/login` (أو `http://localhost:8080/login`).
3. أدخل البريد الإلكتروني للمستخدم المطلوب (مثال: `student@edusmart.dev` أو `instructor@edusmart.dev`).
4. أدخل كلمة المرور: **`Passw0rd123!`**
5. اضغط على **تسجيل الدخول**. سيتم توجيهك تلقائياً إلى لوحة التحكم الخاصة بدور المستخدم.

---

## 🚀 3. طريقة الدخول عبر API (Backend REST API / JWT)

### مسار تسجيل الدخول (API Endpoint):
`POST http://localhost:8000/api/v1/auth/login/`

### صيغة الطلب (Request Payload JSON):
```json
{
  "email": "student@edusmart.dev",
  "password": "Passw0rd123!"
}
```

### أمثلة الاستدعاء:

#### 1. باستخدام cURL (Terminal / Command Prompt):
```bash
curl -X POST http://127.0.0.1:8000/api/v1/auth/login/ \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"instructor@edusmart.dev\", \"password\": \"Passw0rd123!\"}"
```

#### 2. باستخدام Python (Requests):
```python
import requests

url = "http://127.0.0.1:8000/api/v1/auth/login/"
payload = {
    "email": "superadmin@edusmart.dev",
    "password": "Passw0rd123!"
}
response = requests.post(url, json=payload)
data = response.json()

print("Status Code:", response.status_code)
print("Access Token:", data.get("access"))
print("Refresh Token:", data.get("refresh"))
```

---

## 🛠️ 4. إعادة إنشاء وإعادة تعيين الحسابات (Database Re-seeding)

في حال قمت بإعادة تعيين قاعدة البيانات أو أردت تحديث الحسابات وكلمات المرور، يمكنك تشغيل أي من الأوامر التالية داخل مجلد `Backend`:

### أمر إنشاء حسابات جميع الأدوار فقط:
```bash
cd Backend
.venv\Scripts\python.exe manage.py create_role_users
```

### أمر ملء المنصة بالكامل (الحسابات + الدورات + الأقسام + التسجيلات):
```bash
cd Backend
.venv\Scripts\python.exe manage.py seed_demo
```
