/**
 * Egyptian Governorates and Cities Database
 * Source: https://github.com/Tech-Labs/egypt-governorates-and-cities-db
 * Total Governorates: 27 | Total Cities/Districts: 396
 */

export interface Governorate {
  id: string;
  nameAr: string;
  nameEn: string;
}

export interface City {
  id: string;
  governorateId: string;
  nameAr: string;
  nameEn: string;
}

export const EGYPT_GOVERNORATES: Governorate[] = [
  {
    "id": "1",
    "nameAr": "القاهرة",
    "nameEn": "Cairo"
  },
  {
    "id": "2",
    "nameAr": "الجيزة",
    "nameEn": "Giza"
  },
  {
    "id": "3",
    "nameAr": "الإسكندرية",
    "nameEn": "Alexandria"
  },
  {
    "id": "4",
    "nameAr": "الدقهلية",
    "nameEn": "Dakahlia"
  },
  {
    "id": "5",
    "nameAr": "البحر الأحمر",
    "nameEn": "Red Sea"
  },
  {
    "id": "6",
    "nameAr": "البحيرة",
    "nameEn": "Beheira"
  },
  {
    "id": "7",
    "nameAr": "الفيوم",
    "nameEn": "Fayoum"
  },
  {
    "id": "8",
    "nameAr": "الغربية",
    "nameEn": "Gharbiya"
  },
  {
    "id": "9",
    "nameAr": "الإسماعيلية",
    "nameEn": "Ismailia"
  },
  {
    "id": "10",
    "nameAr": "المنوفية",
    "nameEn": "Menofia"
  },
  {
    "id": "11",
    "nameAr": "المنيا",
    "nameEn": "Minya"
  },
  {
    "id": "12",
    "nameAr": "القليوبية",
    "nameEn": "Qaliubiya"
  },
  {
    "id": "13",
    "nameAr": "الوادي الجديد",
    "nameEn": "New Valley"
  },
  {
    "id": "14",
    "nameAr": "السويس",
    "nameEn": "Suez"
  },
  {
    "id": "15",
    "nameAr": "أسوان",
    "nameEn": "Aswan"
  },
  {
    "id": "16",
    "nameAr": "أسيوط",
    "nameEn": "Assiut"
  },
  {
    "id": "17",
    "nameAr": "بني سويف",
    "nameEn": "Beni Suef"
  },
  {
    "id": "18",
    "nameAr": "بورسعيد",
    "nameEn": "Port Said"
  },
  {
    "id": "19",
    "nameAr": "دمياط",
    "nameEn": "Damietta"
  },
  {
    "id": "20",
    "nameAr": "الشرقية",
    "nameEn": "Sharkia"
  },
  {
    "id": "21",
    "nameAr": "جنوب سيناء",
    "nameEn": "South Sinai"
  },
  {
    "id": "22",
    "nameAr": "كفر الشيخ",
    "nameEn": "Kafr Al sheikh"
  },
  {
    "id": "23",
    "nameAr": "مطروح",
    "nameEn": "Matrouh"
  },
  {
    "id": "24",
    "nameAr": "الأقصر",
    "nameEn": "Luxor"
  },
  {
    "id": "25",
    "nameAr": "قنا",
    "nameEn": "Qena"
  },
  {
    "id": "26",
    "nameAr": "شمال سيناء",
    "nameEn": "North Sinai"
  },
  {
    "id": "27",
    "nameAr": "سوهاج",
    "nameEn": "Sohag"
  }
];

