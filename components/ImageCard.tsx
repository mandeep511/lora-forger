import React from "react";
import { DatasetImage, ProcessingStatus } from "../types";
import { Trash2, RefreshCw, AlertCircle, FileText, ImageIcon, CheckCircle2 } from "lucide-react";

interface ImageCardProps {
  image: DatasetImage;
  onUpdate: (id: string, updates: Partial<DatasetImage>) => void;
  onRemove: (id: string) => void;
  onRegenerate: (id: string) => void;
}

export const ImageCard: React.FC<ImageCardProps> = ({
  image,
  onUpdate,
  onRemove,
  onRegenerate,
}) => {
  const isProcessing = image.status === ProcessingStatus.PROCESSING;
  const isError = image.status === ProcessingStatus.ERROR;
  const isCompleted = image.status === ProcessingStatus.COMPLETED;

  const handleCaptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onUpdate(image.id, { caption: e.target.value });
  };

  const handleFilenameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate(image.id, { suggestedFilename: e.target.value });
  };

  return (
    <div className={`
      relative group flex flex-col md:flex-row gap-5 p-5 rounded-3xl transition-all duration-300
      ${isCompleted 
        ? 'bg-white border border-emerald-100 shadow-[0_4px_20px_-4px_rgba(16,185,129,0.1)]' 
        : 'bg-white/80 border border-white shadow-sm hover:shadow-md'
      }
    `}>
      
      {/* Image Preview Area */}
      <div className="relative w-full md:w-56 h-56 md:h-auto flex-shrink-0 bg-slate-50 rounded-2xl overflow-hidden border border-slate-100 group-hover:border-slate-200 transition-colors">
        {image.previewUrl ? (
          <img
            src={image.previewUrl}
            alt="Preview"
            className="w-full h-full object-contain p-2"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <ImageIcon className="text-slate-300" size={32} />
          </div>
        )}
        
        {/* Status Overlay */}
        {isProcessing && (
          <div className="absolute inset-0 bg-white/60 flex flex-col items-center justify-center backdrop-blur-[2px] gap-2">
            <RefreshCw className="animate-spin text-sky-400" size={28} />
            <span className="text-xs font-bold text-sky-500 uppercase tracking-widest animate-pulse">Forging</span>
          </div>
        )}
        
        {isCompleted && !isProcessing && (
          <div className="absolute top-2 right-2 bg-emerald-500 text-white rounded-full p-1 shadow-lg shadow-emerald-200">
             <CheckCircle2 size={16} />
          </div>
        )}
      </div>

      {/* Editor Area */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        
        {/* Filename Input */}
        <div className="flex items-center gap-3 bg-slate-50 rounded-xl px-3 py-2 border border-slate-200 focus-within:bg-white focus-within:border-sky-300 transition-all">
            <FileText size={16} className="text-slate-400" />
            <input 
                type="text" 
                value={image.suggestedFilename}
                onChange={handleFilenameChange}
                placeholder="filename.txt"
                className="bg-transparent text-slate-600 text-sm w-full outline-none font-medium placeholder:text-slate-400"
            />
        </div>

        {/* Caption Textarea */}
        <div className="flex-1 relative group/textarea">
            <textarea
            value={image.caption}
            onChange={handleCaptionChange}
            disabled={isProcessing}
            placeholder={isProcessing ? "AI is forging caption..." : "Waiting for generation..."}
            className={`w-full h-32 md:h-full bg-slate-50 border rounded-2xl p-4 text-sm resize-none outline-none font-medium leading-relaxed transition-all
                ${isError 
                  ? 'border-red-200 bg-red-50 text-red-600' 
                  : 'border-slate-200 focus:bg-white focus:border-sky-300 text-slate-600 placeholder:text-slate-400'
                }
            `}
            />
            {isError && (
                <div className="absolute bottom-3 right-3 text-red-500 text-xs font-bold flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-red-100 shadow-sm">
                    <AlertCircle size={12} />
                    Failed
                </div>
            )}
        </div>
      </div>

      {/* Side Actions */}
      <div className="flex md:flex-col gap-2 justify-end md:justify-start">
        <button
          onClick={() => onRegenerate(image.id)}
          disabled={isProcessing}
          className="p-3 text-slate-400 hover:text-sky-500 hover:bg-sky-50 rounded-2xl transition-all border border-transparent hover:border-sky-100 active:scale-95 disabled:opacity-50 disabled:active:scale-100"
          title="Regenerate Caption"
        >
          <RefreshCw size={20} />
        </button>
        <button
          onClick={() => onRemove(image.id)}
          disabled={isProcessing}
          className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all border border-transparent hover:border-red-100 active:scale-95 disabled:opacity-50 disabled:active:scale-100"
          title="Remove Image"
        >
          <Trash2 size={20} />
        </button>
      </div>
    </div>
  );
};
