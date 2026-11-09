export type PdfLayout = "single" | "double";
export type ZoomMode = "fit-width" | "fit-page" | "custom";

export interface ReadingState {
  documentId: string;
  page: number;
  relativeScroll: number;
  scale: number;
  layout: PdfLayout;
  zoomMode: ZoomMode;
  updatedAt: string;
}
