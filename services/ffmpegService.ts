import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

class FFmpegService {
  private ffmpeg: FFmpeg | null = null;
  private loaded: boolean = false;

  public async load(onLog: (msg: string) => void): Promise<void> {
    if (this.loaded) return;

    this.ffmpeg = new FFmpeg();

    this.ffmpeg.on('log', ({ message }) => {
      onLog(message);
    });

    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
    
    // Fix for "Failed to construct 'Worker'":
    // The default behavior tries to spawn a worker from esm.sh which is blocked by CORS/security policies.
    // We create a local blob acting as a proxy that imports the remote worker script.
    const workerBlob = new Blob(
      [`import "https://esm.sh/@ffmpeg/ffmpeg@0.12.15/es2022/worker.js";`], 
      { type: 'application/javascript' }
    );
    const workerURL = URL.createObjectURL(workerBlob);

    // Load ffmpeg.wasm with explicit workerURL
    await this.ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      workerURL: workerURL,
    });

    this.loaded = true;
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
    // Instagram recommended: H.264 video, AAC audio
    // Preset ultrafast for browser speed, crf 23 for decent quality
    await this.ffmpeg.exec([
      '-i', inputName,
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-crf', '23',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart', // Important for web playback
      outputName
    ]);

    // Read result
    const data = await this.ffmpeg.readFile(outputName);
    
    // Cleanup
    await this.ffmpeg.deleteFile(inputName);
    await this.ffmpeg.deleteFile(outputName);

    return new Blob([data], { type: 'video/mp4' });
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