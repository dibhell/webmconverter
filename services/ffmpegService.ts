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
      onLog("Pobieranie modułów FFmpeg (ESM)...");
      
      const BASE_URL = 'https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/esm';
      const FFMPEG_URL = `${BASE_URL}/index.js`;
      const UTIL_URL = 'https://unpkg.com/@ffmpeg/util@0.12.1/dist/esm/index.js';
      
      const { FFmpeg } = await import(/* @vite-ignore */ FFMPEG_URL);
      const { toBlobURL, fetchFile } = await import(/* @vite-ignore */ UTIL_URL);

      this.fetchFile = fetchFile;

      onLog("Inicjalizacja silnika...");
      this.ffmpeg = new FFmpeg();

      this.ffmpeg.on('log', ({ message }: { message: string }) => {
        onLog(message);
      });

      const CORE_URL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
      
      onLog("Przygotowanie workera...");

      // MANUAL WORKER PATCHING
      // We fetch the worker script text and patch its imports to be absolute URLs.
      // This is necessary because loading a Worker from a cross-origin URL (CDN) is blocked,
      // and loading it from a Blob (local) breaks relative imports inside the worker script.
      const workerResponse = await fetch(`${BASE_URL}/worker.js`);
      let workerScript = await workerResponse.text();

      // Replace relative imports (e.g. from "./classes.js") with absolute CDN URLs
      workerScript = workerScript.replace(
        /from\s*['"]\.\/(.*?)['"]/g, 
        (match, file) => `from "${BASE_URL}/${file}"`
      );

      const workerBlob = new Blob([workerScript], { type: 'text/javascript' });
      const workerBlobURL = URL.createObjectURL(workerBlob);

      onLog("Ładowanie rdzenia WebAssembly...");

      // Load core scripts via Blob URLs to handle worker origin restrictions
      await this.ffmpeg.load({
        coreURL: await toBlobURL(`${CORE_URL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${CORE_URL}/ffmpeg-core.wasm`, 'application/wasm'),
        workerURL: workerBlobURL,
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
