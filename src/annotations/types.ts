export interface HighlightRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Annotation {
  id: string;
  documentId: string;
  courseId: string;
  resourceId: string;
  page: number;
  text: string;
  note: string;
  color: "yellow" | "blue" | "green" | "pink";
  rects: HighlightRect[];
  contextBefore: string;
  contextAfter: string;
  needsRelocation: boolean;
  createdAt: string;
  updatedAt: string;
}
