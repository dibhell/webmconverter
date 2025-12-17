import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

class FFmpegService {
  private ffmpeg: any = null;
  private loaded: boolean = false;

  public async load(onLog: (msg: string) => void): Promise<void> {
    if (this.loaded) return;

    // Sprawdzenie izolacji (SharedArrayBuffer)
    if (!window.crossOriginIsolated) {
      throw new Error(
        'Brak izolacji origin (Cross-Origin Isolated). ' +
        'Aplikacja wymaga nagłówków COOP/COEP. Odśwież stronę (automatyczny reload powinien zadziałać).'
      );
    }

    try {
      onLog("Konfiguracja środowiska FFmpeg...");

      this.ffmpeg = new FFmpeg();

      this.ffmpeg.on('log', ({ message }: { message: string }) => {
        onLog(message);
      });

      // Wersje bibliotek na CDN (zgodne ze sobą)
      // Core 0.12.6 jest stabilny dla FFmpeg 0.12.x
      const CORE_BASE = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
      const FFMPEG_VERSION = '0.12.10';

      onLog("Przygotowanie Workera...");

      // TWORZENIE WORKERA (Rozwiązanie problemu CORS i Builda):
      // 1. Nie importujemy URL w TypeScript (psuje build).
      // 2. Tworzymy Blob z kodem JS, który importuje workera z esm.sh.
      // 3. esm.sh rozwiązuje zależności i nagłówki CORS.
      const workerCode = `import "https://esm.sh/@ffmpeg/ffmpeg@${FFMPEG_VERSION}/dist/esm/worker.js";`;
      const workerBlob = new Blob([workerCode], { type: 'text/javascript' });
      const workerURL = URL.createObjectURL(workerBlob);

      onLog("Pobieranie WebAssembly (ok. 30MB)...");

      await this.ffmpeg.load({
        coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm'),
        workerURL: workerURL,
      });

      this.loaded = true;
      onLog("FFmpeg załadowany pomyślnie.");
    } catch (error: any) {
      console.error("FFmpeg load error:", error);
      // Bardziej przyjazny komunikat błędu
      const msg = error.message.includes("Failed to construct 'Worker'") 
        ? "Błąd tworzenia Workera. Twoja przeglądarka może blokować skrypty z CDN."
        : error.message;
      throw new Error(msg);
    }
  }

  public async convertWebMToMp4(
    file: File, 
    onProgress: (progress: number) => void
  ): Promise<Blob> {
    if (!this.ffmpeg || !this.loaded) {
      throw new Error('FFmpeg nie jest załadowany. Odśwież stronę.');
    }

    const inputName = 'input.webm';
    const outputName = 'output.mp4';

    // Zapis pliku do wirtualnego systemu plików WASM
    await this.ffmpeg.writeFile(inputName, await fetchFile(file));

    this.ffmpeg.on('progress', ({ progress }: { progress: number }) => {
      // Progress w FFmpeg 0.12 jest od 0 do 1
      onProgress(Math.min(100, Math.round(progress * 100)));
    });

    // Konwersja: WebM -> MP4 (H.264/AAC) - standard Instagrama
    // Używamy presetu 'ultrafast' dla szybkości w przeglądarce
    await this.ffmpeg.exec([
      '-i', inputName,
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-crf', '23',       // Balans jakość/rozmiar
      '-c:a', 'aac',
      '-b:a', '128k',
      '-pix_fmt', 'yuv420p', // Wymagane dla kompatybilności z odtwarzaczami mobilnymi
      '-movflags', '+faststart',
      outputName
    ]);

    // Odczyt wyniku
    const data = await this.ffmpeg.readFile(outputName);
    
    // Sprzątanie
    await this.ffmpeg.deleteFile(inputName);
    await this.ffmpeg.deleteFile(outputName);

    return new Blob([data.buffer], { type: 'video/mp4' });
  }

  public isLoaded(): boolean {
    return this.loaded;
  }
}

export const ffmpegService = new FFmpegService();
