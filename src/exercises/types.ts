export interface ExerciseOption {
  id: string;
  label: string;
  text: string;
}

export interface ExerciseQuestion {
  id: string;
  number: number;
  stem: string;
  options: ExerciseOption[];
  verifiedAnswer: string | null;
  verifiedSource: string | null;
  explanation: string | null;
}

export interface ExerciseSet {
  resourceId: string;
  title: string;
  questions: ExerciseQuestion[];
  parsedFrom: "html" | "host-dom";
  warnings: string[];
}

export interface ExerciseState {
  exerciseId: string;
  resourceId: string;
  viewed: boolean;
  completed: boolean;
  needsReview: boolean;
  userAnswer: string;
  updatedAt: string;
}
