import { strFromU8, unzipSync } from "fflate";

const EMU_PER_PX = 9525;
const DEFAULT_SLIDE_WIDTH = 960;
const DEFAULT_SLIDE_HEIGHT = 540;

export interface PptxTextElement {
  kind: "text";
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  fontSize: number;
  color: string;
  bold: boolean;
  align: "left" | "center" | "right";
}

export interface PptxImageElement {
  kind: "image";
  x: number;
  y: number;
  width: number;
  height: number;
  src: string;
  alt: string;
}

export type PptxElement = PptxTextElement | PptxImageElement;

export interface PptxSlide {
  number: number;
  width: number;
  height: number;
  elements: PptxElement[];
}

export interface PptxDocument {
  width: number;
  height: number;
  slides: PptxSlide[];
  warnings: string[];
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

function parseXml(text: string): Document {
  const parser = new DOMParser();
  const document = parser.parseFromString(text, "application/xml");
  if (document.querySelector("parsererror")) throw new Error("PPTX XML 解析失败");
  return document;
}

function descendants(root: Element, localName: string): Element[] {
  return Array.from(root.getElementsByTagName("*")).filter(
    (element) => element.localName === localName,
  );
}

function firstDescendant(root: Element, localName: string): Element | null {
  return descendants(root, localName)[0] ?? null;
}

function readBox(shape: Element): Box | null {
  const xfrm = firstDescendant(shape, "xfrm");
  if (!xfrm) return null;
  const offset = firstDescendant(xfrm, "off");
  const extent = firstDescendant(xfrm, "ext");
  if (!offset || !extent) return null;
  return {
    x: Number(offset.getAttribute("x") ?? 0) / EMU_PER_PX,
    y: Number(offset.getAttribute("y") ?? 0) / EMU_PER_PX,
    width: Number(extent.getAttribute("cx") ?? 0) / EMU_PER_PX,
    height: Number(extent.getAttribute("cy") ?? 0) / EMU_PER_PX,
  };
}

function parseText(shape: Element): string {
  const paragraphs = descendants(shape, "p");
  return paragraphs
    .map((paragraph) =>
      descendants(paragraph, "t")
        .map((text) => text.textContent ?? "")
        .join(""),
    )
    .filter((line, index, all) => line.length > 0 || index < all.length - 1)
    .join("\n")
    .trim();
}

function parseFontSize(shape: Element): number {
  const runProperties = descendants(shape, "rPr").concat(descendants(shape, "defRPr"));
  for (const properties of runProperties) {
    const size = Number(properties.getAttribute("sz") ?? 0);
    if (size > 0) return Math.max(8, size / 100);
  }
  return 18;
}

function parseColor(shape: Element): string {
  const solidFill = firstDescendant(shape, "solidFill");
  const srgb = solidFill ? firstDescendant(solidFill, "srgbClr") : null;
  const value = srgb?.getAttribute("val");
  return value && /^[0-9a-f]{6}$/i.test(value) ? `#${value}` : "#1b1f24";
}

function parseBold(shape: Element): boolean {
  return descendants(shape, "rPr").some((item) => item.getAttribute("b") === "1");
}

function parseAlign(shape: Element): "left" | "center" | "right" {
  const paragraph = firstDescendant(shape, "pPr");
  const value = paragraph?.getAttribute("algn");
  if (value === "ctr") return "center";
  if (value === "r") return "right";
  return "left";
}

function normalizeZipPath(path: string): string {
  const segments: string[] = [];
  for (const segment of path.split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") segments.pop();
    else segments.push(segment);
  }
  return segments.join("/");
}

function mimeForImage(path: string): string {
  const extension = path.split(".").pop()?.toLowerCase();
  switch (extension) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
}

function parseRelationships(xml: string | undefined): Map<string, string> {
  const relationships = new Map<string, string>();
  if (!xml) return relationships;
  const document = parseXml(xml);
  for (const relation of descendants(document.documentElement, "Relationship")) {
    const id = relation.getAttribute("Id");
    const target = relation.getAttribute("Target");
    if (id && target) relationships.set(id, target);
  }
  return relationships;
}

function slideNumber(path: string): number {
  return Number(/slide(\d+)\.xml$/i.exec(path)?.[1] ?? 0);
}

export function parsePptx(arrayBuffer: ArrayBuffer): PptxDocument {
  const files = unzipSync(new Uint8Array(arrayBuffer));
  const warnings: string[] = [];
  let slideWidth = DEFAULT_SLIDE_WIDTH;
  let slideHeight = DEFAULT_SLIDE_HEIGHT;

  const presentationBytes = files["ppt/presentation.xml"];
  if (presentationBytes) {
    const presentation = parseXml(strFromU8(presentationBytes));
    const size = firstDescendant(presentation.documentElement, "sldSz");
    if (size) {
      const cx = Number(size.getAttribute("cx") ?? 0);
      const cy = Number(size.getAttribute("cy") ?? 0);
      if (cx > 0 && cy > 0) {
        slideWidth = cx / EMU_PER_PX;
        slideHeight = cy / EMU_PER_PX;
      }
    }
  }

  const slidePaths = Object.keys(files)
    .filter((path) => /^ppt\/slides\/slide\d+\.xml$/i.test(path))
    .sort((a, b) => slideNumber(a) - slideNumber(b));
  if (slidePaths.length === 0) throw new Error("PPTX 中没有可读取的幻灯片");

  const slides = slidePaths.map((slidePath): PptxSlide => {
    const number = slideNumber(slidePath);
    const document = parseXml(strFromU8(files[slidePath]!));
    const relationshipPath = `ppt/slides/_rels/slide${number}.xml.rels`;
    const relationships = parseRelationships(
      files[relationshipPath] ? strFromU8(files[relationshipPath]!) : undefined,
    );
    const elements: PptxElement[] = [];
    let unsupportedGraphicFrames = 0;

    for (const shape of descendants(document.documentElement, "sp")) {
      const box = readBox(shape);
      const text = parseText(shape);
      if (!text) continue;
      elements.push({
        kind: "text",
        x: box?.x ?? 24,
        y: box?.y ?? 24,
        width: box?.width ?? slideWidth - 48,
        height: box?.height ?? 80,
        text,
        fontSize: parseFontSize(shape),
        color: parseColor(shape),
        bold: parseBold(shape),
        align: parseAlign(shape),
      });
    }

    for (const picture of descendants(document.documentElement, "pic")) {
      const box = readBox(picture);
      const blip = firstDescendant(picture, "blip");
      const embed =
        blip?.getAttribute("r:embed") ??
        blip?.getAttributeNS(
          "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
          "embed",
        );
      const target = embed ? relationships.get(embed) : null;
      if (!target) {
        unsupportedGraphicFrames += 1;
        continue;
      }
      const imagePath = normalizeZipPath(`ppt/slides/${target}`);
      const bytes = files[imagePath];
      if (!bytes) {
        unsupportedGraphicFrames += 1;
        continue;
      }
      const url = URL.createObjectURL(new Blob([bytes], { type: mimeForImage(imagePath) }));
      elements.push({
        kind: "image",
        x: box?.x ?? 0,
        y: box?.y ?? 0,
        width: box?.width ?? slideWidth,
        height: box?.height ?? slideHeight,
        src: url,
        alt: target.split("/").pop() ?? "幻灯片图片",
      });
    }

    for (const graphicFrame of descendants(document.documentElement, "graphicFrame")) {
      const hasChart = Boolean(firstDescendant(graphicFrame, "chart"));
      const hasTable = Boolean(firstDescendant(graphicFrame, "tbl"));
      if (hasChart || hasTable) unsupportedGraphicFrames += 1;
    }

    if (unsupportedGraphicFrames > 0) {
      warnings.push(
        `第 ${number} 页有 ${unsupportedGraphicFrames} 个图表、表格或复杂对象未完整渲染`,
      );
    }

    return { number, width: slideWidth, height: slideHeight, elements };
  });

  return {
    width: slideWidth,
    height: slideHeight,
    slides,
    warnings: Array.from(new Set(warnings)),
  };
}

export function releasePptxDocument(documentModel: PptxDocument | null): void {
  if (!documentModel) return;
  for (const slide of documentModel.slides) {
    for (const element of slide.elements) {
      if (element.kind === "image") URL.revokeObjectURL(element.src);
    }
  }
}
