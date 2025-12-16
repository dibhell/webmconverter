// Declare globals provided by the UMD scripts in index.html
declare const FFmpeg: { FFmpeg: new () => any };
declare const FFmpegUtil: { fetchFile: (file: File) => Promise<Uint8Array>, toBlobURL: (url: string, type: string) => Promise<string> };

class FFmpegService {
  private ffmpeg: any = null;
  private loaded: boolean = false;

  private async waitForGlobals(): Promise<void> {
    const maxRetries = 20;
    let attempts = 0;

    while (attempts < maxRetries) {
      if (typeof FFmpeg !== 'undefined' && typeof FFmpegUtil !== 'undefined') {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 200));
      attempts++;
    }
    throw new Error('Timeout waiting for FFmpeg libraries to load.');
  }

  public async load(onLog: (msg: string) => void): Promise<void> {
    if (this.loaded) return;

    if (!window.crossOriginIsolated) {
      throw new Error(
        'Brak izolacji origin (Cross-Origin Isolated). ' +
        'Odśwież stronę. Wymagane nagłówki COOP/COEP.'
      );
    }

    try {
      onLog("Inicjalizacja bibliotek...");
      await this.waitForGlobals();

      // Access the class from the global object
      const { FFmpeg: FFmpegClass } = FFmpeg;
      const { toBlobURL } = FFmpegUtil;

      this.ffmpeg = new FFmpegClass();

      this.ffmpeg.on('log', ({ message }: { message: string }) => {
        onLog(message);
      });

      // Use jsDelivr for core/wasm to ensure Cross-Origin-Resource-Policy header
      const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm';
      
      onLog("Pobieranie silnika FFmpeg (WASM)...");

      await this.ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
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

    const { fetchFile } = FFmpegUtil;

    const inputName = 'input.webm';
    const outputName = 'output.mp4';

    await this.ffmpeg.writeFile(inputName, await fetchFile(file));

    this.ffmpeg.on('progress', ({ progress }: { progress: number }) => {
      onProgress(Math.round(progress * 100));
    });

    // Run conversion: WebM -> MP4 (H.264/AAC)
    // Using ultrafast preset for speed in browser
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

    const data = await this.ffmpeg.readFile(outputName);
    
    await this.ffmpeg.deleteFile(inputName);
    await this.ffmpeg.deleteFile(outputName);

    return new Blob([data.buffer], { type: 'video/mp4' });
  }

  public isLoaded(): boolean {
    return this.loaded;
  }
}

export const ffmpegService = new FFmpegService();
