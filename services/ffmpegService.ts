// We use the global FFmpeg/FFmpegUtil loaded in index.html to bypass Vite's worker bundling 
// which often fails with COOP/COEP or 404s in this specific environment.
declare const FFmpeg: any;
declare const FFmpegUtil: any;

class FFmpegService {
  private ffmpeg: any = null;
  private loaded: boolean = false;

  public async load(onLog: (msg: string) => void): Promise<void> {
    if (this.loaded) return;

    if (typeof FFmpeg === 'undefined' || typeof FFmpegUtil === 'undefined') {
      throw new Error("Biblioteki FFmpeg nie zostały załadowane (błąd skryptu UMD).");
    }

    if (!window.crossOriginIsolated) {
      throw new Error(
        'Brak izolacji origin (Cross-Origin Isolated). ' +
        'Odśwież stronę. Wymagane nagłówki COOP/COEP.'
      );
    }

    // Create instance from global UMD
    this.ffmpeg = new FFmpeg.FFmpeg();

    this.ffmpeg.on('log', ({ message }: { message: string }) => {
      onLog(message);
    });

    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';

    try {
      // Manually load the core to ensure we use the remote version compatible with our headers
      await this.ffmpeg.load({
        coreURL: await FFmpegUtil.toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await FFmpegUtil.toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
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

    await this.ffmpeg.writeFile(inputName, await FFmpegUtil.fetchFile(file));

    this.ffmpeg.on('progress', ({ progress }: { progress: number }) => {
      onProgress(Math.round(progress * 100));
    });

    // Run conversion
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
