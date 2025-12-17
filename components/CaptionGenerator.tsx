/// <reference lib="dom" />
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
      if (window.navigator.clipboard) {
        window.navigator.clipboard.writeText(fullText);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="bg-frozen-spruce/60 border border-icy-slate/40 rounded-2xl p-6 mt-6 shadow-[0_12px_30px_rgba(0,0,0,0.25)]">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="text-icy-slate" size={20} />
        <h2 className="text-xl font-display font-semibold text-frost">Generator Opisów AI</h2>
      </div>
      
      <p className="text-steel-winter text-sm mb-4">
        Opisz krótko co dzieje się na wideo <strong>{fileName}</strong>, a Gemini stworzy dla Ciebie idealny post na Instagram.
      </p>

      <div className="space-y-4">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Napisz np.: Kot bawi się czerwoną włóczką i spada z kanapy..."
          className="w-full bg-midnight-pine/60 border border-icy-slate/50 rounded-xl p-3 text-frost focus:ring-2 focus:ring-deep-forest-teal/60 focus:border-transparent outline-none min-h-[80px] text-sm"
        />

        <button
          onClick={handleGenerate}
          disabled={loading || !description.trim()}
          className={`
            w-full py-2.5 px-4 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-colors ring-1 ring-icy-slate/30
            ${loading || !description.trim() 
              ? 'bg-icy-slate/30 text-steel-winter cursor-not-allowed' 
              : 'bg-deep-forest-teal hover:bg-deep-forest-teal/90 text-frost shadow-[0_8px_20px_rgba(34,58,58,0.35)]'}
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
          <div className="p-3 bg-red-500/10 border border-red-400/30 rounded-xl text-red-200 text-sm">
            {error}
          </div>
        )}

        {result && (
          <div className="bg-midnight-pine/70 rounded-xl border border-icy-slate/40 p-4 animate-fade-in">
            <div className="prose prose-invert prose-sm max-w-none">
              <p className="mb-4 text-frost whitespace-pre-line">{result.caption}</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {result.hashtags.map((tag, i) => (
                  <span key={i} className="text-frost text-xs bg-deep-forest-teal/40 px-2 py-1 rounded-full">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 text-xs font-medium text-steel-winter hover:text-frost transition-colors ml-auto"
            >
              {copied ? <Check size={14} className="text-deep-forest-teal" /> : <Copy size={14} />}
              {copied ? 'Skopiowano!' : 'Kopiuj całość'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CaptionGenerator;
