export type ShiftVacancy = Readonly<{
  shiftId: string;
  clientId: string;
  clientFirstName: string;
  clientLastInitial: string;
  clientLanguage: string;
  startTime: string; // ISO
  endTime: string; // ISO
  requiredSkills: string[];
}>;

export type CandidateRow = Readonly<{
  caregiver_id: string;
  caregiver_name: string;
  phone_number: string;
  distance_miles: number;
  skills_overlap: string[] | null;
  has_mandatory_skills: boolean;
  reliability_score: number;
  last_minute_accept_rate: number;
  language_match: boolean;
}>;

export type CandidateFeatureScores = Readonly<{
  distance: number; // 0..1
  skills: number; // 0..1
  reliability: number; // 0..1
  language: number; // 0..1
}>;

export type RankedCandidate = Readonly<{
  caregiverId: string;
  finalScore: number; // 0..1
  featureScores: CandidateFeatureScores;
  rationale: string;
}>;

export type BackfillState = Readonly<{
  shiftId: string;
  vacancy?: ShiftVacancy;
  candidates?: CandidateRow[];
  ranked?: RankedCandidate[];
  chosenCaregiverId?: string;
  safetyRedactionsApplied?: string[];
}>;

