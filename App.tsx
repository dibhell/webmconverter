/// <reference lib="dom" />
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { ffmpegService } from './services/ffmpegService';
import FileUploader from './components/FileUploader';
import VideoPreview from './components/VideoPreview';
import { VideoFile, ConversionStatus, FileConversionStatus, VideoQualityPreset } from './types';
import { Download, RefreshCw, AlertCircle, ShieldAlert, Instagram, Trash2, ListChecks } from 'lucide-react';

type VideoItem = VideoFile & {
  id: string;
  status: FileConversionStatus;
  progress: number;
  outputUrl?: string | null;
  error?: string | null;
};

const QUALITY_OPTIONS: Array<{ value: VideoQualityPreset; label: string; description: string }> = [
  { value: 'high', label: 'High', description: 'Docelowo ok. 50 Mb/s (najlepsza jakosc).' },
  { value: 'mid', label: 'Mid', description: 'Docelowo ok. 25 Mb/s (balans jakosc/rozmiar).' },
  { value: 'low', label: 'Low', description: 'Docelowo ok. 16 Mb/s (mniejszy plik).' },
];

const STATUS_LABELS: Record<FileConversionStatus, string> = {
  idle: 'gotowy',
  queued: 'w kolejce',
  converting: 'konwertuje',
  completed: 'gotowe',
  error: 'blad',
};

