import { put } from "@vercel/blob";
import {
  getKitchenSession,
  hasRole,
  KitchenAuthConfigError,
} from "@/lib/auth/kitchen-auth";
import {
  MAX_MENU_IMAGE_BYTES,
  safeMenuImageName,
  validateMenuImage,
} from "@/lib/menu/menu-image-upload";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const noStoreHeaders = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  try {
    if (!hasRole(await getKitchenSession(), ["admin"])) {
      return Response.json(
        { error: "Necesitas permisos de administrador para subir imágenes." },
        { status: 403, headers: noStoreHeaders }
      );
    }

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return Response.json(
        { error: "Vercel Blob todavía no está configurado en este entorno." },
        { status: 503, headers: noStoreHeaders }
      );
    }

    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > MAX_MENU_IMAGE_BYTES + 100_000) {
      return Response.json(
        { error: "La imagen no puede superar 4 MB." },
        { status: 413, headers: noStoreHeaders }
      );
    }

    const formData = await request.formData();
    const image = formData.get("image");
    if (!(image instanceof File)) {
      return Response.json(
        { error: "Selecciona una imagen para subir." },
        { status: 400, headers: noStoreHeaders }
      );
    }

    const validationError = validateMenuImage(image);
    if (validationError) {
      return Response.json(
        { error: validationError },
        { status: image.size > MAX_MENU_IMAGE_BYTES ? 413 : 400, headers: noStoreHeaders }
      );
    }

    const blob = await put(`menu-products/${safeMenuImageName(image.name)}`, image, {
      access: "public",
      addRandomSuffix: true,
      contentType: image.type,
    });

    return Response.json(
      { url: blob.url, pathname: blob.pathname },
      { status: 201, headers: noStoreHeaders }
    );
  } catch (error) {
    if (error instanceof KitchenAuthConfigError) {
      return Response.json(
        { error: error.message },
        { status: 503, headers: noStoreHeaders }
      );
    }

    console.error("[admin-images] No fue posible subir la imagen:", error);
    return Response.json(
      { error: "No fue posible subir la imagen a Vercel Blob." },
      { status: 500, headers: noStoreHeaders }
    );
  }
}
