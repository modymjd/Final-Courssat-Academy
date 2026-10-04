export const GOVERNORATE_CODES: Record<string, string> = {
  "01": "القاهرة",
  "02": "الإسكندرية",
  "03": "بورسعيد",
  "04": "السويس",
  "11": "دمياط",
  "12": "الدقهلية",
  "13": "الشرقية",
  "14": "القليوبية",
  "15": "كفر الشيخ",
  "16": "الغربية",
  "17": "المنوفية",
  "18": "البحيرة",
  "19": "الإسماعيلية",
  "21": "الجيزة",
  "22": "بني سويف",
  "23": "الفيوم",
  "24": "المنيا",
  "25": "أسيوط",
  "26": "سوهاج",
  "27": "قنا",
  "28": "أسوان",
  "29": "الأقصر",
  "31": "البحر الأحمر",
  "32": "الوادي الجديد",
  "33": "مطروح",
  "34": "شمال سيناء",
  "35": "جنوب سيناء",
  "88": "مواليد خارج الجمهورية"
};

export const EGYPTIAN_GOVERNORATES: string[] = Object.values(GOVERNORATE_CODES);

export const EGYPTIAN_PHONE_REGEX = /^01[0125]\d{8}$/;

export interface NationalIdAnalysis {
  valid: boolean;
  dob?: string;
  gender?: "male" | "female";
  governorate?: string;
  governorateCode?: string;
}

export function validateEgyptianNationalId(id: string): NationalIdAnalysis {
  if (!id || !/^\d{14}$/.test(id)) return { valid: false };
  const centuryDigit = parseInt(id[0], 10);
  if (centuryDigit !== 2 && centuryDigit !== 3) return { valid: false };

  const yearTwoDigits = id.substring(1, 3);
  const monthStr = id.substring(3, 5);
  const dayStr = id.substring(5, 7);

  const fullYear = (centuryDigit === 2 ? 1900 : 2000) + parseInt(yearTwoDigits, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  if (month < 1 || month > 12 || day < 1 || day > 31) return { valid: false };

  const dobDate = new Date(fullYear, month - 1, day);
  if (
    dobDate.getFullYear() !== fullYear ||
    dobDate.getMonth() !== month - 1 ||
    dobDate.getDate() !== day
  ) {
    return { valid: false };
  }

  const govCodeStr = id.substring(7, 9);
  const governorate = GOVERNORATE_CODES[govCodeStr];
  if (!governorate) return { valid: false };

  const genderDigit = parseInt(id[12], 10);
  const gender = genderDigit % 2 !== 0 ? "male" : "female";
  const dobFormatted = `${fullYear}-${monthStr.padStart(2, "0")}-${dayStr.padStart(2, "0")}`;

  return { valid: true, dob: dobFormatted, gender, governorate, governorateCode: govCodeStr };
}

export function calculateAgeFromDob(dobStr?: string): number | null {
  if (!dobStr) return null;
  const dob = new Date(dobStr);
  if (isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}
