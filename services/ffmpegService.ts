import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { VideoQualityPreset } from '../types';

const clampNumber = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const resolveTimeSeconds = (time: number, durationSeconds: number): number | null => {
  if (!Number.isFinite(time) || time <= 0) return null;

  const maxFactor = 1.2;
  if (time <= durationSeconds * maxFactor) return time;
  if (time <= durationSeconds * 1000 * maxFactor) return time / 1000;
  if (time <= durationSeconds * 1000000 * maxFactor) return time / 1000000;

  return null;
};

const resolvePercentFromTime = (time: number, durationSeconds: number): number | null => {
  const seconds = resolveTimeSeconds(time, durationSeconds);
  if (seconds === null) return null;
  return (seconds / durationSeconds) * 100;
};

const resolvePercentFromRatio = (ratio: number): number | null => {
  if (!Number.isFinite(ratio) || ratio < 0 || ratio > 1) return null;
  return ratio * 100;
};

const parseLogTime = (message: string): number | null => {
  const match = /time=(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(message);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);

  if (![hours, minutes, seconds].every((value) => Number.isFinite(value))) return null;

  return hours * 3600 + minutes * 60 + seconds;
};

const parseLogDuration = (message: string): number | null => {
  const match = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(message);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);

  if (![hours, minutes, seconds].every((value) => Number.isFinite(value))) return null;

  return hours * 3600 + minutes * 60 + seconds;
};

const QUALITY_PRESETS: Record<VideoQualityPreset, { crf: string; preset: string; targetBitrate: number }> = {
  high: { crf: '18', preset: 'veryfast', targetBitrate: 50_000_000 },
  mid: { crf: '22', preset: 'veryfast', targetBitrate: 25_000_000 },
  low: { crf: '26', preset: 'faster', targetBitrate: 16_000_000 },
};

const toKbps = (value: number) => `${Math.max(1, Math.round(value / 1000))}k`;

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
      const FFMPEG_VERSION = '0.12.15';

      onLog("Przygotowanie Workera...");

      // TWORZENIE WORKERA (Rozwiązanie problemu CORS i Builda):
      // 1. Nie importujemy URL w TypeScript (psuje build).
      // 2. Tworzymy Blob z kodem JS, który importuje workera z esm.sh.
      // 3. esm.sh rozwiązuje zależności i nagłówki CORS.
      const workerCode = `import "https://esm.sh/@ffmpeg/ffmpeg@${FFMPEG_VERSION}/dist/esm/worker.js";`;
      const workerBlob = new Blob([workerCode], { type: 'text/javascript' });
      const classWorkerURL = URL.createObjectURL(workerBlob);

      onLog("Pobieranie WebAssembly (ok. 30MB)...");

      await this.ffmpeg.load({
        classWorkerURL,
        coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm'),
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
    onProgress: (progress: number) => void,
    durationSeconds?: number,
    qualityPreset: VideoQualityPreset = 'high'
  ): Promise<Blob> {
    if (!this.ffmpeg || !this.loaded) {
      throw new Error('FFmpeg nie jest załadowany. Odśwież stronę.');
    }

    const inputName = 'input.webm';
    const outputName = 'output.mp4';
    const normalizedDuration = typeof durationSeconds === 'number' && Number.isFinite(durationSeconds) && durationSeconds > 0
      ? durationSeconds
      : null;
    let resolvedDurationSeconds = normalizedDuration;
    let lastPercent = 0;

    // Zapis pliku do wirtualnego systemu plików WASM
    await this.ffmpeg.writeFile(inputName, await fetchFile(file));

    const updateProgress = (nextPercent: number | null) => {
      if (nextPercent === null) return;

      const clamped = clampNumber(Math.round(nextPercent), 0, 100);
      if (clamped <= lastPercent) return;

      lastPercent = clamped;
      onProgress(lastPercent);
    };

    const progressHandler = ({ progress, time }: { progress: number; time: number }) => {
      const percentFromTime = resolvedDurationSeconds
        ? resolvePercentFromTime(time, resolvedDurationSeconds)
        : null;
      const percentFromRatio = resolvePercentFromRatio(progress);
      updateProgress(percentFromTime ?? percentFromRatio);
    };

    const logHandler = ({ message }: { message: string }) => {
      if (!resolvedDurationSeconds) {
        const durationFromLog = parseLogDuration(message);
        if (durationFromLog) {
          resolvedDurationSeconds = durationFromLog;
        }
      }
      const seconds = parseLogTime(message);
      if (seconds === null || !resolvedDurationSeconds) return;
      updateProgress(resolvePercentFromTime(seconds, resolvedDurationSeconds));
    };

    this.ffmpeg.on('progress', progressHandler);
    this.ffmpeg.on('log', logHandler);

    const presetConfig = QUALITY_PRESETS[qualityPreset] ?? QUALITY_PRESETS.high;
    const targetVideoBitrate = presetConfig.targetBitrate;
    const maxVideoBitrate = Math.round(targetVideoBitrate * 1.15);
    const bufferSize = Math.round(targetVideoBitrate * 2);

    // Konwersja: WebM -> MP4 (H.264/AAC) - standard Instagrama
    // Używamy presetu zależnie od wybranego profilu jakości
    try {
      const args = [
        '-i', inputName,
        '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
        '-r', '30',
        '-vsync', 'cfr',
        '-c:v', 'libx264',
        '-profile:v', 'high',
        '-level', '4.1',
        '-preset', presetConfig.preset,
        '-b:v', toKbps(targetVideoBitrate),
        '-maxrate', toKbps(maxVideoBitrate),
        '-bufsize', toKbps(bufferSize),
        '-c:a', 'aac',
        '-b:a', '192k',
        '-ar', '48000',
        '-ac', '2',
        '-pix_fmt', 'yuv420p', // Wymagane dla kompatybilno?ci z odtwarzaczami mobilnymi
        '-movflags', '+faststart',
        outputName
      ];
      await this.ffmpeg.exec(args);
    } finally {
      this.ffmpeg.off('progress', progressHandler);
      this.ffmpeg.off('log', logHandler);
    }

    // Odczyt wyniku
    const data = await this.ffmpeg.readFile(outputName);
    
    // Sprzątanie
    await this.ffmpeg.deleteFile(inputName);
    await this.ffmpeg.deleteFile(outputName);

    onProgress(100);
    return new Blob([data.buffer], { type: 'video/mp4' });
  }

  public isLoaded(): boolean {
    return this.loaded;
  }
}

export const ffmpegService = new FFmpegService();
