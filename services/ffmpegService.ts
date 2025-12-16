class FFmpegService {
  private ffmpeg: any = null;
  private loaded: boolean = false;
  private fetchFile: any = null;

  public async load(onLog: (msg: string) => void): Promise<void> {
    if (this.loaded) return;

    if (!window.crossOriginIsolated) {
      throw new Error(
        'Brak izolacji origin (Cross-Origin Isolated). ' +
        'Wymagane nagłówki COOP/COEP. Upewnij się, że używasz HTTPS lub localhost.'
      );
    }

    try {
      onLog("Pobieranie modułów FFmpeg (ESM/esm.sh)...");
      
      // We use esm.sh because it resolves internal dependencies (like @ffmpeg/util)
      // to absolute URLs, preventing "bare import" errors in the browser.
      const FFmpegImport = await import("https://esm.sh/@ffmpeg/ffmpeg@0.12.10");
      const { toBlobURL, fetchFile } = await import("https://esm.sh/@ffmpeg/util@0.12.1");

      const FFmpeg = FFmpegImport.FFmpeg;
      this.fetchFile = fetchFile;

      onLog("Inicjalizacja silnika...");
      this.ffmpeg = new FFmpeg();

      this.ffmpeg.on('log', ({ message }: { message: string }) => {
        onLog(message);
      });

      const CORE_BASE = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
      
      onLog("Konfigurowanie workera...");

      // WORKER STRATEGY:
      // 1. Create a local Blob for the worker (satisfies "same-origin" policy for new Worker()).
      // 2. Inside the Blob, import the worker logic from esm.sh (satisfies dependency resolution).
      // 3. esm.sh handles the cross-origin imports correctly via CORS headers.
      const workerBlob = new Blob(
        [`import "https://esm.sh/@ffmpeg/ffmpeg@0.12.10/dist/esm/worker.js";`],
        { type: 'text/javascript' }
      );
      const workerURL = URL.createObjectURL(workerBlob);

      onLog("Ładowanie rdzenia WebAssembly...");

      await this.ffmpeg.load({
        coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm'),
        workerURL: workerURL,
      });

      this.loaded = true;
    } catch (error: any) {
      console.error("FFmpeg load error:", error);
      throw new Error(`Błąd inicjalizacji FFmpeg: ${error.message}`);
    }
  }

  public async convertWebMToMp4(
    file: File, 
    onProgress: (progress: number) => void
  ): Promise<Blob> {
    if (!this.ffmpeg || !this.loaded || !this.fetchFile) {
      throw new Error('FFmpeg not loaded');
    }

    const inputName = 'input.webm';
    const outputName = 'output.mp4';

    await this.ffmpeg.writeFile(inputName, await this.fetchFile(file));

    this.ffmpeg.on('progress', ({ progress }: { progress: number }) => {
      onProgress(Math.round(progress * 100));
    });

    // Run conversion: WebM -> MP4 (H.264/AAC) for Instagram compatibility
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
