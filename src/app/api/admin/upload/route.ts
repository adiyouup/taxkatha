import { AuthError, authorize } from "@/server/auth/dal";
import { storeImage, UploadError } from "@/server/storage";

/** Image upload for the Insights editor. Administrators only. */
export async function POST(request: Request) {
  try {
    await authorize("admin");
  } catch (error) {
    if (error instanceof AuthError) return Response.json({ error: "Not allowed." }, { status: error.code === "unauthenticated" ? 401 : 403 });
    throw error;
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Choose an image to upload." }, { status: 400 });

  try {
    return Response.json(await storeImage(file, "insights"));
  } catch (error) {
    if (error instanceof UploadError) return Response.json({ error: error.message }, { status: 400 });
    console.error("upload failed", error);
    return Response.json({ error: "The image could not be saved. Please try again." }, { status: 500 });
  }
}
