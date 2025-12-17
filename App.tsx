/// <reference lib="dom" />
import React, { useEffect, useState, useRef } from 'react';
import { ffmpegService } from './services/ffmpegService';
import FileUploader from './components/FileUploader';
import VideoPreview from './components/VideoPreview';
import CaptionGenerator from './components/CaptionGenerator';
import { VideoFile, ConversionStatus } from './types';
import { Download, RefreshCw, AlertCircle, Sparkles, ShieldAlert, Instagram } from 'lucide-react';

const App: React.FC = () => {
  const [status, setStatus] = useState<ConversionStatus>(ConversionStatus.IDLE);
  const [videoFile, setVideoFile] = useState<VideoFile | null>(null);
  const [outputVideoUrl, setOutputVideoUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string>('Oczekiwanie na inicjalizację...');
  const [isSecure, setIsSecure] = useState(true);

  // Effect to load FFmpeg on mount
  useEffect(() => {
    // Check for Secure Context (HTTPS or localhost)
    if (!window.isSecureContext) {
      setIsSecure(false);
      setStatus(ConversionStatus.ERROR);
      setLogs('BŁĄD KRYTYCZNY: Aplikacja wymaga bezpiecznego połączenia (HTTPS) lub localhost do działania. Otwórz stronę przez https:// lub na localhost.');
      return;
    }

    let mounted = true;

    const load = async () => {
      setStatus(ConversionStatus.LOADING_FFMPEG);
      
      // Safety timeout
      const timeoutId = setTimeout(() => {
        if (mounted && status === ConversionStatus.LOADING_FFMPEG) {
          // Check isolation specifically
          if (!window.crossOriginIsolated) {
             setLogs(prev => prev + '\n\nProblem z nagłówkami bezpieczeństwa. Spróbuj odświeżyć stronę.');
          }
          setStatus(ConversionStatus.ERROR);
        }
      }, 10000); // Reduced to 10s for faster feedback

      try {
        await ffmpegService.load((msg) => {
           if (mounted) setLogs(prev => (prev + '\n' + msg).slice(-500));
        });
        if (mounted) {
          setStatus(ConversionStatus.READY);
          setLogs('System gotowy. Prześlij plik WebM.');
          clearTimeout(timeoutId);
        }
      } catch (e: any) {
        if (mounted) {
          console.error(e);
          setStatus(ConversionStatus.ERROR);
          setLogs(`Błąd ładowania FFmpeg: ${e.message}`);
          clearTimeout(timeoutId);
        }
      }
    };
    
    // Check if service worker has enabled COOP/COEP
    if (!window.crossOriginIsolated) {
        console.warn("Strona nie jest w trybie Cross-Origin Isolated.");
        setLogs('Konfiguracja trybu wysokiej wydajności (wymagane przeładowanie)...');
    }

    load();

    return () => {
      mounted = false;
    };
  }, []);

  const handleFileSelected = (file: File) => {
    const url = URL.createObjectURL(file);
    setVideoFile({
      file,
      url,
      name: file.name,
      size: file.size,
      durationSeconds: undefined
    });
    // Reset output if new file selected
    if (outputVideoUrl) {
      URL.revokeObjectURL(outputVideoUrl);
      setOutputVideoUrl(null);
    }
  };

  const handleInputDuration = (durationSeconds: number) => {
    setVideoFile((current) => {
      if (!current) return current;
      if (current.durationSeconds === durationSeconds) return current;
      return { ...current, durationSeconds };
    });
  };

  const handleConvert = async () => {
    if (!videoFile) return;

    setStatus(ConversionStatus.CONVERTING);
    setProgress(0);
    setLogs('Rozpoczynam konwersję...');

    try {
      const mp4Blob = await ffmpegService.convertWebMToMp4(
        videoFile.file,
        (prog) => {
          setProgress(prog);
        },
        videoFile.durationSeconds
      );
      
      const mp4Url = URL.createObjectURL(mp4Blob);
      setOutputVideoUrl(mp4Url);
      setStatus(ConversionStatus.COMPLETED);
      setLogs('Konwersja zakończona sukcesem!');
    } catch (e: any) {
      console.error(e);
      setStatus(ConversionStatus.ERROR);
      setLogs(`Błąd konwersji: ${e.message}`);
    }
  };

  const handleReset = () => {
    if (videoFile?.url) URL.revokeObjectURL(videoFile.url);
    if (outputVideoUrl) URL.revokeObjectURL(outputVideoUrl);
    setVideoFile(null);
    setOutputVideoUrl(null);
    setStatus(ConversionStatus.READY);
    setProgress(0);
    setLogs('Gotowy do następnego zadania.');
  };

  const isProcessing = status === ConversionStatus.CONVERTING || status === ConversionStatus.LOADING_FFMPEG;
  const safeProgress = Number.isFinite(progress) ? progress : 0;
  const progressLabel = Math.min(100, Math.max(0, Math.round(safeProgress)));

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
                src="/ico.png"
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
        <div className="text-center mb-12 animate-fade-in">
          <div className="inline-flex items-center gap-2 rounded-full border border-icy-slate/40 bg-cold-shadow-blue/40 px-4 py-1 text-[11px] uppercase tracking-[0.2em] text-steel-winter">
            Local-only pipeline
          </div>
          <h2 className="mt-5 text-3xl md:text-4xl font-display font-semibold text-frost mb-4">
            Przygotuj wideo na Instagram
          </h2>
          <p className="text-steel-winter max-w-2xl mx-auto text-sm md:text-base">
            Konwertuj pliki WebM do formatu MP4 obsługiwanego przez Instagram bez utraty jakości. 
            Całość działa lokalnie w Twojej przeglądarce, zapewniając prywatność.
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

        {status === ConversionStatus.LOADING_FFMPEG && isSecure && (
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

        {status === ConversionStatus.ERROR && isSecure && (
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

        {(status === ConversionStatus.READY || status === ConversionStatus.CONVERTING || status === ConversionStatus.COMPLETED) && (
          <div
            className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in"
            style={{ animationDelay: '120ms' }}
          >
            
            {/* Left Column: Input/Output */}
            <div className="lg:col-span-2 space-y-6">
              
              {!videoFile ? (
                <FileUploader onFileSelected={handleFileSelected} />
              ) : (
                <div className="space-y-6 animate-fade-in">
                  
                  {/* Video Previews */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <VideoPreview url={videoFile.url} label="Oryginał (WebM)" onDuration={handleInputDuration} />
                    {outputVideoUrl ? (
                      <VideoPreview url={outputVideoUrl} label="Wynik (MP4)" />
                    ) : (
                      <div className="aspect-video bg-cold-shadow-blue/30 rounded-xl border border-icy-slate/40 border-dashed flex items-center justify-center text-steel-winter">
                        <p className="text-sm">Podgląd wyniku po konwersji</p>
                      </div>
                    )}
                  </div>

                  {/* Actions Bar */}
                  <div className="bg-frozen-spruce/70 rounded-2xl p-4 border border-icy-slate/30 shadow-[0_10px_30px_rgba(0,0,0,0.25)] flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-sm text-steel-winter overflow-hidden text-ellipsis whitespace-nowrap max-w-[200px]">
                      {videoFile.name} ({(videoFile.size / 1024 / 1024).toFixed(2)} MB)
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      {status !== ConversionStatus.COMPLETED && (
                        <button
                          onClick={handleConvert}
                          disabled={isProcessing}
                          className={`
                            flex-1 sm:flex-none px-6 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ring-1 ring-icy-slate/30
                            ${isProcessing 
                              ? 'bg-icy-slate/30 text-steel-winter cursor-not-allowed' 
                              : 'bg-deep-forest-teal hover:bg-deep-forest-teal/90 text-frost shadow-[0_8px_20px_rgba(34,58,58,0.35)]'}
                          `}
                        >
                          {isProcessing ? (
                            <>
                              <RefreshCw className="animate-spin" size={16} />
                              Przetwarzanie {progressLabel}%
                            </>
                          ) : (
                            <>
                              <RefreshCw size={16} />
                              Konwertuj
                            </>
                          )}
                        </button>
                      )}

                      {status === ConversionStatus.COMPLETED && outputVideoUrl && (
                        <a
                          href={outputVideoUrl}
                          download={`converted_${videoFile.name.replace('.webm', '')}.mp4`}
                          className="flex-1 sm:flex-none px-6 py-2.5 bg-old-wood hover:bg-charcoal-bark text-frost rounded-xl font-semibold text-sm shadow-[0_8px_20px_rgba(43,38,34,0.35)] flex items-center justify-center gap-2 transition-all"
                        >
                          <Download size={16} />
                          Pobierz MP4
                        </a>
                      )}

                      <button
                        onClick={handleReset}
                        className="p-2.5 text-steel-winter hover:text-frost hover:bg-cold-shadow-blue/50 rounded-xl transition-colors"
                        title="Zresetuj"
                      >
                        <RefreshCw size={18} />
                      </button>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  {status === ConversionStatus.CONVERTING && (
                    <div className="w-full bg-icy-slate/30 rounded-full h-2.5 overflow-hidden">
                      <div 
                        className="bg-deep-forest-teal h-2.5 rounded-full transition-all duration-300" 
                        style={{ width: `${progressLabel}%` }}
                      ></div>
                    </div>
                  )}

                  {/* Status Logs (Compact) */}
                  <div className="text-xs font-mono text-steel-winter mt-2">
                     Status: {logs.split('\n').pop()}
                  </div>

                </div>
              )}
            </div>

            {/* Right Column: AI Features */}
            <div className="lg:col-span-1">
              {videoFile ? (
                <CaptionGenerator fileName={videoFile.name} />
              ) : (
                <div className="h-full flex items-center justify-center p-8 text-center border border-icy-slate/40 border-dashed rounded-2xl bg-cold-shadow-blue/30">
                  <div className="space-y-3 opacity-60">
                    <Sparkles className="mx-auto text-steel-winter" size={32} />
                    <p className="text-steel-winter text-sm">
                      Wgraj wideo, aby skorzystać z generatora opisów AI.
                    </p>
                  </div>
                </div>
              )}
              
              <div className="mt-6 p-4 bg-frozen-spruce/60 rounded-xl border border-icy-slate/40 text-xs text-steel-winter shadow-[0_10px_30px_rgba(0,0,0,0.2)]">
                <h4 className="font-display font-semibold text-frost mb-2 flex items-center gap-2">
                  <AlertCircle size={14} />
                  Informacja techniczna
                </h4>
                <p>
                  Aplikacja używa FFmpeg WebAssembly do konwersji wewnątrz przeglądarki. 
                  Duże pliki mogą wymagać więcej pamięci RAM. 
                  Jeśli strona "zamuli", spróbuj z mniejszym plikiem.
                </p>
              </div>
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
