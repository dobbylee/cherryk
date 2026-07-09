import type { UserLevel } from "@/lib/contracts/common";
import type { GrammarTag } from "@/lib/contracts/grammar-tags";

export type InitialApprovedQuiz = {
  id: string;
  tag: GrammarTag;
  difficulty: UserLevel;
  questionEn: string;
  sentenceKo: string;
  answerExplanationEn: string;
  choices: {
    id: string;
    text: string;
    isCorrect: boolean;
  }[];
};

export const INITIAL_APPROVED_QUIZZES: InitialApprovedQuiz[] = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    tag: "particle_object",
    difficulty: "beginner",
    questionEn: "Choose the correct object particle.",
    sentenceKo: "저는 물( ) 마셔요.",
    choices: [
      {
        id: "20000000-0000-4000-8000-000000000001",
        text: "은",
        isCorrect: false,
      },
      {
        id: "20000000-0000-4000-8000-000000000002",
        text: "을",
        isCorrect: true,
      },
      {
        id: "20000000-0000-4000-8000-000000000003",
        text: "에",
        isCorrect: false,
      },
      {
        id: "20000000-0000-4000-8000-000000000004",
        text: "이",
        isCorrect: false,
      },
    ],
    answerExplanationEn: "Use 을 because 물 is the direct object of 마셔요.",
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    tag: "particle_object",
    difficulty: "beginner",
    questionEn: "Choose the particle for the thing being read.",
    sentenceKo: "친구가 책( ) 읽어요.",
    choices: [
      {
        id: "20000000-0000-4000-8000-000000000005",
        text: "가",
        isCorrect: false,
      },
      {
        id: "20000000-0000-4000-8000-000000000006",
        text: "을",
        isCorrect: true,
      },
      {
        id: "20000000-0000-4000-8000-000000000007",
        text: "에서",
        isCorrect: false,
      },
      {
        id: "20000000-0000-4000-8000-000000000008",
        text: "은",
        isCorrect: false,
      },
    ],
    answerExplanationEn: "Use 을 because 책 receives the action 읽어요.",
  },
  {
    id: "10000000-0000-4000-8000-000000000003",
    tag: "particle_location",
    difficulty: "beginner",
    questionEn: "Choose the particle for where an action happens.",
    sentenceKo: "저는 도서관( ) 공부해요.",
    choices: [
      {
        id: "20000000-0000-4000-8000-000000000009",
        text: "에",
        isCorrect: false,
      },
      {
        id: "20000000-0000-4000-8000-000000000010",
        text: "에서",
        isCorrect: true,
      },
      {
        id: "20000000-0000-4000-8000-000000000011",
        text: "을",
        isCorrect: false,
      },
      {
        id: "20000000-0000-4000-8000-000000000012",
        text: "는",
        isCorrect: false,
      },
    ],
    answerExplanationEn:
      "Use 에서 for the place where the action 공부해요 happens.",
  },
  {
    id: "10000000-0000-4000-8000-000000000004",
    tag: "particle_location",
    difficulty: "beginner",
    questionEn: "Choose the particle for destination.",
    sentenceKo: "저는 학교( ) 가요.",
    choices: [
      {
        id: "20000000-0000-4000-8000-000000000013",
        text: "에서",
        isCorrect: false,
      },
      {
        id: "20000000-0000-4000-8000-000000000014",
        text: "를",
        isCorrect: false,
      },
      {
        id: "20000000-0000-4000-8000-000000000015",
        text: "에",
        isCorrect: true,
      },
      {
        id: "20000000-0000-4000-8000-000000000016",
        text: "이",
        isCorrect: false,
      },
    ],
    answerExplanationEn: "Use 에 with 가요 to mark the destination.",
  },
  {
    id: "10000000-0000-4000-8000-000000000005",
    tag: "particle_topic",
    difficulty: "beginner",
    questionEn: "Choose the topic particle.",
    sentenceKo: "오늘( ) 날씨가 좋아요.",
    choices: [
      {
        id: "20000000-0000-4000-8000-000000000017",
        text: "를",
        isCorrect: false,
      },
      {
        id: "20000000-0000-4000-8000-000000000018",
        text: "은",
        isCorrect: true,
      },
      {
        id: "20000000-0000-4000-8000-000000000019",
        text: "가",
        isCorrect: false,
      },
      {
        id: "20000000-0000-4000-8000-000000000020",
        text: "에",
        isCorrect: false,
      },
    ],
    answerExplanationEn: "Use 은 to set 오늘 as the topic of the sentence.",
  },
  {
    id: "10000000-0000-4000-8000-000000000006",
    tag: "particle_topic",
    difficulty: "beginner",
    questionEn: "Choose the topic marker after a consonant.",
    sentenceKo: "제 이름( ) 민지예요.",
    choices: [
      {
        id: "20000000-0000-4000-8000-000000000021",
        text: "은",
        isCorrect: true,
      },
      {
        id: "20000000-0000-4000-8000-000000000022",
        text: "는",
        isCorrect: false,
      },
      {
        id: "20000000-0000-4000-8000-000000000023",
        text: "가",
        isCorrect: false,
      },
      {
        id: "20000000-0000-4000-8000-000000000024",
        text: "를",
        isCorrect: false,
      },
    ],
    answerExplanationEn:
      "Use 은 after 이름 because 이름 ends in a consonant sound.",
  },
  {
    id: "10000000-0000-4000-8000-000000000007",
    tag: "particle_subject",
    difficulty: "beginner",
    questionEn: "Choose the subject particle.",
    sentenceKo: "비( ) 와요.",
    choices: [
      {
        id: "20000000-0000-4000-8000-000000000025",
        text: "는",
        isCorrect: false,
      },
      {
        id: "20000000-0000-4000-8000-000000000026",
        text: "를",
        isCorrect: false,
      },
      {
        id: "20000000-0000-4000-8000-000000000027",
        text: "가",
        isCorrect: true,
      },
      {
        id: "20000000-0000-4000-8000-000000000028",
        text: "에",
        isCorrect: false,
      },
    ],
    answerExplanationEn: "Use 가 because 비 is the subject of 와요.",
  },
  {
    id: "10000000-0000-4000-8000-000000000008",
    tag: "particle_subject",
    difficulty: "beginner",
    questionEn: "Choose the subject particle after a consonant.",
    sentenceKo: "선생님( ) 오셨어요.",
    choices: [
      {
        id: "20000000-0000-4000-8000-000000000029",
        text: "이",
        isCorrect: true,
      },
      {
        id: "20000000-0000-4000-8000-000000000030",
        text: "가",
        isCorrect: false,
      },
      {
        id: "20000000-0000-4000-8000-000000000031",
        text: "을",
        isCorrect: false,
      },
      {
        id: "20000000-0000-4000-8000-000000000032",
        text: "에서",
        isCorrect: false,
      },
    ],
    answerExplanationEn:
      "Use 이 after 선생님 because it ends in a consonant sound.",
  },
  {
    id: "10000000-0000-4000-8000-000000000009",
    tag: "verb_conjugation",
    difficulty: "beginner",
    questionEn: "Choose the polite present-tense form.",
    sentenceKo: "저는 매일 운동을 ( ).",
    choices: [
      {
        id: "20000000-0000-4000-8000-000000000033",
        text: "해요",
        isCorrect: true,
      },
      {
        id: "20000000-0000-4000-8000-000000000034",
        text: "했어요",
        isCorrect: false,
      },
      {
        id: "20000000-0000-4000-8000-000000000035",
        text: "할게요",
        isCorrect: false,
      },
      {
        id: "20000000-0000-4000-8000-000000000036",
        text: "합시다",
        isCorrect: false,
      },
    ],
    answerExplanationEn:
      "Use 해요 for a regular present-tense habit in polite speech.",
  },
  {
    id: "10000000-0000-4000-8000-000000000010",
    tag: "verb_conjugation",
    difficulty: "beginner",
    questionEn: "Choose the polite past-tense form.",
    sentenceKo: "어제 영화를 ( ).",
    choices: [
      {
        id: "20000000-0000-4000-8000-000000000037",
        text: "봐요",
        isCorrect: false,
      },
      {
        id: "20000000-0000-4000-8000-000000000038",
        text: "봤어요",
        isCorrect: true,
      },
      {
        id: "20000000-0000-4000-8000-000000000039",
        text: "볼 거예요",
        isCorrect: false,
      },
      {
        id: "20000000-0000-4000-8000-000000000040",
        text: "봅시다",
        isCorrect: false,
      },
    ],
    answerExplanationEn:
      "Use 봤어요 because 어제 places the action in the past.",
  },
];
