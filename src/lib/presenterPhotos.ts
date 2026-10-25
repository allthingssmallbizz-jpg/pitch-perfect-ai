// Shared between the upload route and the bio page's uploader so the limit can't drift.
export const MAX_PRESENTER_PHOTOS = 3;

// Stored as slide_media.prompt when a presenter photo is placed on a slide, so the slide preview
// can tell a member's own photo apart from an AI-generated image (no "regenerate" for a photo).
export const PRESENTER_PHOTO_LABEL = "Presenter photo";
// Same idea for a stack item / bonus product image from Discovery — followed by the item's name.
export const OFFER_IMAGE_LABEL_PREFIX = "Product image: ";

export function isUploadedImageLabel(prompt: string | null | undefined): boolean {
  return prompt === PRESENTER_PHOTO_LABEL || Boolean(prompt?.startsWith(OFFER_IMAGE_LABEL_PREFIX));
}

// One pickable image in a deck's "Add image" menu — a presenter photo from the Bio, or a product
// image attached to a stack item/bonus in Discovery.
export type SlideImageChoice = { path: string; url: string | null; label: string };
