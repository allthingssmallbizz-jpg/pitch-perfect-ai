// Shared between the upload route and the bio page's uploader so the limit can't drift.
export const MAX_PRESENTER_PHOTOS = 3;

// Stored as slide_media.prompt when a presenter photo is placed on a slide, so the slide preview
// can tell a member's own photo apart from an AI-generated image (no "regenerate" for a photo).
export const PRESENTER_PHOTO_LABEL = "Presenter photo";
