import { describe, expect, it } from "vitest";
import { normalizeExamQuestions, parseExamJson } from "./jsonImport";

describe("parseExamJson", () => {
  it("accepts the canonical AI JSON contract", () => {
    const result = parseExamJson(
      JSON.stringify({
        title: "مراجعة العلوم",
        description: "مراجعة شاملة",
        examType: "PRACTICE",
        durationMinutes: 45,
        questions: [
          {
            text: "ما وحدة قياس القوة؟",
            type: "multiple_choice",
            difficulty: "MEDIUM",
            points: 5,
            explanation: "القوة تقاس بالنيوتن.",
            options: [
              { text: "النيوتن", isCorrect: true },
              { text: "الجول", isCorrect: false },
            ],
          },
        ],
      }),
    );

    expect(result.title).toBe("مراجعة العلوم");
    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].options[0].isCorrect).toBe(true);
  });

  it("normalizes legacy question keys and correct_answer", () => {
    const result = parseExamJson(
      JSON.stringify({
        title: "اختبار قديم",
        questions: [
          {
            question_text: "2 + 2 = ؟",
            question_type: "MULTIPLE_CHOICE",
            options: ["3", "4"],
            correct_answer: "4",
            points: 5,
          },
        ],
      }),
    );

    expect(result.questions[0].options[1].isCorrect).toBe(true);
  });

  it("rejects multiple-choice questions without exactly one correct option", () => {
    expect(() =>
      parseExamJson(
        JSON.stringify({
          title: "اختبار",
          questions: [
            {
              text: "سؤال",
              type: "multiple_choice",
              points: 5,
              options: [
                { text: "أ", isCorrect: true },
                { text: "ب", isCorrect: true },
              ],
            },
          ],
        }),
      ),
    ).toThrow("إجابة صحيحة واحدة فقط");
  });
  it("normalizes string boolean flags without treating \"false\" as true", () => {
    const result = parseExamJson(
      JSON.stringify({
        title: "اختبار",
        questions: [
          {
            text: "2 + 2 = ؟",
            type: "multiple_choice",
            points: 5,
            options: [
              { text: "4", isCorrect: "true" },
              { text: "5", isCorrect: "false" },
            ],
          },
        ],
      }),
    );

    expect(result.questions[0].options[0].isCorrect).toBe(true);
    expect(result.questions[0].options[1].isCorrect).toBe(false);
  });


  it("normalizes frontend type aliases for mixed question types", () => {
    const result = normalizeExamQuestions([
      {
        text: "ما وحدة قياس القوة؟",
        type: "multiple_choice",
        points: 5,
        options: [
          { text: "نيوتن", isCorrect: true },
          { text: "جول", isCorrect: false },
        ],
      },
      {
        text: "القوة تساوي الكتلة في التسارع.",
        type: "true_false",
        points: 5,
        options: [
          { text: "صواب", isCorrect: true },
          { text: "خطأ", isCorrect: false },
        ],
      },
      {
        text: "اشرح قانون نيوتن الأول.",
        type: "essay",
        points: 10,
        options: [],
      },
    ]);

    expect(result).toHaveLength(3);
    expect(result[1].type).toBe("true_false");
    expect(result[2].type).toBe("essay");
  });

});