export const EGYPT_CITIES: City[] = [
  {
    "id": "1",
    "governorateId": "1",
    "nameAr": "15 مايو",
    "nameEn": "15 May"
  },
  {
    "id": "2",
    "governorateId": "1",
    "nameAr": "الازبكية",
    "nameEn": "Al Azbakeyah"
  },
  {
    "id": "3",
    "governorateId": "1",
    "nameAr": "البساتين",
    "nameEn": "Al Basatin"
  },
  {
    "id": "4",
    "governorateId": "1",
    "nameAr": "التبين",
    "nameEn": "Tebin"
  },
  {
    "id": "5",
    "governorateId": "1",
    "nameAr": "الخليفة",
    "nameEn": "El-Khalifa"
  },
  {
    "id": "6",
    "governorateId": "1",
    "nameAr": "الدراسة",
    "nameEn": "El darrasa"
  },
  {
    "id": "7",
    "governorateId": "1",
    "nameAr": "الدرب الاحمر",
    "nameEn": "Aldarb Alahmar"
  },
  {
    "id": "8",
    "governorateId": "1",
    "nameAr": "الزاوية الحمراء",
    "nameEn": "Zawya al-Hamra"
  },
  {
    "id": "9",
    "governorateId": "1",
    "nameAr": "الزيتون",
    "nameEn": "El-Zaytoun"
  },
  {
    "id": "10",
    "governorateId": "1",
    "nameAr": "الساحل",
    "nameEn": "Sahel"
  },
  {
    "id": "11",
    "governorateId": "1",
    "nameAr": "السلام",
    "nameEn": "El Salam"
  },
  {
    "id": "12",
    "governorateId": "1",
    "nameAr": "السيدة زينب",
    "nameEn": "Sayeda Zeinab"
  },
  {
    "id": "13",
    "governorateId": "1",
    "nameAr": "الشرابية",
    "nameEn": "El Sharabeya"
  },
  {
    "id": "14",
    "governorateId": "1",
    "nameAr": "مدينة الشروق",
    "nameEn": "Shorouk"
  },
  {
    "id": "15",
    "governorateId": "1",
    "nameAr": "الظاهر",
    "nameEn": "El Daher"
  },
  {
    "id": "16",
    "governorateId": "1",
    "nameAr": "العتبة",
    "nameEn": "Ataba"
  },
  {
    "id": "17",
    "governorateId": "1",
    "nameAr": "القاهرة الجديدة",
    "nameEn": "New Cairo"
  },
  {
    "id": "18",
    "governorateId": "1",
    "nameAr": "المرج",
    "nameEn": "El Marg"
  },
  {
    "id": "19",
    "governorateId": "1",
    "nameAr": "عزبة النخل",
    "nameEn": "Ezbet el Nakhl"
  },
  {
    "id": "20",
    "governorateId": "1",
    "nameAr": "المطرية",
    "nameEn": "Matareya"
  },
  {
    "id": "21",
    "governorateId": "1",
    "nameAr": "المعادى",
    "nameEn": "Maadi"
  },
  {
    "id": "22",
    "governorateId": "1",
    "nameAr": "المعصرة",
    "nameEn": "Maasara"
  },
  {
    "id": "23",
    "governorateId": "1",
    "nameAr": "المقطم",
    "nameEn": "Mokattam"
  },
  {
    "id": "24",
    "governorateId": "1",
    "nameAr": "المنيل",
    "nameEn": "Manyal"
  },
  {
    "id": "25",
    "governorateId": "1",
    "nameAr": "الموسكى",
    "nameEn": "Mosky"
  },
  {
    "id": "26",
    "governorateId": "1",
    "nameAr": "النزهة",
    "nameEn": "Nozha"
  },
  {
    "id": "27",
    "governorateId": "1",
    "nameAr": "الوايلى",
    "nameEn": "Waily"
  },
  {
    "id": "28",
    "governorateId": "1",
    "nameAr": "باب الشعرية",
    "nameEn": "Bab al-Shereia"
  },
  {
    "id": "29",
    "governorateId": "1",
    "nameAr": "بولاق",
    "nameEn": "Bolaq"
  },
  {
    "id": "30",
    "governorateId": "1",
    "nameAr": "جاردن سيتى",
    "nameEn": "Garden City"
  },
  {
    "id": "31",
    "governorateId": "1",
    "nameAr": "حدائق القبة",
    "nameEn": "Hadayek El-Kobba"
  },
  {
    "id": "32",
    "governorateId": "1",
    "nameAr": "حلوان",
    "nameEn": "Helwan"
  },
  {
    "id": "33",
    "governorateId": "1",
    "nameAr": "دار السلام",
    "nameEn": "Dar Al Salam"
  },
  {
    "id": "34",
    "governorateId": "1",
    "nameAr": "شبرا",
    "nameEn": "Shubra"
  },
  {
    "id": "35",
    "governorateId": "1",
    "nameAr": "طره",
    "nameEn": "Tura"
  },
  {
    "id": "36",
    "governorateId": "1",
    "nameAr": "عابدين",
    "nameEn": "Abdeen"
  },
  {
    "id": "37",
    "governorateId": "1",
    "nameAr": "عباسية",
    "nameEn": "Abaseya"
  },
  {
    "id": "38",
    "governorateId": "1",
    "nameAr": "عين شمس",
    "nameEn": "Ain Shams"
  },
  {
    "id": "39",
    "governorateId": "1",
    "nameAr": "مدينة نصر",
    "nameEn": "Nasr City"
  },
  {
    "id": "40",
    "governorateId": "1",
    "nameAr": "مصر الجديدة",
    "nameEn": "New Heliopolis"
  },
  {
    "id": "41",
    "governorateId": "1",
    "nameAr": "مصر القديمة",
    "nameEn": "Masr Al Qadima"
  },
  {
    "id": "42",
    "governorateId": "1",
    "nameAr": "منشية ناصر",
    "nameEn": "Mansheya Nasir"
  },
  {
    "id": "43",
    "governorateId": "1",
    "nameAr": "مدينة بدر",
    "nameEn": "Badr City"
  },
  {
    "id": "44",
    "governorateId": "1",
    "nameAr": "مدينة العبور",
    "nameEn": "Obour City"
  },
  {
    "id": "45",
    "governorateId": "1",
    "nameAr": "وسط البلد",
    "nameEn": "Cairo Downtown"
  },
  {
    "id": "46",
    "governorateId": "1",
    "nameAr": "الزمالك",
    "nameEn": "Zamalek"
  },
  {
    "id": "47",
    "governorateId": "1",
    "nameAr": "قصر النيل",
    "nameEn": "Kasr El Nile"
  },
  {
    "id": "48",
    "governorateId": "1",
    "nameAr": "الرحاب",
    "nameEn": "Rehab"
  },
  {
    "id": "49",
    "governorateId": "1",
    "nameAr": "القطامية",
    "nameEn": "Katameya"
  },
  {
    "id": "50",
    "governorateId": "1",
    "nameAr": "مدينتي",
    "nameEn": "Madinty"
  },
  {
    "id": "51",
    "governorateId": "1",
    "nameAr": "روض الفرج",
    "nameEn": "Rod Alfarag"
  },
  {
    "id": "52",
    "governorateId": "1",
    "nameAr": "شيراتون",
    "nameEn": "Sheraton"
  },
  {
    "id": "53",
    "governorateId": "1",
    "nameAr": "الجمالية",
    "nameEn": "El-Gamaleya"
  },
  {
    "id": "54",
    "governorateId": "1",
    "nameAr": "العاشر من رمضان",
    "nameEn": "10th of Ramadan City"
  },
  {
    "id": "55",
    "governorateId": "1",
    "nameAr": "الحلمية",
    "nameEn": "Helmeyat Alzaytoun"
  },
  {
    "id": "56",
    "governorateId": "1",
    "nameAr": "النزهة الجديدة",
    "nameEn": "New Nozha"
  },
  {
    "id": "57",
    "governorateId": "1",
    "nameAr": "العاصمة الإدارية",
    "nameEn": "Capital New"
  },
  {
    "id": "58",
    "governorateId": "2",
    "nameAr": "الجيزة",
    "nameEn": "Giza"
  },
  {
    "id": "59",
    "governorateId": "2",
    "nameAr": "السادس من أكتوبر",
    "nameEn": "Sixth of October"
  },
  {
    "id": "60",
    "governorateId": "2",
    "nameAr": "الشيخ زايد",
    "nameEn": "Cheikh Zayed"
  },
  {
    "id": "61",
    "governorateId": "2",
    "nameAr": "الحوامدية",
    "nameEn": "Hawamdiyah"
  },
  {
    "id": "62",
    "governorateId": "2",
    "nameAr": "البدرشين",
    "nameEn": "Al Badrasheen"
  },
  {
    "id": "63",
    "governorateId": "2",
    "nameAr": "الصف",
    "nameEn": "Saf"
  },
  {
    "id": "64",
    "governorateId": "2",
    "nameAr": "أطفيح",
    "nameEn": "Atfih"
  },
  {
    "id": "65",
    "governorateId": "2",
    "nameAr": "العياط",
    "nameEn": "Al Ayat"
  },
  {
    "id": "66",
    "governorateId": "2",
    "nameAr": "الباويطي",
    "nameEn": "Al-Bawaiti"
  },
  {
    "id": "67",
    "governorateId": "2",
    "nameAr": "منشأة القناطر",
    "nameEn": "ManshiyetAl Qanater"
  },
  {
    "id": "68",
    "governorateId": "2",
    "nameAr": "أوسيم",
    "nameEn": "Oaseem"
  },
  {
    "id": "69",
    "governorateId": "2",
    "nameAr": "كرداسة",
    "nameEn": "Kerdasa"
  },
  {
    "id": "70",
    "governorateId": "2",
    "nameAr": "أبو النمرس",
    "nameEn": "Abu Nomros"
  },
  {
    "id": "71",
    "governorateId": "2",
    "nameAr": "كفر غطاطي",
    "nameEn": "Kafr Ghati"
  },
  {
    "id": "72",
    "governorateId": "2",
    "nameAr": "منشأة البكاري",
    "nameEn": "Manshiyet Al Bakari"
  },
  {
    "id": "73",
    "governorateId": "2",
    "nameAr": "الدقى",
    "nameEn": "Dokki"
  },
  {
    "id": "74",
    "governorateId": "2",
    "nameAr": "العجوزة",
    "nameEn": "Agouza"
  },
  {
    "id": "75",
    "governorateId": "2",
    "nameAr": "الهرم",
    "nameEn": "Haram"
  },
  {
    "id": "76",
    "governorateId": "2",
    "nameAr": "الوراق",
    "nameEn": "Warraq"
  },
  {
    "id": "77",
    "governorateId": "2",
    "nameAr": "امبابة",
    "nameEn": "Imbaba"
  },
  {
    "id": "78",
    "governorateId": "2",
    "nameAr": "بولاق الدكرور",
    "nameEn": "Boulaq Dakrour"
  },
  {
    "id": "79",
    "governorateId": "2",
    "nameAr": "الواحات البحرية",
    "nameEn": "Al Wahat Al Baharia"
  },
  {
    "id": "80",
    "governorateId": "2",
    "nameAr": "العمرانية",
    "nameEn": "Omraneya"
  },
  {
    "id": "81",
    "governorateId": "2",
    "nameAr": "المنيب",
    "nameEn": "Moneeb"
  },
  {
    "id": "82",
    "governorateId": "2",
    "nameAr": "بين السرايات",
    "nameEn": "Bin Alsarayat"
  },
  {
    "id": "83",
    "governorateId": "2",
    "nameAr": "الكيت كات",
    "nameEn": "Kit Kat"
  },
  {
    "id": "84",
    "governorateId": "2",
    "nameAr": "المهندسين",
    "nameEn": "Mohandessin"
  },
  {
    "id": "85",
    "governorateId": "2",
    "nameAr": "فيصل",
    "nameEn": "Faisal"
  },
  {
    "id": "86",
    "governorateId": "2",
    "nameAr": "أبو رواش",
    "nameEn": "Abu Rawash"
  },
  {
    "id": "87",
    "governorateId": "2",
    "nameAr": "حدائق الأهرام",
    "nameEn": "Hadayek Alahram"
  },
  {
    "id": "88",
    "governorateId": "2",
    "nameAr": "الحرانية",
    "nameEn": "Haraneya"
  },
  {
    "id": "89",
    "governorateId": "2",
    "nameAr": "حدائق اكتوبر",
    "nameEn": "Hadayek October"
  },
  {
    "id": "90",
    "governorateId": "2",
    "nameAr": "صفط اللبن",
    "nameEn": "Saft Allaban"
  },
  {
    "id": "91",
    "governorateId": "2",
    "nameAr": "القرية الذكية",
    "nameEn": "Smart Village"
  },
  {
    "id": "92",
    "governorateId": "2",
    "nameAr": "ارض اللواء",
    "nameEn": "Ard Ellwaa"
  },
  {
    "id": "93",
    "governorateId": "3",
    "nameAr": "ابو قير",
    "nameEn": "Abu Qir"
  },
  {
    "id": "94",
    "governorateId": "3",
    "nameAr": "الابراهيمية",
    "nameEn": "Al Ibrahimeyah"
  },
  {
    "id": "95",
    "governorateId": "3",
    "nameAr": "الأزاريطة",
    "nameEn": "Azarita"
  },
  {
    "id": "96",
    "governorateId": "3",
    "nameAr": "الانفوشى",
    "nameEn": "Anfoushi"
  },
  {
    "id": "97",
    "governorateId": "3",
    "nameAr": "الدخيلة",
    "nameEn": "Dekheila"
  },
  {
    "id": "98",
    "governorateId": "3",
    "nameAr": "السيوف",
    "nameEn": "El Soyof"
  },
  {
    "id": "99",
    "governorateId": "3",
    "nameAr": "العامرية",
    "nameEn": "Ameria"
  },
  {
    "id": "100",
    "governorateId": "3",
    "nameAr": "اللبان",
    "nameEn": "El Labban"
  },
  {
    "id": "101",
    "governorateId": "3",
    "nameAr": "المفروزة",
    "nameEn": "Al Mafrouza"
  },
  {
    "id": "102",
    "governorateId": "3",
    "nameAr": "المنتزه",
    "nameEn": "El Montaza"
  },
  {
    "id": "103",
    "governorateId": "3",
    "nameAr": "المنشية",
    "nameEn": "Mansheya"
  },
  {
    "id": "104",
    "governorateId": "3",
    "nameAr": "الناصرية",
    "nameEn": "Naseria"
  },
  {
    "id": "105",
    "governorateId": "3",
    "nameAr": "امبروزو",
    "nameEn": "Ambrozo"
  },
  {
    "id": "106",
    "governorateId": "3",
    "nameAr": "باب شرق",
    "nameEn": "Bab Sharq"
  },
  {
    "id": "107",
    "governorateId": "3",
    "nameAr": "برج العرب",
    "nameEn": "Bourj Alarab"
  },
  {
    "id": "108",
    "governorateId": "3",
    "nameAr": "ستانلى",
    "nameEn": "Stanley"
  },
  {
    "id": "109",
    "governorateId": "3",
    "nameAr": "سموحة",
    "nameEn": "Smouha"
  },
  {
    "id": "110",
    "governorateId": "3",
    "nameAr": "سيدى بشر",
    "nameEn": "Sidi Bishr"
  },
  {
    "id": "111",
    "governorateId": "3",
    "nameAr": "شدس",
    "nameEn": "Shads"
  },
  {
    "id": "112",
    "governorateId": "3",
    "nameAr": "غيط العنب",
    "nameEn": "Gheet Alenab"
  },
  {
    "id": "113",
    "governorateId": "3",
    "nameAr": "فلمينج",
    "nameEn": "Fleming"
  },
  {
    "id": "114",
    "governorateId": "3",
    "nameAr": "فيكتوريا",
    "nameEn": "Victoria"
  },
  {
    "id": "115",
    "governorateId": "3",
    "nameAr": "كامب شيزار",
    "nameEn": "Camp Shizar"
  },
  {
    "id": "116",
    "governorateId": "3",
    "nameAr": "كرموز",
    "nameEn": "Karmooz"
  },
  {
    "id": "117",
    "governorateId": "3",
    "nameAr": "محطة الرمل",
    "nameEn": "Mahta Alraml"
  },
  {
    "id": "118",
    "governorateId": "3",
    "nameAr": "مينا البصل",
    "nameEn": "Mina El-Basal"
  },
  {
    "id": "119",
    "governorateId": "3",
    "nameAr": "العصافرة",
    "nameEn": "Asafra"
  },
  {
    "id": "120",
    "governorateId": "3",
    "nameAr": "العجمي",
    "nameEn": "Agamy"
  },
  {
    "id": "121",
    "governorateId": "3",
    "nameAr": "بكوس",
    "nameEn": "Bakos"
  },
  {
    "id": "122",
    "governorateId": "3",
    "nameAr": "بولكلي",
    "nameEn": "Boulkly"
  },
  {
    "id": "123",
    "governorateId": "3",
    "nameAr": "كليوباترا",
    "nameEn": "Cleopatra"
  },
  {
    "id": "124",
    "governorateId": "3",
    "nameAr": "جليم",
    "nameEn": "Glim"
  },
  {
    "id": "125",
    "governorateId": "3",
    "nameAr": "المعمورة",
    "nameEn": "Al Mamurah"
  },
  {
    "id": "126",
    "governorateId": "3",
    "nameAr": "المندرة",
    "nameEn": "Al Mandara"
  },
  {
    "id": "127",
    "governorateId": "3",
    "nameAr": "محرم بك",
    "nameEn": "Moharam Bek"
  },
  {
    "id": "128",
    "governorateId": "3",
    "nameAr": "الشاطبي",
    "nameEn": "Elshatby"
  },
  {
    "id": "129",
    "governorateId": "3",
    "nameAr": "سيدي جابر",
    "nameEn": "Sidi Gaber"
  },
  {
    "id": "130",
    "governorateId": "3",
    "nameAr": "الساحل الشمالي",
    "nameEn": "North Coast/sahel"
  },
  {
    "id": "131",
    "governorateId": "3",
    "nameAr": "الحضرة",
    "nameEn": "Alhadra"
  },
  {
    "id": "132",
    "governorateId": "3",
    "nameAr": "العطارين",
    "nameEn": "Alattarin"
  },
  {
    "id": "133",
    "governorateId": "3",
    "nameAr": "سيدي كرير",
    "nameEn": "Sidi Kerir"
  },
  {
    "id": "134",
    "governorateId": "3",
    "nameAr": "الجمرك",
    "nameEn": "Elgomrok"
  },
  {
    "id": "135",
    "governorateId": "3",
    "nameAr": "المكس",
    "nameEn": "Al Max"
  },
  {
    "id": "136",
    "governorateId": "3",
    "nameAr": "مارينا",
    "nameEn": "Marina"
  },
  {
    "id": "137",
    "governorateId": "4",
    "nameAr": "المنصورة",
    "nameEn": "Mansoura"
  },
  {
    "id": "138",
    "governorateId": "4",
    "nameAr": "طلخا",
    "nameEn": "Talkha"
  },
  {
    "id": "139",
    "governorateId": "4",
    "nameAr": "ميت غمر",
    "nameEn": "Mitt Ghamr"
  },
  {
    "id": "140",
    "governorateId": "4",
    "nameAr": "دكرنس",
    "nameEn": "Dekernes"
  },
  {
    "id": "141",
    "governorateId": "4",
    "nameAr": "أجا",
    "nameEn": "Aga"
  },
  {
    "id": "142",
    "governorateId": "4",
    "nameAr": "منية النصر",
    "nameEn": "Menia El Nasr"
  },
  {
    "id": "143",
    "governorateId": "4",
    "nameAr": "السنبلاوين",
    "nameEn": "Sinbillawin"
  },
  {
    "id": "144",
    "governorateId": "4",
    "nameAr": "الكردي",
    "nameEn": "El Kurdi"
  },
  {
    "id": "145",
    "governorateId": "4",
    "nameAr": "بني عبيد",
    "nameEn": "Bani Ubaid"
  },
  {
    "id": "146",
    "governorateId": "4",
    "nameAr": "المنزلة",
    "nameEn": "Al Manzala"
  },
  {
    "id": "147",
    "governorateId": "4",
    "nameAr": "تمي الأمديد",
    "nameEn": "tami al'amdid"
  },
  {
    "id": "148",
    "governorateId": "4",
    "nameAr": "الجمالية",
    "nameEn": "aljamalia"
  },
  {
    "id": "149",
    "governorateId": "4",
    "nameAr": "شربين",
    "nameEn": "Sherbin"
  },
  {
    "id": "150",
    "governorateId": "4",
    "nameAr": "المطرية",
    "nameEn": "Mataria"
  },
  {
    "id": "151",
    "governorateId": "4",
    "nameAr": "بلقاس",
    "nameEn": "Belqas"
  },
  {
    "id": "152",
    "governorateId": "4",
    "nameAr": "ميت سلسيل",
    "nameEn": "Meet Salsil"
  },
  {
    "id": "153",
    "governorateId": "4",
    "nameAr": "جمصة",
    "nameEn": "Gamasa"
  },
  {
    "id": "154",
    "governorateId": "4",
    "nameAr": "محلة دمنة",
    "nameEn": "Mahalat Damana"
  },
  {
    "id": "155",
    "governorateId": "4",
    "nameAr": "نبروه",
    "nameEn": "Nabroh"
  },
  {
    "id": "156",
    "governorateId": "5",
    "nameAr": "الغردقة",
    "nameEn": "Hurghada"
  },
  {
    "id": "157",
    "governorateId": "5",
    "nameAr": "رأس غارب",
    "nameEn": "Ras Ghareb"
  },
  {
    "id": "158",
    "governorateId": "5",
    "nameAr": "سفاجا",
    "nameEn": "Safaga"
  },
  {
    "id": "159",
    "governorateId": "5",
    "nameAr": "القصير",
    "nameEn": "El Qusiar"
  },
  {
    "id": "160",
    "governorateId": "5",
    "nameAr": "مرسى علم",
    "nameEn": "Marsa Alam"
  },
  {
    "id": "161",
    "governorateId": "5",
    "nameAr": "الشلاتين",
    "nameEn": "Shalatin"
  },
  {
    "id": "162",
    "governorateId": "5",
    "nameAr": "حلايب",
    "nameEn": "Halaib"
  },
  {
    "id": "163",
    "governorateId": "5",
    "nameAr": "الدهار",
    "nameEn": "Aldahar"
  },
  {
    "id": "164",
    "governorateId": "6",
    "nameAr": "دمنهور",
    "nameEn": "Damanhour"
  },
  {
    "id": "165",
    "governorateId": "6",
    "nameAr": "كفر الدوار",
    "nameEn": "Kafr El Dawar"
  },
  {
    "id": "166",
    "governorateId": "6",
    "nameAr": "رشيد",
    "nameEn": "Rashid"
  },
  {
    "id": "167",
    "governorateId": "6",
    "nameAr": "إدكو",
    "nameEn": "Edco"
  },
  {
    "id": "168",
    "governorateId": "6",
    "nameAr": "أبو المطامير",
    "nameEn": "Abu al-Matamir"
  },
  {
    "id": "169",
    "governorateId": "6",
    "nameAr": "أبو حمص",
    "nameEn": "Abu Homs"
  },
  {
    "id": "170",
    "governorateId": "6",
    "nameAr": "الدلنجات",
    "nameEn": "Delengat"
  },
  {
    "id": "171",
    "governorateId": "6",
    "nameAr": "المحمودية",
    "nameEn": "Mahmoudiyah"
  },
  {
    "id": "172",
    "governorateId": "6",
    "nameAr": "الرحمانية",
    "nameEn": "Rahmaniyah"
  },
  {
    "id": "173",
    "governorateId": "6",
    "nameAr": "إيتاي البارود",
    "nameEn": "Itai Baroud"
  },
  {
    "id": "174",
    "governorateId": "6",
    "nameAr": "حوش عيسى",
    "nameEn": "Housh Eissa"
  },
  {
    "id": "175",
    "governorateId": "6",
    "nameAr": "شبراخيت",
    "nameEn": "Shubrakhit"
  },
  {
    "id": "176",
    "governorateId": "6",
    "nameAr": "كوم حمادة",
    "nameEn": "Kom Hamada"
  },
  {
    "id": "177",
    "governorateId": "6",
    "nameAr": "بدر",
    "nameEn": "Badr"
  },
  {
    "id": "178",
    "governorateId": "6",
    "nameAr": "وادي النطرون",
    "nameEn": "Wadi Natrun"
  },
  {
    "id": "179",
    "governorateId": "6",
    "nameAr": "النوبارية الجديدة",
    "nameEn": "New Nubaria"
  },
  {
    "id": "180",
    "governorateId": "6",
    "nameAr": "النوبارية",
    "nameEn": "Alnoubareya"
  },
  {
    "id": "181",
    "governorateId": "7",
    "nameAr": "الفيوم",
    "nameEn": "Fayoum"
  },
  {
    "id": "182",
    "governorateId": "7",
    "nameAr": "الفيوم الجديدة",
    "nameEn": "Fayoum El Gedida"
  },
  {
    "id": "183",
    "governorateId": "7",
    "nameAr": "طامية",
    "nameEn": "Tamiya"
  },
  {
    "id": "184",
    "governorateId": "7",
    "nameAr": "سنورس",
    "nameEn": "Snores"
  },
  {
    "id": "185",
    "governorateId": "7",
    "nameAr": "إطسا",
    "nameEn": "Etsa"
  },
  {
    "id": "186",
    "governorateId": "7",
    "nameAr": "إبشواي",
    "nameEn": "Epschway"
  },
  {
    "id": "187",
    "governorateId": "7",
    "nameAr": "يوسف الصديق",
    "nameEn": "Yusuf El Sediaq"
  },
  {
    "id": "188",
    "governorateId": "7",
    "nameAr": "الحادقة",
    "nameEn": "Hadqa"
  },
  {
    "id": "189",
    "governorateId": "7",
    "nameAr": "اطسا",
    "nameEn": "Atsa"
  },
  {
    "id": "190",
    "governorateId": "7",
    "nameAr": "الجامعة",
    "nameEn": "Algamaa"
  },
  {
    "id": "191",
    "governorateId": "7",
    "nameAr": "السيالة",
    "nameEn": "Sayala"
  },
  {
    "id": "192",
    "governorateId": "8",
    "nameAr": "طنطا",
    "nameEn": "Tanta"
  },
  {
    "id": "193",
    "governorateId": "8",
    "nameAr": "المحلة الكبرى",
    "nameEn": "Al Mahalla Al Kobra"
  },
  {
    "id": "194",
    "governorateId": "8",
    "nameAr": "كفر الزيات",
    "nameEn": "Kafr El Zayat"
  },
  {
    "id": "195",
    "governorateId": "8",
    "nameAr": "زفتى",
    "nameEn": "Zefta"
  },
  {
    "id": "196",
    "governorateId": "8",
    "nameAr": "السنطة",
    "nameEn": "El Santa"
  },
  {
    "id": "197",
    "governorateId": "8",
    "nameAr": "قطور",
    "nameEn": "Qutour"
  },
  {
    "id": "198",
    "governorateId": "8",
    "nameAr": "بسيون",
    "nameEn": "Basion"
  },
  {
    "id": "199",
    "governorateId": "8",
    "nameAr": "سمنود",
    "nameEn": "Samannoud"
  },
  {
    "id": "200",
    "governorateId": "9",
    "nameAr": "الإسماعيلية",
    "nameEn": "Ismailia"
  },
  {
    "id": "201",
    "governorateId": "9",
    "nameAr": "فايد",
    "nameEn": "Fayed"
  },
  {
    "id": "202",
    "governorateId": "9",
    "nameAr": "القنطرة شرق",
    "nameEn": "Qantara Sharq"
  },
  {
    "id": "203",
    "governorateId": "9",
    "nameAr": "القنطرة غرب",
    "nameEn": "Qantara Gharb"
  },
  {
    "id": "204",
    "governorateId": "9",
    "nameAr": "التل الكبير",
    "nameEn": "El Tal El Kabier"
  },
  {
    "id": "205",
    "governorateId": "9",
    "nameAr": "أبو صوير",
    "nameEn": "Abu Sawir"
  },
  {
    "id": "206",
    "governorateId": "9",
    "nameAr": "القصاصين الجديدة",
    "nameEn": "Kasasien El Gedida"
  },
  {
    "id": "207",
    "governorateId": "9",
    "nameAr": "نفيشة",
    "nameEn": "Nefesha"
  },
  {
    "id": "208",
    "governorateId": "9",
    "nameAr": "الشيخ زايد",
    "nameEn": "Sheikh Zayed"
  },
  {
    "id": "209",
    "governorateId": "10",
    "nameAr": "شبين الكوم",
    "nameEn": "Shbeen El Koom"
  },
  {
    "id": "210",
    "governorateId": "10",
    "nameAr": "مدينة السادات",
    "nameEn": "Sadat City"
  },
  {
    "id": "211",
    "governorateId": "10",
    "nameAr": "منوف",
    "nameEn": "Menouf"
  },
  {
    "id": "212",
    "governorateId": "10",
    "nameAr": "سرس الليان",
    "nameEn": "Sars El-Layan"
  },
  {
    "id": "213",
    "governorateId": "10",
    "nameAr": "أشمون",
    "nameEn": "Ashmon"
  },
  {
    "id": "214",
    "governorateId": "10",
    "nameAr": "الباجور",
    "nameEn": "Al Bagor"
  },
  {
    "id": "215",
    "governorateId": "10",
    "nameAr": "قويسنا",
    "nameEn": "Quesna"
  },
  {
    "id": "216",
    "governorateId": "10",
    "nameAr": "بركة السبع",
    "nameEn": "Berkat El Saba"
  },
  {
    "id": "217",
    "governorateId": "10",
    "nameAr": "تلا",
    "nameEn": "Tala"
  },
  {
    "id": "218",
    "governorateId": "10",
    "nameAr": "الشهداء",
    "nameEn": "Al Shohada"
  },
  {
    "id": "219",
    "governorateId": "11",
    "nameAr": "المنيا",
    "nameEn": "Minya"
  },
  {
    "id": "220",
    "governorateId": "11",
    "nameAr": "المنيا الجديدة",
    "nameEn": "Minya El Gedida"
  },
  {
    "id": "221",
    "governorateId": "11",
    "nameAr": "العدوة",
    "nameEn": "El Adwa"
  },
  {
    "id": "222",
    "governorateId": "11",
    "nameAr": "مغاغة",
    "nameEn": "Magagha"
  },
  {
    "id": "223",
    "governorateId": "11",
    "nameAr": "بني مزار",
    "nameEn": "Bani Mazar"
  },
  {
    "id": "224",
    "governorateId": "11",
    "nameAr": "مطاي",
    "nameEn": "Mattay"
  },
  {
    "id": "225",
    "governorateId": "11",
    "nameAr": "سمالوط",
    "nameEn": "Samalut"
  },
  {
    "id": "226",
    "governorateId": "11",
    "nameAr": "المدينة الفكرية",
    "nameEn": "Madinat El Fekria"
  },
  {
    "id": "227",
    "governorateId": "11",
    "nameAr": "ملوي",
    "nameEn": "Meloy"
  },
  {
    "id": "228",
    "governorateId": "11",
    "nameAr": "دير مواس",
    "nameEn": "Deir Mawas"
  },
  {
    "id": "229",
    "governorateId": "11",
    "nameAr": "ابو قرقاص",
    "nameEn": "Abu Qurqas"
  },
  {
    "id": "230",
    "governorateId": "11",
    "nameAr": "ارض سلطان",
    "nameEn": "Ard Sultan"
  },
  {
    "id": "231",
    "governorateId": "12",
    "nameAr": "بنها",
    "nameEn": "Banha"
  },
  {
    "id": "232",
    "governorateId": "12",
    "nameAr": "قليوب",
    "nameEn": "Qalyub"
  },
  {
    "id": "233",
    "governorateId": "12",
    "nameAr": "شبرا الخيمة",
    "nameEn": "Shubra Al Khaimah"
  },
  {
    "id": "234",
    "governorateId": "12",
    "nameAr": "القناطر الخيرية",
    "nameEn": "Al Qanater Charity"
  },
  {
    "id": "235",
    "governorateId": "12",
    "nameAr": "الخانكة",
    "nameEn": "Khanka"
  },
  {
    "id": "236",
    "governorateId": "12",
    "nameAr": "كفر شكر",
    "nameEn": "Kafr Shukr"
  },
  {
    "id": "237",
    "governorateId": "12",
    "nameAr": "طوخ",
    "nameEn": "Tukh"
  },
  {
    "id": "238",
    "governorateId": "12",
    "nameAr": "قها",
    "nameEn": "Qaha"
  },
  {
    "id": "239",
    "governorateId": "12",
    "nameAr": "العبور",
    "nameEn": "Obour"
  },
  {
    "id": "240",
    "governorateId": "12",
    "nameAr": "الخصوص",
    "nameEn": "Khosous"
  },
  {
    "id": "241",
    "governorateId": "12",
    "nameAr": "شبين القناطر",
    "nameEn": "Shibin Al Qanater"
  },
  {
    "id": "242",
    "governorateId": "12",
    "nameAr": "مسطرد",
    "nameEn": "Mostorod"
  },
  {
    "id": "243",
    "governorateId": "13",
    "nameAr": "الخارجة",
    "nameEn": "El Kharga"
  },
  {
    "id": "244",
    "governorateId": "13",
    "nameAr": "باريس",
    "nameEn": "Paris"
  },
  {
    "id": "245",
    "governorateId": "13",
    "nameAr": "موط",
    "nameEn": "Mout"
  },
  {
    "id": "246",
    "governorateId": "13",
    "nameAr": "الفرافرة",
    "nameEn": "Farafra"
  },
  {
    "id": "247",
    "governorateId": "13",
    "nameAr": "بلاط",
    "nameEn": "Balat"
  },
  {
    "id": "248",
    "governorateId": "13",
    "nameAr": "الداخلة",
    "nameEn": "Dakhla"
  },
  {
    "id": "249",
    "governorateId": "14",
    "nameAr": "السويس",
    "nameEn": "Suez"
  },
  {
    "id": "250",
    "governorateId": "14",
    "nameAr": "الجناين",
    "nameEn": "Alganayen"
  },
  {
    "id": "251",
    "governorateId": "14",
    "nameAr": "عتاقة",
    "nameEn": "Ataqah"
  },
  {
    "id": "252",
    "governorateId": "14",
    "nameAr": "العين السخنة",
    "nameEn": "Ain Sokhna"
  },
  {
    "id": "253",
    "governorateId": "14",
    "nameAr": "فيصل",
    "nameEn": "Faysal"
  },
  {
    "id": "254",
    "governorateId": "15",
    "nameAr": "أسوان",
    "nameEn": "Aswan"
  },
  {
    "id": "255",
    "governorateId": "15",
    "nameAr": "أسوان الجديدة",
    "nameEn": "Aswan El Gedida"
  },
  {
    "id": "256",
    "governorateId": "15",
    "nameAr": "دراو",
    "nameEn": "Drau"
  },
  {
    "id": "257",
    "governorateId": "15",
    "nameAr": "كوم أمبو",
    "nameEn": "Kom Ombo"
  },
  {
    "id": "258",
    "governorateId": "15",
    "nameAr": "نصر النوبة",
    "nameEn": "Nasr Al Nuba"
  },
  {
    "id": "259",
    "governorateId": "15",
    "nameAr": "كلابشة",
    "nameEn": "Kalabsha"
  },
  {
    "id": "260",
    "governorateId": "15",
    "nameAr": "إدفو",
    "nameEn": "Edfu"
  },
  {
    "id": "261",
    "governorateId": "15",
    "nameAr": "الرديسية",
    "nameEn": "Al-Radisiyah"
  },
  {
    "id": "262",
    "governorateId": "15",
    "nameAr": "البصيلية",
    "nameEn": "Al Basilia"
  },
  {
    "id": "263",
    "governorateId": "15",
    "nameAr": "السباعية",
    "nameEn": "Al Sibaeia"
  },
  {
    "id": "264",
    "governorateId": "15",
    "nameAr": "ابوسمبل السياحية",
    "nameEn": "Abo Simbl Al Siyahia"
  },
  {
    "id": "265",
    "governorateId": "15",
    "nameAr": "مرسى علم",
    "nameEn": "Marsa Alam"
  },
  {
    "id": "266",
    "governorateId": "16",
    "nameAr": "أسيوط",
    "nameEn": "Assiut"
  },
  {
    "id": "267",
    "governorateId": "16",
    "nameAr": "أسيوط الجديدة",
    "nameEn": "Assiut El Gedida"
  },
  {
    "id": "268",
    "governorateId": "16",
    "nameAr": "ديروط",
    "nameEn": "Dayrout"
  },
  {
    "id": "269",
    "governorateId": "16",
    "nameAr": "منفلوط",
    "nameEn": "Manfalut"
  },
  {
    "id": "270",
    "governorateId": "16",
    "nameAr": "القوصية",
    "nameEn": "Qusiya"
  },
  {
    "id": "271",
    "governorateId": "16",
    "nameAr": "أبنوب",
    "nameEn": "Abnoub"
  },
  {
    "id": "272",
    "governorateId": "16",
    "nameAr": "أبو تيج",
    "nameEn": "Abu Tig"
  },
  {
    "id": "273",
    "governorateId": "16",
    "nameAr": "الغنايم",
    "nameEn": "El Ghanaim"
  },
  {
    "id": "274",
    "governorateId": "16",
    "nameAr": "ساحل سليم",
    "nameEn": "Sahel Selim"
  },
  {
    "id": "275",
    "governorateId": "16",
    "nameAr": "البداري",
    "nameEn": "El Badari"
  },
  {
    "id": "276",
    "governorateId": "16",
    "nameAr": "صدفا",
    "nameEn": "Sidfa"
  },
  {
    "id": "277",
    "governorateId": "17",
    "nameAr": "بني سويف",
    "nameEn": "Bani Sweif"
  },
  {
    "id": "278",
    "governorateId": "17",
    "nameAr": "بني سويف الجديدة",
    "nameEn": "Beni Suef El Gedida"
  },
  {
    "id": "279",
    "governorateId": "17",
    "nameAr": "الواسطى",
    "nameEn": "Al Wasta"
  },
  {
    "id": "280",
    "governorateId": "17",
    "nameAr": "ناصر",
    "nameEn": "Naser"
  },
  {
    "id": "281",
    "governorateId": "17",
    "nameAr": "إهناسيا",
    "nameEn": "Ehnasia"
  },
  {
    "id": "282",
    "governorateId": "17",
    "nameAr": "ببا",
    "nameEn": "beba"
  },
  {
    "id": "283",
    "governorateId": "17",
    "nameAr": "الفشن",
    "nameEn": "Fashn"
  },
  {
    "id": "284",
    "governorateId": "17",
    "nameAr": "سمسطا",
    "nameEn": "Somasta"
  },
  {
    "id": "285",
    "governorateId": "17",
    "nameAr": "الاباصيرى",
    "nameEn": "Alabbaseri"
  },
  {
    "id": "286",
    "governorateId": "17",
    "nameAr": "مقبل",
    "nameEn": "Mokbel"
  },
  {
    "id": "287",
    "governorateId": "18",
    "nameAr": "بورسعيد",
    "nameEn": "PorSaid"
  },
  {
    "id": "288",
    "governorateId": "18",
    "nameAr": "بورفؤاد",
    "nameEn": "Port Fouad"
  },
  {
    "id": "289",
    "governorateId": "18",
    "nameAr": "العرب",
    "nameEn": "Alarab"
  },
  {
    "id": "290",
    "governorateId": "18",
    "nameAr": "حى الزهور",
    "nameEn": "Zohour"
  },
  {
    "id": "291",
    "governorateId": "18",
    "nameAr": "حى الشرق",
    "nameEn": "Alsharq"
  },
  {
    "id": "292",
    "governorateId": "18",
    "nameAr": "حى الضواحى",
    "nameEn": "Aldawahi"
  },
  {
    "id": "293",
    "governorateId": "18",
    "nameAr": "حى المناخ",
    "nameEn": "Almanakh"
  },
  {
    "id": "294",
    "governorateId": "18",
    "nameAr": "حى مبارك",
    "nameEn": "Mubarak"
  },
  {
    "id": "295",
    "governorateId": "19",
    "nameAr": "دمياط",
    "nameEn": "Damietta"
  },
  {
    "id": "296",
    "governorateId": "19",
    "nameAr": "دمياط الجديدة",
    "nameEn": "New Damietta"
  },
  {
    "id": "297",
    "governorateId": "19",
    "nameAr": "رأس البر",
    "nameEn": "Ras El Bar"
  },
  {
    "id": "298",
    "governorateId": "19",
    "nameAr": "فارسكور",
    "nameEn": "Faraskour"
  },
  {
    "id": "299",
    "governorateId": "19",
    "nameAr": "الزرقا",
    "nameEn": "Zarqa"
  },
  {
    "id": "300",
    "governorateId": "19",
    "nameAr": "السرو",
    "nameEn": "alsaru"
  },
  {
    "id": "301",
    "governorateId": "19",
    "nameAr": "الروضة",
    "nameEn": "alruwda"
  },
  {
    "id": "302",
    "governorateId": "19",
    "nameAr": "كفر البطيخ",
    "nameEn": "Kafr El-Batikh"
  },
  {
    "id": "303",
    "governorateId": "19",
    "nameAr": "عزبة البرج",
    "nameEn": "Azbet Al Burg"
  },
  {
    "id": "304",
    "governorateId": "19",
    "nameAr": "ميت أبو غالب",
    "nameEn": "Meet Abou Ghalib"
  },
  {
    "id": "305",
    "governorateId": "19",
    "nameAr": "كفر سعد",
    "nameEn": "Kafr Saad"
  },
  {
    "id": "306",
    "governorateId": "20",
    "nameAr": "الزقازيق",
    "nameEn": "Zagazig"
  },
  {
    "id": "307",
    "governorateId": "20",
    "nameAr": "العاشر من رمضان",
    "nameEn": "Al Ashr Men Ramadan"
  },
  {
    "id": "308",
    "governorateId": "20",
    "nameAr": "منيا القمح",
    "nameEn": "Minya Al Qamh"
  },
  {
    "id": "309",
    "governorateId": "20",
    "nameAr": "بلبيس",
    "nameEn": "Belbeis"
  },
  {
    "id": "310",
    "governorateId": "20",
    "nameAr": "مشتول السوق",
    "nameEn": "Mashtoul El Souq"
  },
  {
    "id": "311",
    "governorateId": "20",
    "nameAr": "القنايات",
    "nameEn": "Qenaiat"
  },
  {
    "id": "312",
    "governorateId": "20",
    "nameAr": "أبو حماد",
    "nameEn": "Abu Hammad"
  },
  {
    "id": "313",
    "governorateId": "20",
    "nameAr": "القرين",
    "nameEn": "El Qurain"
  },
  {
    "id": "314",
    "governorateId": "20",
    "nameAr": "ههيا",
    "nameEn": "Hehia"
  },
  {
    "id": "315",
    "governorateId": "20",
    "nameAr": "أبو كبير",
    "nameEn": "Abu Kabir"
  },
  {
    "id": "316",
    "governorateId": "20",
    "nameAr": "فاقوس",
    "nameEn": "Faccus"
  },
  {
    "id": "317",
    "governorateId": "20",
    "nameAr": "الصالحية الجديدة",
    "nameEn": "El Salihia El Gedida"
  },
  {
    "id": "318",
    "governorateId": "20",
    "nameAr": "الإبراهيمية",
    "nameEn": "Al Ibrahimiyah"
  },
  {
    "id": "319",
    "governorateId": "20",
    "nameAr": "ديرب نجم",
    "nameEn": "Deirb Negm"
  },
  {
    "id": "320",
    "governorateId": "20",
    "nameAr": "كفر صقر",
    "nameEn": "Kafr Saqr"
  },
  {
    "id": "321",
    "governorateId": "20",
    "nameAr": "أولاد صقر",
    "nameEn": "Awlad Saqr"
  },
  {
    "id": "322",
    "governorateId": "20",
    "nameAr": "الحسينية",
    "nameEn": "Husseiniya"
  },
  {
    "id": "323",
    "governorateId": "20",
    "nameAr": "صان الحجر القبلية",
    "nameEn": "san alhajar alqablia"
  },
  {
    "id": "324",
    "governorateId": "20",
    "nameAr": "منشأة أبو عمر",
    "nameEn": "Manshayat Abu Omar"
  },
  {
    "id": "325",
    "governorateId": "21",
    "nameAr": "الطور",
    "nameEn": "Al Toor"
  },
  {
    "id": "326",
    "governorateId": "21",
    "nameAr": "شرم الشيخ",
    "nameEn": "Sharm El-Shaikh"
  },
  {
    "id": "327",
    "governorateId": "21",
    "nameAr": "دهب",
    "nameEn": "Dahab"
  },
  {
    "id": "328",
    "governorateId": "21",
    "nameAr": "نويبع",
    "nameEn": "Nuweiba"
  },
  {
    "id": "329",
    "governorateId": "21",
    "nameAr": "طابا",
    "nameEn": "Taba"
  },
  {
    "id": "330",
    "governorateId": "21",
    "nameAr": "سانت كاترين",
    "nameEn": "Saint Catherine"
  },
  {
    "id": "331",
    "governorateId": "21",
    "nameAr": "أبو رديس",
    "nameEn": "Abu Redis"
  },
  {
    "id": "332",
    "governorateId": "21",
    "nameAr": "أبو زنيمة",
    "nameEn": "Abu Zenaima"
  },
  {
    "id": "333",
    "governorateId": "21",
    "nameAr": "رأس سدر",
    "nameEn": "Ras Sidr"
  },
  {
    "id": "334",
    "governorateId": "22",
    "nameAr": "كفر الشيخ",
    "nameEn": "Kafr El Sheikh"
  },
  {
    "id": "335",
    "governorateId": "22",
    "nameAr": "وسط البلد كفر الشيخ",
    "nameEn": "Kafr El Sheikh Downtown"
  },
  {
    "id": "336",
    "governorateId": "22",
    "nameAr": "دسوق",
    "nameEn": "Desouq"
  },
  {
    "id": "337",
    "governorateId": "22",
    "nameAr": "فوه",
    "nameEn": "Fooh"
  },
  {
    "id": "338",
    "governorateId": "22",
    "nameAr": "مطوبس",
    "nameEn": "Metobas"
  },
  {
    "id": "339",
    "governorateId": "22",
    "nameAr": "برج البرلس",
    "nameEn": "Burg Al Burullus"
  },
  {
    "id": "340",
    "governorateId": "22",
    "nameAr": "بلطيم",
    "nameEn": "Baltim"
  },
  {
    "id": "341",
    "governorateId": "22",
    "nameAr": "مصيف بلطيم",
    "nameEn": "Masief Baltim"
  },
  {
    "id": "342",
    "governorateId": "22",
    "nameAr": "الحامول",
    "nameEn": "Hamol"
  },
  {
    "id": "343",
    "governorateId": "22",
    "nameAr": "بيلا",
    "nameEn": "Bella"
  },
  {
    "id": "344",
    "governorateId": "22",
    "nameAr": "الرياض",
    "nameEn": "Riyadh"
  },
  {
    "id": "345",
    "governorateId": "22",
    "nameAr": "سيدي سالم",
    "nameEn": "Sidi Salm"
  },
  {
    "id": "346",
    "governorateId": "22",
    "nameAr": "قلين",
    "nameEn": "Qellen"
  },
  {
    "id": "347",
    "governorateId": "22",
    "nameAr": "سيدي غازي",
    "nameEn": "Sidi Ghazi"
  },
  {
    "id": "348",
    "governorateId": "23",
    "nameAr": "مرسى مطروح",
    "nameEn": "Marsa Matrouh"
  },
  {
    "id": "349",
    "governorateId": "23",
    "nameAr": "الحمام",
    "nameEn": "El Hamam"
  },
  {
    "id": "350",
    "governorateId": "23",
    "nameAr": "العلمين",
    "nameEn": "Alamein"
  },
  {
    "id": "351",
    "governorateId": "23",
    "nameAr": "الضبعة",
    "nameEn": "Dabaa"
  },
  {
    "id": "352",
    "governorateId": "23",
    "nameAr": "النجيلة",
    "nameEn": "Al-Nagila"
  },
  {
    "id": "353",
    "governorateId": "23",
    "nameAr": "سيدي براني",
    "nameEn": "Sidi Brani"
  },
  {
    "id": "354",
    "governorateId": "23",
    "nameAr": "السلوم",
    "nameEn": "Salloum"
  },
  {
    "id": "355",
    "governorateId": "23",
    "nameAr": "سيوة",
    "nameEn": "Siwa"
  },
  {
    "id": "356",
    "governorateId": "23",
    "nameAr": "مارينا",
    "nameEn": "Marina"
  },
  {
    "id": "357",
    "governorateId": "23",
    "nameAr": "الساحل الشمالى",
    "nameEn": "North Coast"
  },
  {
    "id": "358",
    "governorateId": "24",
    "nameAr": "الأقصر",
    "nameEn": "Luxor"
  },
  {
    "id": "359",
    "governorateId": "24",
    "nameAr": "الأقصر الجديدة",
    "nameEn": "New Luxor"
  },
  {
    "id": "360",
    "governorateId": "24",
    "nameAr": "إسنا",
    "nameEn": "Esna"
  },
  {
    "id": "361",
    "governorateId": "24",
    "nameAr": "طيبة الجديدة",
    "nameEn": "New Tiba"
  },
  {
    "id": "362",
    "governorateId": "24",
    "nameAr": "الزينية",
    "nameEn": "Al ziynia"
  },
  {
    "id": "363",
    "governorateId": "24",
    "nameAr": "البياضية",
    "nameEn": "Al Bayadieh"
  },
  {
    "id": "364",
    "governorateId": "24",
    "nameAr": "القرنة",
    "nameEn": "Al Qarna"
  },
  {
    "id": "365",
    "governorateId": "24",
    "nameAr": "أرمنت",
    "nameEn": "Armant"
  },
  {
    "id": "366",
    "governorateId": "24",
    "nameAr": "الطود",
    "nameEn": "Al Tud"
  },
  {
    "id": "367",
    "governorateId": "25",
    "nameAr": "قنا",
    "nameEn": "Qena"
  },
  {
    "id": "368",
    "governorateId": "25",
    "nameAr": "قنا الجديدة",
    "nameEn": "New Qena"
  },
  {
    "id": "369",
    "governorateId": "25",
    "nameAr": "ابو طشت",
    "nameEn": "Abu Tesht"
  },
  {
    "id": "370",
    "governorateId": "25",
    "nameAr": "نجع حمادي",
    "nameEn": "Nag Hammadi"
  },
  {
    "id": "371",
    "governorateId": "25",
    "nameAr": "دشنا",
    "nameEn": "Deshna"
  },
  {
    "id": "372",
    "governorateId": "25",
    "nameAr": "الوقف",
    "nameEn": "Alwaqf"
  },
  {
    "id": "373",
    "governorateId": "25",
    "nameAr": "قفط",
    "nameEn": "Qaft"
  },
  {
    "id": "374",
    "governorateId": "25",
    "nameAr": "نقادة",
    "nameEn": "Naqada"
  },
  {
    "id": "375",
    "governorateId": "25",
    "nameAr": "فرشوط",
    "nameEn": "Farshout"
  },
  {
    "id": "376",
    "governorateId": "25",
    "nameAr": "قوص",
    "nameEn": "Quos"
  },
  {
    "id": "377",
    "governorateId": "26",
    "nameAr": "العريش",
    "nameEn": "Arish"
  },
  {
    "id": "378",
    "governorateId": "26",
    "nameAr": "الشيخ زويد",
    "nameEn": "Sheikh Zowaid"
  },
  {
    "id": "379",
    "governorateId": "26",
    "nameAr": "نخل",
    "nameEn": "Nakhl"
  },
  {
    "id": "380",
    "governorateId": "26",
    "nameAr": "رفح",
    "nameEn": "Rafah"
  },
  {
    "id": "381",
    "governorateId": "26",
    "nameAr": "بئر العبد",
    "nameEn": "Bir al-Abed"
  },
  {
    "id": "382",
    "governorateId": "26",
    "nameAr": "الحسنة",
    "nameEn": "Al Hasana"
  },
  {
    "id": "383",
    "governorateId": "27",
    "nameAr": "سوهاج",
    "nameEn": "Sohag"
  },
  {
    "id": "384",
    "governorateId": "27",
    "nameAr": "سوهاج الجديدة",
    "nameEn": "Sohag El Gedida"
  },
  {
    "id": "385",
    "governorateId": "27",
    "nameAr": "أخميم",
    "nameEn": "Akhmeem"
  },
  {
    "id": "386",
    "governorateId": "27",
    "nameAr": "أخميم الجديدة",
    "nameEn": "Akhmim El Gedida"
  },
  {
    "id": "387",
    "governorateId": "27",
    "nameAr": "البلينا",
    "nameEn": "Albalina"
  },
  {
    "id": "388",
    "governorateId": "27",
    "nameAr": "المراغة",
    "nameEn": "El Maragha"
  },
  {
    "id": "389",
    "governorateId": "27",
    "nameAr": "المنشأة",
    "nameEn": "almunsha'a"
  },
  {
    "id": "390",
    "governorateId": "27",
    "nameAr": "دار السلام",
    "nameEn": "Dar AISalaam"
  },
  {
    "id": "391",
    "governorateId": "27",
    "nameAr": "جرجا",
    "nameEn": "Gerga"
  },
  {
    "id": "392",
    "governorateId": "27",
    "nameAr": "جهينة الغربية",
    "nameEn": "Jahina Al Gharbia"
  },
  {
    "id": "393",
    "governorateId": "27",
    "nameAr": "ساقلته",
    "nameEn": "Saqilatuh"
  },
  {
    "id": "394",
    "governorateId": "27",
    "nameAr": "طما",
    "nameEn": "Tama"
  },
  {
    "id": "395",
    "governorateId": "27",
    "nameAr": "طهطا",
    "nameEn": "Tahta"
  },
  {
    "id": "396",
    "governorateId": "27",
    "nameAr": "الكوثر",
    "nameEn": "Alkawthar"
  }
];

