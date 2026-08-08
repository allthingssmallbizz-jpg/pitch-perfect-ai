import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

export function getVideoDurationSeconds(inputPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, data) => {
      if (err) return reject(err);
      resolve(data.format.duration ?? 0);
    });
  });
}

// Extracts the audio track as mono 64kbps — small enough that a long recording still fits
// comfortably under Whisper's 25MB-per-request limit once chunked (see transcription.ts).
export function extractAudio(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .noVideo()
      .audioChannels(1)
      .audioBitrate("64k")
      .format("mp3")
      .on("end", () => resolve())
      .on("error", (err: Error) => reject(err))
      .save(outputPath);
  });
}

// Splits an audio file into fixed-length chunks so each one stays under Whisper's request
// size/duration limits. Returns the chunk file paths in order.
export async function chunkAudio(
  inputPath: string,
  outputDir: string,
  chunkSeconds: number
): Promise<string[]> {
  const pattern = `${outputDir}/chunk_%03d.mp3`;
  await new Promise<void>((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions(["-f segment", `-segment_time ${chunkSeconds}`, "-c copy"])
      .on("end", () => resolve())
      .on("error", (err: Error) => reject(err))
      .save(pattern);
  });

  const fs = await import("node:fs/promises");
  const files = await fs.readdir(outputDir);
  return files
    .filter((f) => f.startsWith("chunk_") && f.endsWith(".mp3"))
    .sort()
    .map((f) => `${outputDir}/${f}`);
}

// Extracts one frame at each given timestamp (seconds) as a JPEG, for Annie's visual review
// (slide legibility, presenter framing/lighting) — a still-image proxy since Claude's API
// doesn't accept video directly.
export function extractFrameAt(inputPath: string, outputPath: string, timestampSeconds: number): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .screenshots({
        timestamps: [timestampSeconds],
        filename: outputPath.split("/").pop(),
        folder: outputPath.substring(0, outputPath.lastIndexOf("/")),
        size: "960x?",
      })
      .on("end", () => resolve())
      .on("error", (err: Error) => reject(err));
  });
}
