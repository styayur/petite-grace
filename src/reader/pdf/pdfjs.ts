import workerSource from "pdfjs-dist/build/pdf.worker.min.mjs?raw";

type PdfModule = typeof import("pdfjs-dist");

let modulePromise: Promise<PdfModule> | null = null;
let workerUrl: string | null = null;

export async function loadPdfJs(): Promise<PdfModule> {
  if (!modulePromise) {
    modulePromise = import("pdfjs-dist").then((module) => {
      if (!workerUrl) {
        workerUrl = URL.createObjectURL(new Blob([workerSource], { type: "text/javascript" }));
      }
      module.GlobalWorkerOptions.workerSrc = workerUrl;
      return module;
    });
  }
  return modulePromise;
}

export function releasePdfJsWorker(): void {
  if (workerUrl) {
    URL.revokeObjectURL(workerUrl);
    workerUrl = null;
  }
}
