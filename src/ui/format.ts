export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes)) return "大小未知";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
}

export function percent(loaded: number, total: number | null): number | null {
  if (!total || total <= 0) return null;
  return Math.min(100, Math.max(0, Math.round((loaded / total) * 100)));
}

export function resourceKindLabel(kind: string): string {
  switch (kind) {
    case "pdf":
      return "PDF";
    case "presentation":
      return "PPT";
    case "document":
      return "DOC";
    case "image":
      return "IMG";
    case "video":
      return "VID";
    case "archive":
      return "ZIP";
    case "exercise":
      return "作业";
    default:
      return "文件";
  }
}
