import React, { useState } from 'react';
import { generateInstagramCaption } from '../services/geminiService';
import { Sparkles, Copy, Check } from 'lucide-react';
import { CaptionResult } from '../types';

interface CaptionGeneratorProps {
  fileName: string;
}

const CaptionGenerator: React.FC<CaptionGeneratorProps> = ({ fileName }) => {
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CaptionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!description.trim()) return;
    
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await generateInstagramCaption(description);
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Wystąpił błąd podczas generowania.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (result) {
      const fullText = `${result.caption}\n\n${result.hashtags.join(' ')}`;
      navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="bg-slate-800/30 border border-indigo-500/20 rounded-xl p-6 mt-6">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="text-indigo-400" size={20} />
        <h2 className="text-xl font-semibold text-white">Generator Opisów AI</h2>
      </div>
      
      <p className="text-slate-400 text-sm mb-4">
        Opisz krótko co dzieje się na wideo <strong>{fileName}</strong>, a Gemini stworzy dla Ciebie idealny post na Instagram.
      </p>

      <div className="space-y-4">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Napisz np.: Kot bawi się czerwoną włóczką i spada z kanapy..."
          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none min-h-[80px] text-sm"
        />

        <button
          onClick={handleGenerate}
          disabled={loading || !description.trim()}
          className={`
            w-full py-2.5 px-4 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors
            ${loading || !description.trim() 
              ? 'bg-slate-700 text-slate-400 cursor-not-allowed' 
              : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'}
          `}
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Generowanie...
            </>
          ) : (
            <>
              <Sparkles size={16} />
              Generuj Opis
            </>
          )}
        </button>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {result && (
          <div className="bg-slate-900/80 rounded-lg border border-slate-700 p-4 animate-fade-in">
            <div className="prose prose-invert prose-sm max-w-none">
              <p className="mb-4 text-slate-200 whitespace-pre-line">{result.caption}</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {result.hashtags.map((tag, i) => (
                  <span key={i} className="text-indigo-400 text-xs bg-indigo-400/10 px-2 py-1 rounded-full">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition-colors ml-auto"
            >
              {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
              {copied ? 'Skopiowano!' : 'Kopiuj całość'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CaptionGenerator;