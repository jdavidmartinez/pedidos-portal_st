export const MAX_MENU_IMAGE_BYTES = 4 * 1024 * 1024;

export const ALLOWED_MENU_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export function validateMenuImage(file: { size: number; type: string }) {
  if (!ALLOWED_MENU_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_MENU_IMAGE_TYPES)[number])) {
    return "La imagen debe ser JPEG, PNG o WebP.";
  }

  if (file.size <= 0) {
    return "El archivo de imagen está vacío.";
  }

  if (file.size > MAX_MENU_IMAGE_BYTES) {
    return "La imagen no puede superar 4 MB.";
  }

  return null;
}

export function safeMenuImageName(filename: string) {
  const extension = filename.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const base = filename
    .replace(/\.[^.]+$/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "producto";

  return `${base}.${extension}`;
}
