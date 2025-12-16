import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

class FFmpegService {
  private ffmpeg: FFmpeg | null = null;
  private loaded: boolean = false;

  public async load(onLog: (msg: string) => void): Promise<void> {
    if (this.loaded) return;

    // Check for SharedArrayBuffer support (required for ffmpeg-core)
    if (!window.crossOriginIsolated) {
      throw new Error(
        'Brak izolacji origin (Cross-Origin Isolated). ' +
        'Odśwież stronę. Jeśli problem nadal występuje, przeglądarka może nie wspierać tej funkcji.'
      );
    }

    this.ffmpeg = new FFmpeg();

    this.ffmpeg.on('log', ({ message }) => {
      onLog(message);
    });

    // Use specific compatible versions from unpkg (ESM build works best with Blobs)
    const coreVersion = '0.12.6'; 
    const baseURL = `https://unpkg.com/@ffmpeg/core@${coreVersion}/dist/esm`;

    try {
      await this.ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        // In 0.12.x ESM builds, we typically don't need a separate workerURL 
        // if we provide the coreURL as a blob, the library handles it.
      });

      this.loaded = true;
    } catch (error: any) {
      console.error("FFmpeg load error:", error);
      throw new Error(`Nie udało się załadować FFmpeg: ${error.message}`);
    }
  }

  public async convertWebMToMp4(
    file: File, 
    onProgress: (progress: number) => void
  ): Promise<Blob> {
    if (!this.ffmpeg || !this.loaded) {
      throw new Error('FFmpeg not loaded');
    }

    const inputName = 'input.webm';
    const outputName = 'output.mp4';

    // Write file to virtual FS
    await this.ffmpeg.writeFile(inputName, await fetchFile(file));

    // FFmpeg progress monitoring
    this.ffmpeg.on('progress', ({ progress }) => {
      onProgress(Math.round(progress * 100));
    });

    // Run conversion command
    // Instagram recommended: H.264 video, AAC audio, MP4 container
    // Preset ultrafast for browser speed
    // pix_fmt yuv420p is required for broad compatibility
    await this.ffmpeg.exec([
      '-i', inputName,
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-crf', '23',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-pix_fmt', 'yuv420p', 
      '-movflags', '+faststart',
      outputName
    ]);

    // Read result
    const data = await this.ffmpeg.readFile(outputName);
    
    // Cleanup
    await this.ffmpeg.deleteFile(inputName);
    await this.ffmpeg.deleteFile(outputName);

    // Cast to any to avoid TypeScript error with BlobPart
    return new Blob([data as any], { type: 'video/mp4' });
  }

  public isLoaded(): boolean {
    return this.loaded;
  }
}

// Helper to fetch file data
const fetchFile = async (file: File): Promise<Uint8Array> => {
  return new Uint8Array(await file.arrayBuffer());
};

export const ffmpegService = new FFmpegService();