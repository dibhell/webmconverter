/// <reference lib="dom" />
import React, { useEffect, useState, useRef } from 'react';
import { ffmpegService } from './services/ffmpegService';
import FileUploader from './components/FileUploader';
import VideoPreview from './components/VideoPreview';
import CaptionGenerator from './components/CaptionGenerator';
import { VideoFile, ConversionStatus } from './types';
import { Download, RefreshCw, AlertCircle, CheckCircle2, Instagram, Sparkles, ShieldAlert } from 'lucide-react';

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
      size: file.size
    });
    // Reset output if new file selected
    if (outputVideoUrl) {
      URL.revokeObjectURL(outputVideoUrl);
      setOutputVideoUrl(null);
    }
  };

  const handleConvert = async () => {
    if (!videoFile) return;

    setStatus(ConversionStatus.CONVERTING);
    setProgress(0);
    setLogs('Rozpoczynam konwersję...');

    try {
      const mp4Blob = await ffmpegService.convertWebMToMp4(videoFile.file, (prog) => {
        setProgress(prog);
      });
      
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

  return (
    <div className="min-h-screen bg-slate-950 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-slate-950 to-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30">
      
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/50 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-tr from-indigo-500 to-purple-500 p-2 rounded-lg">
              <Instagram className="text-white" size={20} />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              InstaConvert AI
            </h1>
          </div>
          <div className="text-xs text-slate-500 font-mono hidden sm:block">
            WebM → MP4 (H.264/AAC)
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        
        {/* Intro */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Przygotuj wideo na Instagram
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto">
            Konwertuj pliki WebM do formatu MP4 obsługiwanego przez Instagram bez utraty jakości. 
            Całość działa lokalnie w Twojej przeglądarce, zapewniając prywatność.
          </p>
        </div>

        {!isSecure && (
           <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-center max-w-2xl mx-auto mb-8 animate-pulse">
            <ShieldAlert className="mx-auto text-red-400 mb-2" size={48} />
            <h3 className="text-xl font-bold text-red-200 mb-2">Połączenie niezabezpieczone</h3>
            <p className="text-red-300">
              Ta aplikacja wymaga <strong>SharedArrayBuffer</strong>, który działa tylko w bezpiecznym kontekście (HTTPS lub localhost).
            </p>
            <p className="text-red-300/70 text-sm mt-2">
              Jeśli otwierasz stronę po IP w sieci lokalnej, to nie zadziała. Użyj <code>localhost</code> lub wdróż aplikację na serwer z HTTPS (np. GitHub Pages).
            </p>
          </div>
        )}

        {status === ConversionStatus.LOADING_FFMPEG && isSecure && (
          <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-indigo-400 font-medium">Ładowanie silnika konwersji...</p>
            {!window.crossOriginIsolated && (
               <p className="text-yellow-500/80 text-xs mt-2 font-mono bg-yellow-900/20 px-2 py-1 rounded">
                 Oczekiwanie na izolację wątków (Service Worker)...
               </p>
            )}
            <p className="text-slate-500 text-sm mt-2 max-w-md text-center">
              Pobieranie bibliotek FFmpeg (ok. 25MB). Może to chwilę potrwać za pierwszym razem.
            </p>
          </div>
        )}

        {status === ConversionStatus.ERROR && isSecure && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-center max-w-2xl mx-auto mb-8">
            <AlertCircle className="mx-auto text-red-400 mb-2" size={32} />
            <h3 className="text-lg font-semibold text-red-200 mb-2">Wystąpił błąd</h3>
            <p className="text-red-300/80 text-sm whitespace-pre-wrap mb-4">{logs}</p>
            
            <div className="flex gap-4 justify-center">
                <button 
                onClick={() => window.location.reload()}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm transition-colors flex items-center gap-2"
                >
                <RefreshCw size={16} />
                Spróbuj ponownie
                </button>
            </div>
            
            {!window.crossOriginIsolated && (
                 <p className="text-xs text-slate-500 mt-4">
                     Wskazówka: Jeśli widzisz ten błąd lokalnie, upewnij się, że używasz komendy <code>npm run dev</code> lub serwujesz wersję zbudowaną z odpowiednimi nagłówkami COOP/COEP.
                 </p>
            )}
          </div>
        )}

        {(status === ConversionStatus.READY || status === ConversionStatus.CONVERTING || status === ConversionStatus.COMPLETED) && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left Column: Input/Output */}
            <div className="lg:col-span-2 space-y-6">
              
              {!videoFile ? (
                <FileUploader onFileSelected={handleFileSelected} />
              ) : (
                <div className="space-y-6 animate-fade-in">
                  
                  {/* Video Previews */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <VideoPreview url={videoFile.url} label="Oryginał (WebM)" />
                    {outputVideoUrl ? (
                      <VideoPreview url={outputVideoUrl} label="Wynik (MP4)" />
                    ) : (
                      <div className="aspect-video bg-slate-900/30 rounded-lg border border-slate-800 border-dashed flex items-center justify-center text-slate-600">
                        <p className="text-sm">Podgląd wyniku po konwersji</p>
                      </div>
                    )}
                  </div>

                  {/* Actions Bar */}
                  <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-sm text-slate-400 overflow-hidden text-ellipsis whitespace-nowrap max-w-[200px]">
                      {videoFile.name} ({(videoFile.size / 1024 / 1024).toFixed(2)} MB)
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      {status !== ConversionStatus.COMPLETED && (
                        <button
                          onClick={handleConvert}
                          disabled={isProcessing}
                          className={`
                            flex-1 sm:flex-none px-6 py-2.5 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2
                            ${isProcessing 
                              ? 'bg-slate-800 text-slate-400 cursor-not-allowed' 
                              : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'}
                          `}
                        >
                          {isProcessing ? (
                            <>
                              <RefreshCw className="animate-spin" size={16} />
                              Przetwarzanie {progress}%
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
                          className="flex-1 sm:flex-none px-6 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-lg font-semibold text-sm shadow-lg shadow-green-500/20 flex items-center justify-center gap-2 transition-all"
                        >
                          <Download size={16} />
                          Pobierz MP4
                        </a>
                      )}

                      <button
                        onClick={handleReset}
                        className="p-2.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                        title="Zresetuj"
                      >
                        <RefreshCw size={18} />
                      </button>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  {status === ConversionStatus.CONVERTING && (
                    <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                      <div 
                        className="bg-indigo-500 h-2.5 rounded-full transition-all duration-300" 
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                  )}

                  {/* Status Logs (Compact) */}
                  <div className="text-xs font-mono text-slate-500 mt-2">
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
                <div className="h-full flex items-center justify-center p-8 text-center border border-slate-800 border-dashed rounded-xl bg-slate-900/20">
                  <div className="space-y-3 opacity-50">
                    <Sparkles className="mx-auto text-slate-400" size={32} />
                    <p className="text-slate-400 text-sm">
                      Wgraj wideo, aby skorzystać z generatora opisów AI.
                    </p>
                  </div>
                </div>
              )}
              
              <div className="mt-6 p-4 bg-slate-900/50 rounded-lg border border-slate-800 text-xs text-slate-400">
                <h4 className="font-semibold text-slate-300 mb-2 flex items-center gap-2">
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

      <footer className="border-t border-slate-800 py-8 mt-12 text-center text-slate-500 text-sm">
        <p>&copy; {new Date().getFullYear()} InstaConvert AI. Działa w pełni prywatnie w Twojej przeglądarce.</p>
      </footer>
    </div>
  );
};

export default App;