import { z } from "zod";

export const GrammarTags = [
  "particle_subject",
  "particle_topic",
  "particle_object",
  "particle_location",
  "verb_conjugation",
  "honorific",
  "spacing",
  "word_choice",
  "sentence_order",
  "missing_word",
  "unnatural",
] as const;

export const GrammarTagSchema = z.enum(GrammarTags);

export type GrammarTag = z.infer<typeof GrammarTagSchema>;