const formatFileSize = (size: number) => `${(size / 1024 / 1024).toFixed(2)} MB`;
const clampProgress = (value: number) => Math.min(100, Math.max(0, Math.round(value)));
const fileKey = (file: File) => `${file.name}-${file.size}-${file.lastModified}`;
const createFileId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `file-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const App: React.FC = () => {
  const [ffmpegStatus, setFfmpegStatus] = useState<ConversionStatus>(ConversionStatus.IDLE);
  const [videoFiles, setVideoFiles] = useState<VideoItem[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<VideoQualityPreset>('high');
  const [logs, setLogs] = useState<string>('Oczekiwanie na inicjalizacje...');
  const [isSecure, setIsSecure] = useState(true);
  const [isBatchConverting, setIsBatchConverting] = useState(false);

  const videoFilesRef = useRef<VideoItem[]>([]);

  useEffect(() => {
    videoFilesRef.current = videoFiles;
  }, [videoFiles]);

  useEffect(() => {
    if (!window.isSecureContext) {
      setIsSecure(false);
      setFfmpegStatus(ConversionStatus.ERROR);
      setLogs(
        'BLAD KRYTYCZNY: Aplikacja wymaga bezpiecznego polaczenia (HTTPS) lub localhost do dzialania. Otworz strone przez https:// lub na localhost.'
      );
      return;
    }

    let mounted = true;
    let loaded = false;
    let timeoutId: number | undefined;

    const load = async () => {
      setFfmpegStatus(ConversionStatus.LOADING_FFMPEG);

      timeoutId = window.setTimeout(() => {
        if (!mounted || loaded) return;
        if (!window.crossOriginIsolated) {
          setLogs((prev) => prev + '\n\nProblem z naglowkami bezpieczenstwa. Sprobuj odswiezyc strone.');
        }
        setFfmpegStatus(ConversionStatus.ERROR);
      }, 10000);

      try {
        await ffmpegService.load((msg) => {
          if (mounted) setLogs((prev) => (prev + '\n' + msg).slice(-500));
        });
        if (!mounted) return;
        loaded = true;
        setFfmpegStatus(ConversionStatus.READY);
        setLogs('System gotowy. Przeslij pliki WebM.');
      } catch (e: any) {
        if (mounted) {
          console.error(e);
          setFfmpegStatus(ConversionStatus.ERROR);
          setLogs(`Blad ladowania FFmpeg: ${e.message}`);
        }
      } finally {
        if (timeoutId) window.clearTimeout(timeoutId);
      }
    };

    if (!window.crossOriginIsolated) {
      console.warn("Strona nie jest w trybie Cross-Origin Isolated.");
      setLogs('Konfiguracja trybu wysokiej wydajnosci (wymagane przeladowanie)...');
    }

    load();

    return () => {
      mounted = false;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    if (!videoFiles.length) {
      setActiveFileId(null);
      return;
    }
    if (!activeFileId || !videoFiles.some((item) => item.id === activeFileId)) {
      setActiveFileId(videoFiles[0].id);
    }
  }, [videoFiles, activeFileId]);

  useEffect(() => {
    return () => {
      videoFilesRef.current.forEach((item) => {
        if (item.url) URL.revokeObjectURL(item.url);
        if (item.outputUrl) URL.revokeObjectURL(item.outputUrl);
      });
    };
  }, []);

  const updateFile = useCallback((id: string, updates: Partial<VideoItem>) => {
    setVideoFiles((prev) => {
      let changed = false;
      const next = prev.map((item) => {
        if (item.id !== id) return item;
        changed = true;
        return { ...item, ...updates };
      });
      return changed ? next : prev;
    });
  }, []);

  const loadDurationForFile = useCallback(
    (id: string, url: string) =>
      new Promise<number | undefined>((resolve) => {
        const video = document.createElement('video');
        video.preload = 'metadata';

        const cleanup = () => {
          video.onloadedmetadata = null;
          video.onerror = null;
          video.removeAttribute('src');
          video.load();
        };

        video.onloadedmetadata = () => {
          const duration = video.duration;
          if (Number.isFinite(duration) && duration > 0) {
            updateFile(id, { durationSeconds: duration });
            resolve(duration);
          } else {
            resolve(undefined);
          }
          cleanup();
        };

        video.onerror = () => {
          cleanup();
          resolve(undefined);
        };

        video.src = url;
      }),
    [updateFile]
  );

  const handleFilesSelected = useCallback(
    (files: File[]) => {
      const existingKeys = new Set(videoFilesRef.current.map((item) => fileKey(item.file)));
      const newItems: VideoItem[] = [];

      files.forEach((file) => {
        const key = fileKey(file);
        if (existingKeys.has(key)) return;
        existingKeys.add(key);

        const url = URL.createObjectURL(file);
        newItems.push({
          id: createFileId(),
          file,
          url,
          name: file.name,
          size: file.size,
          durationSeconds: undefined,
          status: 'idle',
          progress: 0,
          outputUrl: null,
          error: null,
        });
      });

      if (!newItems.length) {
        setLogs('Brak nowych plikow do dodania.');
        return;
      }

      setVideoFiles((prev) => [...prev, ...newItems]);
      setActiveFileId((prev) => prev ?? newItems[0].id);
      newItems.forEach((item) => {
        void loadDurationForFile(item.id, item.url);
      });
      setLogs(`Dodano ${newItems.length} plikow.`);
    },
    [loadDurationForFile]
  );

  const handleInputDuration = useCallback(
    (durationSeconds: number) => {
      if (!activeFileId) return;
      updateFile(activeFileId, { durationSeconds });
    },
    [activeFileId, updateFile]
  );

  const runConversion = useCallback(
    async (fileId: string, preset: VideoQualityPreset) => {
      const target = videoFilesRef.current.find((item) => item.id === fileId);
      if (!target) return;

      if (target.outputUrl) {
        URL.revokeObjectURL(target.outputUrl);
      }

      updateFile(fileId, { status: 'converting', progress: 0, outputUrl: null, error: null });
      setLogs(`Konwersja: ${target.name}`);

      try {
        const resolvedDuration = target.durationSeconds ?? (await loadDurationForFile(target.id, target.url));
        const mp4Blob = await ffmpegService.convertWebMToMp4(
          target.file,
          (prog) => updateFile(fileId, { progress: clampProgress(prog) }),
          resolvedDuration,
          preset
        );

        const mp4Url = URL.createObjectURL(mp4Blob);
        updateFile(fileId, { status: 'completed', progress: 100, outputUrl: mp4Url });
        setLogs(`Konwersja zakonczona: ${target.name}`);
      } catch (e: any) {
        console.error(e);
        updateFile(fileId, { status: 'error', error: e.message || 'Blad konwersji' });
        setLogs(`Blad konwersji: ${target.name}`);
      }
    },
    [updateFile]
  );

  const handleConvert = async (fileId: string) => {
    if (ffmpegStatus !== ConversionStatus.READY) return;
    if (videoFilesRef.current.some((item) => item.status === 'converting')) return;

    await runConversion(fileId, selectedPreset);
  };

  const handleConvertAll = async () => {
    if (ffmpegStatus !== ConversionStatus.READY) return;
    if (videoFilesRef.current.some((item) => item.status === 'converting')) return;

    const pendingIds = videoFilesRef.current
      .filter((item) => item.status !== 'completed')
      .map((item) => item.id);

    if (!pendingIds.length) return;

    const preset = selectedPreset;

    setIsBatchConverting(true);
    setVideoFiles((prev) =>
      prev.map((item) =>
        pendingIds.includes(item.id)
          ? {
              ...item,
              status: item.status === 'completed' ? item.status : 'queued',
              progress: item.status === 'completed' ? item.progress : 0,
              error: null,
            }
          : item
      )
    );

    try {
      for (const id of pendingIds) {
        await runConversion(id, preset);
      }
    } finally {
      setIsBatchConverting(false);
    }
  };

  const handleRemoveFile = (fileId: string) => {
    const current = videoFilesRef.current;
    const target = current.find((item) => item.id === fileId);
    if (!target) return;

    if (target.url) URL.revokeObjectURL(target.url);
    if (target.outputUrl) URL.revokeObjectURL(target.outputUrl);

    const next = current.filter((item) => item.id !== fileId);
    setVideoFiles(next);
    setActiveFileId((prev) => (prev === fileId ? next[0]?.id ?? null : prev));
  };

  const handleClearAll = () => {
    videoFilesRef.current.forEach((item) => {
      if (item.url) URL.revokeObjectURL(item.url);
      if (item.outputUrl) URL.revokeObjectURL(item.outputUrl);
    });
    setVideoFiles([]);
    setActiveFileId(null);
    if (ffmpegStatus === ConversionStatus.READY) {
      setLogs('Gotowy do nastepnego zadania.');
    }
  };

  const isLoading = ffmpegStatus === ConversionStatus.LOADING_FFMPEG;
  const hasError = ffmpegStatus === ConversionStatus.ERROR;
  const isReady = ffmpegStatus === ConversionStatus.READY;
  const isConverting = videoFiles.some((item) => item.status === 'converting');
  const isProcessing = isLoading || isConverting || isBatchConverting;
  const hasFiles = videoFiles.length > 0;
  const activeFile = videoFiles.find((item) => item.id === activeFileId) ?? videoFiles[0];
  const pendingCount = videoFiles.filter((item) => item.status !== 'completed').length;
  const activeProgress = activeFile ? clampProgress(activeFile.progress) : 0;
  const statusLine = logs.split('\n').pop() ?? '';
  const selectedPresetDescription =
    QUALITY_OPTIONS.find((option) => option.value === selectedPreset)?.description ?? '';
  const activeStatus = activeFile?.status;
  const activeIsCompleted = activeStatus === 'completed';
  const activeIsQueued = activeStatus === 'queued';
  const activeIsConverting = activeStatus === 'converting';

  return (
    <div className="min-h-screen relative overflow-hidden bg-midnight-pine text-frost font-sans selection:bg-deep-forest-teal/60">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(70%_60%_at_10%_0%,#344B5A_0%,#1F2A2E_55%,#1F2A2E_100%)]" />
        <div className="absolute inset-0 opacity-70 bg-[radial-gradient(35%_35%_at_85%_15%,#2E3F43_0%,transparent_60%)]" />
        <div className="absolute inset-0 opacity-25 bg-[linear-gradient(180deg,#223A3A_0%,#1F2A2E_45%,#1F2A2E_100%)]" />
      </div>

      {/* Header */}
      <header className="border-b border-icy-slate/40 bg-frozen-spruce/70 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative bg-charcoal-bark/70 p-1.5 rounded-lg shadow-[0_0_0_1px_rgba(92,111,120,0.5)]">
              <Instagram className="text-frost" size={22} />
              <img
                src="./ico.png"
                alt="" aria-hidden="true"
                className="absolute inset-0 h-full w-full rounded-md object-cover"
              />
            </div>
            <div>
              <h1 className="text-xl font-display font-semibold tracking-wide text-frost">
                InstaConvert AI
              </h1>
              <p className="text-[10px] uppercase tracking-[0.2em] text-steel-winter hidden sm:block">
                Local-only conversion
              </p>
            </div>
          </div>
          <div className="text-xs text-steel-winter font-mono hidden sm:block">
            WebM -&gt; MP4 (H.264/AAC)
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-14">
        
        {/* Intro */}
        <div className="text-center mb-10 animate-fade-in">
          <p className="text-[11px] uppercase tracking-[0.35em] text-steel-winter">
            Local-only pipeline
          </p>
          <h2 className="mt-4 text-3xl md:text-4xl font-display font-semibold text-frost mb-3">
            Przygotuj wideo na Instagram
          </h2>
          <p className="text-steel-winter max-w-2xl mx-auto text-sm md:text-base">
            Konwertuj pliki WebM do formatu MP4 obslugiwanego przez Instagram bez utraty jakosci.
            Calosc dziala lokalnie w Twojej przegladarce, zapewniajac prywatnosc.
          </p>
        </div>

        {!isSecure && (
           <div className="bg-red-500/10 border border-red-400/30 rounded-2xl p-6 text-center max-w-2xl mx-auto mb-8 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
            <ShieldAlert className="mx-auto text-red-300 mb-2" size={48} />
            <h3 className="text-xl font-display font-semibold text-red-100 mb-2">Połączenie niezabezpieczone</h3>
            <p className="text-red-200">
              Ta aplikacja wymaga <strong>SharedArrayBuffer</strong>, który działa tylko w bezpiecznym kontekście (HTTPS lub localhost).
            </p>
            <p className="text-red-200/70 text-sm mt-2">
              Jeśli otwierasz stronę po IP w sieci lokalnej, to nie zadziała. Użyj <code>localhost</code> lub wdróż aplikację na serwer z HTTPS (np. GitHub Pages).
            </p>
          </div>
        )}

        {isLoading && isSecure && (
          <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
            <div className="w-12 h-12 border-4 border-icy-slate/60 border-t-deep-forest-teal rounded-full animate-spin mb-4"></div>
            <p className="text-steel-winter font-medium">Ładowanie silnika konwersji...</p>
            {!window.crossOriginIsolated && (
               <p className="text-amber-200/80 text-xs mt-2 font-mono bg-amber-900/20 px-2 py-1 rounded">
                 Oczekiwanie na izolację wątków (Service Worker)...
               </p>
            )}
            <p className="text-steel-winter text-sm mt-2 max-w-md text-center">
              Pobieranie bibliotek FFmpeg (ok. 25MB). Może to chwilę potrwać za pierwszym razem.
            </p>
          </div>
        )}

        {hasError && isSecure && (
          <div className="bg-red-500/10 border border-red-400/30 rounded-2xl p-6 text-center max-w-2xl mx-auto mb-8 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
            <AlertCircle className="mx-auto text-red-300 mb-2" size={32} />
            <h3 className="text-lg font-display font-semibold text-red-100 mb-2">Wystąpił błąd</h3>
            <p className="text-red-200/80 text-sm whitespace-pre-wrap mb-4">{logs}</p>
            
            <div className="flex gap-4 justify-center">
                <button 
                onClick={() => window.location.reload()}
                className="px-6 py-2 bg-deep-forest-teal hover:bg-deep-forest-teal/90 text-frost rounded-lg text-sm transition-colors flex items-center gap-2"
                >
                <RefreshCw size={16} />
                Spróbuj ponownie
                </button>
            </div>
            
            {!window.crossOriginIsolated && (
                 <p className="text-xs text-steel-winter mt-4">
                     Wskazówka: Jeśli widzisz ten błąd lokalnie, upewnij się, że używasz komendy <code>npm run dev</code> lub serwujesz wersję zbudowaną z odpowiednimi nagłówkami COOP/COEP.
                 </p>
            )}
          </div>
        )}

        {isReady && (
          <div
            className="grid grid-cols-1 gap-8 animate-fade-in"
            style={{ animationDelay: '120ms' }}
          >
            <div className="space-y-6">
              <FileUploader
                onFilesSelected={handleFilesSelected}
                disabled={!isReady || isProcessing}
                variant={hasFiles ? 'compact' : 'full'}
              />

              {hasFiles && activeFile && (
                <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-6 animate-fade-in">
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <VideoPreview url={activeFile.url} label="Oryginal (WebM)" onDuration={handleInputDuration} />
                    {activeFile.outputUrl ? (
                      <VideoPreview url={activeFile.outputUrl} label="Wynik (MP4)" />
                    ) : (
                      <div className="aspect-video bg-cold-shadow-blue/20 rounded-2xl border border-icy-slate/30 border-dashed flex items-center justify-center text-steel-winter">
                        <p className="text-sm">Podglad wyniku po konwersji</p>
                      </div>
                    )}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="bg-frozen-spruce/70 rounded-2xl p-5 border border-icy-slate/30 shadow-[0_18px_35px_rgba(0,0,0,0.25)] backdrop-blur-sm space-y-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-sm text-steel-winter truncate">
                          {activeFile.name} ({formatFileSize(activeFile.size)})
                        </div>
                        <div className="text-xs text-steel-winter">
                          Status: {activeStatus ? STATUS_LABELS[activeStatus] : ''}
                          {activeIsConverting && ` • ${activeProgress}%`}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                        {!activeIsCompleted && (
                          <button
                            onClick={() => handleConvert(activeFile.id)}
                            disabled={
                              !isReady ||
                              isBatchConverting ||
                              activeIsQueued ||
                              activeIsConverting ||
                              (isConverting && !activeIsConverting)
                            }
                            className={`
                              flex-1 sm:flex-none px-6 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ring-1 ring-icy-slate/30
                              ${
                                !isReady ||
                                isBatchConverting ||
                                activeIsQueued ||
                                activeIsConverting ||
                                (isConverting && !activeIsConverting)
                                  ? 'bg-icy-slate/30 text-steel-winter cursor-not-allowed'
                                  : 'bg-deep-forest-teal hover:bg-deep-forest-teal/90 text-frost shadow-[0_8px_20px_rgba(34,58,58,0.35)]'
                              }
                            `}
                          >
                            {activeIsConverting ? (
                              <>
                                <RefreshCw className="animate-spin" size={16} />
                                Przetwarzanie {activeProgress}%
                              </>
                            ) : activeIsQueued ? (
                              <>
                                <RefreshCw className="animate-spin" size={16} />
                                W kolejce
                              </>
                            ) : (
                              <>
                                <RefreshCw size={16} />
                                Konwertuj
                              </>
                            )}
                          </button>
                        )}

                        {activeIsCompleted && activeFile.outputUrl && (
                          <a
                            href={activeFile.outputUrl}
                            download={`converted_${activeFile.name.replace('.webm', '')}.mp4`}
                            className="flex-1 sm:flex-none px-6 py-2.5 bg-old-wood hover:bg-charcoal-bark text-frost rounded-xl font-semibold text-sm shadow-[0_8px_20px_rgba(43,38,34,0.35)] flex items-center justify-center gap-2 transition-all"
                          >
                            <Download size={16} />
                            Pobierz MP4
                          </a>
                        )}

                        <button
                          onClick={() => handleRemoveFile(activeFile.id)}
                          disabled={isConverting || isBatchConverting}
                          className={`p-2.5 rounded-xl transition-colors ${
                            isConverting || isBatchConverting
                              ? 'text-steel-winter/60 cursor-not-allowed'
                              : 'text-steel-winter hover:text-frost hover:bg-cold-shadow-blue/50'
                          }`}
                          title="Usun"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-[11px] uppercase tracking-[0.2em] text-steel-winter">Jakosc</span>
                        <div className="flex rounded-full overflow-hidden border border-icy-slate/40">
                          {QUALITY_OPTIONS.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => setSelectedPreset(option.value)}
                              className={`px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition-colors ${
                                selectedPreset === option.value
                                  ? 'bg-deep-forest-teal text-frost'
                                  : 'bg-transparent text-steel-winter hover:text-frost'
                              }`}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={handleConvertAll}
                          disabled={!isReady || isConverting || isBatchConverting || pendingCount === 0 || videoFiles.length < 2}
                          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors ${
                            !isReady || isConverting || isBatchConverting || pendingCount === 0 || videoFiles.length < 2
                              ? 'bg-icy-slate/30 text-steel-winter cursor-not-allowed'
                              : 'bg-deep-forest-teal/80 hover:bg-deep-forest-teal text-frost'
                          }`}
                        >
                          <ListChecks size={14} />
                          Konwertuj wszystkie ({pendingCount})
                        </button>

                        <button
                          onClick={handleClearAll}
                          disabled={isConverting || isBatchConverting}
                          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
                            isConverting || isBatchConverting
                              ? 'bg-icy-slate/30 text-steel-winter cursor-not-allowed'
                              : 'bg-cold-shadow-blue/50 hover:bg-cold-shadow-blue text-frost'
                          }`}
                        >
                          Wyczysc liste
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-steel-winter">{selectedPresetDescription}</p>

                    {activeIsConverting && (
                      <div className="w-full bg-icy-slate/30 rounded-full h-2.5 overflow-hidden">
                        <div 
                          className="bg-deep-forest-teal h-2.5 rounded-full transition-all duration-300" 
                          style={{ width: `${activeProgress}%` }}
                        ></div>
                      </div>
                    )}

                    <div className="text-xs font-mono text-steel-winter/80">
                      Status: {statusLine}
                    </div>
                  </div>

                  <div className="bg-frozen-spruce/60 rounded-2xl border border-icy-slate/30 overflow-hidden">
                    <div className="px-4 py-3 border-b border-icy-slate/20 flex items-center justify-between">
                      <span className="text-[11px] uppercase tracking-[0.3em] text-steel-winter">Pliki</span>
                      <span className="text-xs text-steel-winter">{videoFiles.length}</span>
                    </div>
                    <div className="divide-y divide-icy-slate/20">
                      {videoFiles.map((item) => {
                        const itemProgress = clampProgress(item.progress);
                        const isItemActive = activeFile?.id === item.id;
                        const isItemQueued = item.status === 'queued';
                        const isItemConverting = item.status === 'converting';
                        const canConvertItem =
                          isReady && !isConverting && !isBatchConverting && item.status !== 'completed' && !isItemQueued && !isItemConverting;

                        return (
                          <div
                            key={item.id}
                            onClick={() => setActiveFileId(item.id)}
                            className={`px-4 py-3 transition-colors cursor-pointer ${
                              isItemActive ? 'bg-cold-shadow-blue/40' : 'hover:bg-cold-shadow-blue/20'
                            }`}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-frost truncate">{item.name}</p>
                                <p className="text-xs text-steel-winter">
                                  {formatFileSize(item.size)} • {STATUS_LABELS[item.status]}
                                  {item.status === 'converting' && ` • ${itemProgress}%`}
                                </p>
                              </div>

                              <div className="flex items-center gap-2">
                                {item.status === 'completed' && item.outputUrl ? (
                                  <a
                                    href={item.outputUrl}
                                    download={`converted_${item.name.replace('.webm', '')}.mp4`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="px-3 py-2 bg-old-wood hover:bg-charcoal-bark text-frost rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors"
                                  >
                                    <Download size={14} />
                                    Pobierz
                                  </a>
                                ) : (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleConvert(item.id);
                                    }}
                                    disabled={!canConvertItem}
                                    className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors ${
                                      canConvertItem
                                        ? 'bg-deep-forest-teal hover:bg-deep-forest-teal/90 text-frost'
                                        : 'bg-icy-slate/30 text-steel-winter cursor-not-allowed'
                                    }`}
                                  >
                                    {item.status === 'converting' ? (
                                      <>
                                        <RefreshCw className="animate-spin" size={14} />
                                        {itemProgress}%
                                      </>
                                    ) : item.status === 'queued' ? (
                                      <>
                                        <RefreshCw className="animate-spin" size={14} />
                                        W kolejce
                                      </>
                                    ) : (
                                      <>
                                        <RefreshCw size={14} />
                                        Konwertuj
                                      </>
                                    )}
                                  </button>
                                )}

                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveFile(item.id);
                                  }}
                                  disabled={isConverting || isBatchConverting || isItemConverting || isItemQueued}
                                  className={`p-2 rounded-lg transition-colors ${
                                    isConverting || isBatchConverting || isItemConverting || isItemQueued
                                      ? 'text-steel-winter/60 cursor-not-allowed'
                                      : 'text-steel-winter hover:text-frost hover:bg-cold-shadow-blue/50'
                                  }`}
                                  title="Usun"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>

                            {(isItemConverting || isItemQueued) && (
                              <div className="mt-3">
                                <div className="w-full bg-icy-slate/30 rounded-full h-2 overflow-hidden">
                                  <div
                                    className="bg-deep-forest-teal h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${itemProgress}%` }}
                                  />
                                </div>
                                <div className="text-xs text-steel-winter mt-2">
                                  {isItemQueued ? 'W kolejce' : `Postep: ${itemProgress}%`}
                                </div>
                              </div>
                            )}

                            {item.status === 'error' && item.error && (
                              <div className="text-xs text-red-200 mt-2">
                                {item.error}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  </div>

                </div>
              )}
            </div>

          </div>
        )}
      </main>

      <footer className="border-t border-icy-slate/30 bg-old-wood/80 py-8 mt-12 text-center text-steel-winter text-sm">
        <p>&copy; {new Date().getFullYear()} InstaConvert AI. Działa w pełni prywatnie w Twojej przeglądarce.</p>
      </footer>
    </div>
  );
};

export default App;
