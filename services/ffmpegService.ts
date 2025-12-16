class FFmpegService {
  private ffmpeg: any = null;
  private loaded: boolean = false;

  /**
   * Dynamically load a script and wait for it to execute.
   */
  private loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if already exists
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.crossOrigin = 'anonymous'; // Ensure CORS for CDN
      
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      
      document.head.appendChild(script);
    });
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
      onLog("Pobieranie bibliotek (UMD)...");
      
      // Load FFmpeg UMD scripts sequentially to ensure dependencies
      // Using specific versions from jsDelivr which supports CORP
      await this.loadScript('https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/umd/ffmpeg.min.js');
      await this.loadScript('https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/umd/index.min.js');

      // Access globals safely
      // @ts-ignore
      const FFmpegGlobal = window.FFmpeg;
      // @ts-ignore
      const FFmpegUtilGlobal = window.FFmpegUtil;

      if (!FFmpegGlobal || !FFmpegUtilGlobal) {
        throw new Error("Biblioteki pobrane, ale obiekty globalne (FFmpeg/FFmpegUtil) nie istnieją.");
      }

      onLog("Inicjalizacja silnika...");

      // Handle UMD export variations (sometimes it's .FFmpeg, sometimes it's the object itself)
      const FFmpegClass = FFmpegGlobal.FFmpeg || FFmpegGlobal;
      const { toBlobURL, fetchFile } = FFmpegUtilGlobal;

      this.ffmpeg = new FFmpegClass();

      this.ffmpeg.on('log', ({ message }: { message: string }) => {
        onLog(message);
      });

      const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm';
      
      onLog("Ładowanie rdzenia WebAssembly...");

      // Load the core via blob URLs to bypass strict origin checks on workers
      await this.ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
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
    if (!this.ffmpeg || !this.loaded) {
      throw new Error('FFmpeg not loaded');
    }

    // @ts-ignore
    const { fetchFile } = window.FFmpegUtil;

    const inputName = 'input.webm';
    const outputName = 'output.mp4';

    await this.ffmpeg.writeFile(inputName, await fetchFile(file));

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
