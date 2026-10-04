import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import arCommon from "../locales/ar/common.json";
import enCommon from "../locales/en/common.json";

const resources = {
  ar: {
    common: arCommon,
  },
  en: {
    common: enCommon,
  },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: "ar", // default language
    fallbackLng: "ar",
    interpolation: {
      escapeValue: false, // react already safes from xss
    },
  });

export default i18n;
