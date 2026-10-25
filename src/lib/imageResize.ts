// Phone photos are routinely 3-8MB, above the hosting platform's ~4.5MB request-body limit and
// far bigger than a slide needs. Re-encoding through a canvas at 1600px max keeps uploads well
// under that and keeps the exported .pptx small. Browser-only.
export async function downsizeToJpeg(file: File, maxDim = 1600): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not process that image."))), "image/jpeg", 0.85)
  );
}
