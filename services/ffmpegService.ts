class FFmpegService {
  private ffmpeg: any = null;
  private loaded: boolean = false;
  private FFmpegClass: any = null;
  private fetchFile: any = null;
  private toBlobURL: any = null;

  public async load(onLog: (msg: string) => void): Promise<void> {
    if (this.loaded) return;

    if (!window.crossOriginIsolated) {
      throw new Error(
        'Brak izolacji origin (Cross-Origin Isolated). ' +
        'Odśwież stronę. Wymagane nagłówki COOP/COEP.'
      );
    }

    try {
      // Dynamic import using full URLs to bypass Vite's bundler and use browser native loading
      // @ts-ignore
      const ffmpegModule = await import('https://esm.sh/@ffmpeg/ffmpeg@0.12.10');
      // @ts-ignore
      const utilModule = await import('https://esm.sh/@ffmpeg/util@0.12.1');

      this.FFmpegClass = ffmpegModule.FFmpeg;
      this.fetchFile = utilModule.fetchFile;
      this.toBlobURL = utilModule.toBlobURL;

      this.ffmpeg = new this.FFmpegClass();

      this.ffmpeg.on('log', ({ message }: { message: string }) => {
        onLog(message);
      });

      // Use jsDelivr for core/wasm as it correctly sets Cross-Origin-Resource-Policy header
      // which is required when COOP/COEP is active
      const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm';
      
      onLog("Pobieranie bibliotek FFmpeg...");

      await this.ffmpeg.load({
        coreURL: await this.toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await this.toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });

      this.loaded = true;
    } catch (error: any) {
      console.error("FFmpeg load error:", error);
      throw new Error(`Nie udało się załadować FFmpeg: ${error.message}. Sprawdź konsolę.`);
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

    await this.ffmpeg.writeFile(inputName, await this.fetchFile(file));

    this.ffmpeg.on('progress', ({ progress }: { progress: number }) => {
      onProgress(Math.round(progress * 100));
    });

    // Run conversion: WebM -> MP4 (H.264/AAC)
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
