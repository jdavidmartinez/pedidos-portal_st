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
import { reportOperationalError } from "@/lib/observability/server";

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
      await reportOperationalError({ event: "blob.configuration_failed", operation: "blob.upload", dependency: "blob", status: 503, error: new Error("BlobNotConfigured"), route: "/api/admin/images" });
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
    const requestedFolder = formData.get("folder");
    const folder = requestedFolder === "campaigns" ? "campaigns" : "menu-products";
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

    const blob = await put(`${folder}/${safeMenuImageName(image.name)}`, image, {
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
      await reportOperationalError({ event: "auth.configuration_failed", operation: "blob.upload", dependency: "auth", status: 503, error, route: "/api/admin/images" });
      return Response.json(
        { error: error.message },
        { status: 503, headers: noStoreHeaders }
      );
    }

    await reportOperationalError({ event: "blob.upload_failed", operation: "blob.upload", dependency: "blob", status: 500, error, route: "/api/admin/images", requestId: request.headers.get("x-vercel-id") });
    return Response.json(
      { error: "No fue posible subir la imagen a Vercel Blob." },
      { status: 500, headers: noStoreHeaders }
    );
  }
}