// Quick lookup maps
export const GOVERNORATE_BY_ID_MAP: Record<string, Governorate> = Object.fromEntries(
  EGYPT_GOVERNORATES.map((g) => [g.id, g])
);

export const GOVERNORATE_BY_NAME_MAP: Record<string, Governorate> = Object.fromEntries(
  EGYPT_GOVERNORATES.flatMap((g) => [
    [g.nameAr, g],
    [g.nameEn.toLowerCase(), g],
  ])
);

/**
 * Get all cities belonging to a given governorate (by Arabic name, English name, or ID).
 */
export function getCitiesByGovernorate(governorateIdentifier?: string): City[] {
  if (!governorateIdentifier) return [];

  // Check if identifier is an ID
  if (GOVERNORATE_BY_ID_MAP[governorateIdentifier]) {
    return EGYPT_CITIES.filter((c) => c.governorateId === governorateIdentifier);
  }

  // Check by Arabic or English Name
  const foundGov = GOVERNORATE_BY_NAME_MAP[governorateIdentifier] || 
    GOVERNORATE_BY_NAME_MAP[governorateIdentifier.toLowerCase()];

  if (foundGov) {
    return EGYPT_CITIES.filter((c) => c.governorateId === foundGov.id);
  }

  // Fallback direct nameAr match in case of alternate spellings
  return EGYPT_CITIES.filter((c) => {
    const gov = GOVERNORATE_BY_ID_MAP[c.governorateId];
    return gov && (gov.nameAr.includes(governorateIdentifier) || governorateIdentifier.includes(gov.nameAr));
  });
}

/**
 * Get list of all governorate Arabic names for easy select options.
 */
export const EGYPTIAN_GOVERNORATE_NAMES: string[] = EGYPT_GOVERNORATES.map((g) => g.nameAr);
