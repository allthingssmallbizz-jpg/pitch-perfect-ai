"use client";

// Client-side screenshot compression for the social media comparison tool's upload path
// (src/app/(app)/social-compare/SocialCompareClient.tsx). A raw phone screenshot can easily be
// several MB; sending a few of those as base64 in a single POST body risks tripping Vercel's
// request body size limit. Downscaling to a sane max dimension and re-encoding as JPEG keeps
// each image comfortably small while preserving everything Claude actually needs to read
// (layout, thumbnails, text) — full source resolution buys nothing here.

const MAX_DIMENSION = 1280;
const JPEG_QUALITY = 0.82;

export async function compressImageFile(file: File): Promise<{ base64: string; mediaType: "image/jpeg" }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't process that image.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
  if (!blob) throw new Error("Couldn't process that image.");

  const buffer = await blob.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);

  return { base64, mediaType: "image/jpeg" };
}
