import React from 'react';

interface VideoPreviewProps {
  url: string;
  label: string;
}

const VideoPreview: React.FC<VideoPreviewProps> = ({ url, label }) => {
  return (
    <div className="bg-slate-800/50 rounded-lg overflow-hidden border border-slate-700">
      <div className="bg-slate-900/50 px-4 py-2 border-b border-slate-700">
        <span className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</span>
      </div>
      <div className="relative aspect-video bg-black flex items-center justify-center">
        <video 
          src={url} 
          controls 
          className="w-full h-full object-contain" 
        />
      </div>
    </div>
  );
};

export default VideoPreview;