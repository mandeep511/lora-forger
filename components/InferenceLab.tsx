import React, { useState, useRef } from "react";
import { Copy, Sparkles, Upload, X, Wand2, Loader2, Check } from "lucide-react";
import { generateInferencePrompt } from "../services/geminiService";

interface InferenceLabProps {
  triggerWord: string;
  isNSFW: boolean;
}

const STYLES = [
  "Photorealistic",
  "Anime / Manga",
  "3D Render",
  "Digital Illustration",
  "Oil Painting",
  "Cyberpunk",
  "Lineart",
  "Fantasy RPG",
];

export const InferenceLab: React.FC<InferenceLabProps> = ({ triggerWord, isNSFW }) => {
  const [userText, setUserText] = useState("");
  const [selectedStyle, setSelectedStyle] = useState(STYLES[0]);
  const [referenceImage, setReferenceImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setReferenceImage(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const clearImage = () => {
    setReferenceImage(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleGenerate = async () => {
    if (!userText && !referenceImage) return;
    
    setIsGenerating(true);
    try {
      const result = await generateInferencePrompt(
        userText,
        referenceImage,
        triggerWord,
        selectedStyle,
        isNSFW
      );
      setGeneratedPrompt(result.prompt);
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedPrompt);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto h-full flex flex-col lg:flex-row gap-8 p-4 md:p-6">
      
      {/* Left: Controls Panel */}
      <div className="flex-1 flex flex-col gap-6 glass-panel rounded-[2rem] p-6 lg:p-8">
        <div className="flex items-center gap-3 border-b border-pink-100 pb-4">
          <div className="p-2.5 bg-pink-100 rounded-2xl">
             <Wand2 size={24} className="text-pink-500" />
          </div>
          <div>
             <h2 className="text-xl font-bold text-slate-800 tracking-tight">Prompt Engineer</h2>
             <p className="text-xs text-slate-400 font-bold">Inference Lab</p>
          </div>
        </div>

        {/* Style Selector */}
        <div className="space-y-3">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Artistic Style</label>
          <div className="flex flex-wrap gap-2">
            {STYLES.map((style) => (
              <button
                key={style}
                onClick={() => setSelectedStyle(style)}
                className={`px-4 py-2 text-xs font-bold rounded-2xl border transition-all duration-300 ${
                  selectedStyle === style
                    ? "bg-pink-500 border-pink-500 text-white shadow-lg shadow-pink-200"
                    : "bg-white border-slate-200 text-slate-500 hover:border-pink-300 hover:text-pink-500"
                }`}
              >
                {style}
              </button>
            ))}
          </div>
        </div>

        {/* User Input */}
        <div className="space-y-3 flex-1 flex flex-col">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Idea & Instruction</label>
          <textarea
            value={userText}
            onChange={(e) => setUserText(e.target.value)}
            placeholder="Describe what you imagine... (e.g., 'A girl sitting in a cyber cafe, drinking boba')"
            className="w-full flex-1 glass-input rounded-3xl p-5 text-sm resize-none focus:outline-none text-slate-700 placeholder:text-slate-400"
          />
        </div>

        {/* Reference Image */}
        <div className="space-y-3">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Visual Reference <span className="text-slate-400 lowercase font-normal">(optional)</span></label>
          
          {!referenceImage ? (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-200 hover:border-pink-300 hover:bg-pink-50 rounded-3xl h-28 flex items-center justify-center cursor-pointer transition-all gap-3 group bg-white/50"
            >
              <div className="p-3 bg-white rounded-full shadow-sm group-hover:scale-110 transition-transform">
                 <Upload size={20} className="text-slate-400 group-hover:text-pink-400" />
              </div>
              <span className="text-sm font-bold text-slate-400 group-hover:text-pink-500">Upload pose or outfit</span>
            </div>
          ) : (
            <div className="relative h-40 bg-white rounded-3xl border border-slate-200 overflow-hidden group shadow-sm">
              <img src={previewUrl!} alt="Ref" className="w-full h-full object-contain p-2" />
              <div className="absolute inset-0 bg-white/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                 <button 
                    onClick={clearImage}
                    className="p-2 bg-rose-500 text-white rounded-full hover:bg-rose-600 transition-colors shadow-lg"
                >
                    <X size={20} />
                </button>
              </div>
            </div>
          )}
          <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
        </div>

        <button
          onClick={handleGenerate}
          disabled={isGenerating || (!userText && !referenceImage)}
          className="w-full py-4 bg-gradient-to-r from-pink-500 to-rose-400 hover:from-pink-400 hover:to-rose-300 text-white font-bold rounded-2xl shadow-xl shadow-pink-200 disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed flex items-center justify-center gap-3 transition-all active:scale-[0.98] tracking-wide"
        >
          {isGenerating ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
          <span>Generate Magic Prompt</span>
        </button>
      </div>

      {/* Right: Output Panel */}
      <div className="flex-1 flex flex-col gap-6">
        <div className="glass-panel rounded-[2rem] p-6 lg:p-8 h-full flex flex-col relative overflow-hidden">
           
           <h2 className="text-xl font-bold text-slate-800 tracking-tight mb-6 flex items-center gap-3">
             <div className="w-3 h-8 bg-pink-400 rounded-full"></div>
             Generated Output
           </h2>
           
           {!generatedPrompt ? (
             <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-4 opacity-70">
                <div className="p-6 bg-white rounded-full shadow-sm border border-slate-100">
                    <Sparkles size={40} className="text-pink-300" />
                </div>
                <p className="text-sm font-bold">Prompt will appear here.</p>
             </div>
           ) : (
             <div className="flex-1 flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500 z-10">
               
               <div className="flex-1 relative group">
                  <textarea 
                    readOnly
                    value={generatedPrompt}
                    className="w-full h-full glass-input p-6 rounded-3xl text-slate-700 font-medium text-sm leading-relaxed focus:outline-none resize-none bg-white/60"
                  />
                  <div className="absolute bottom-4 right-4 flex gap-2">
                    <button
                        onClick={copyToClipboard}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-lg ${
                             isCopied 
                             ? "bg-emerald-500 text-white shadow-emerald-200" 
                             : "bg-slate-800 text-white hover:bg-slate-700 shadow-slate-300"
                        }`}
                    >
                        {isCopied ? <Check size={14} /> : <Copy size={14} />}
                        {isCopied ? "Copied!" : "Copy"}
                    </button>
                  </div>
               </div>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};