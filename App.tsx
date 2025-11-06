import React, { useState, useCallback, useMemo } from 'react';
import { MaskingCanvas } from './components/MaskingCanvas';
import { generateInpaintedImage } from './services/geminiService';
import { Status } from './types';
import { UploadIcon, SparklesIcon, XCircleIcon, ArrowPathIcon, ArrowUturnLeftIcon } from './components/icons';

const App: React.FC = () => {
  const [status, setStatus] = useState<Status>(Status.Idle);
  const [originalImage, setOriginalImage] = useState<File | null>(null);
  const [maskImage, setMaskImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>('');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [brushSize, setBrushSize] = useState(40);
  const [clearCanvasCounter, setClearCanvasCounter] = useState(0);

  const originalImageURL = useMemo(() => {
    return originalImage ? URL.createObjectURL(originalImage) : null;
  }, [originalImage]);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 4 * 1024 * 1024) {
        setError("Image size should be less than 4MB.");
        return;
      }
      setOriginalImage(file);
      setStatus(Status.Masking);
      setError(null);
      setGeneratedImage(null);
      setMaskImage(null);
    }
  };

  const handleMaskChange = useCallback((maskDataUrl: string) => {
    setMaskImage(maskDataUrl);
  }, []);

  const handleClearMask = () => {
    setClearCanvasCounter(c => c + 1);
    setMaskImage(null);
  };
  
  const handleStartOver = () => {
    setStatus(Status.Idle);
    setOriginalImage(null);
    setMaskImage(null);
    setPrompt('');
    setGeneratedImage(null);
    setError(null);
    setClearCanvasCounter(0);
    // Also reset the file input
    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };


  const fileToBase64 = (file: File): Promise<{base64: string, mimeType: string}> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const [meta, data] = result.split(',');
        const mimeType = meta.split(':')[1].split(';')[0];
        resolve({ base64: data, mimeType });
      };
      reader.onerror = (error) => reject(error);
    });

  const dataURLtoFile = (dataurl: string, filename: string): File => {
    const arr = dataurl.split(',');
    // The first part of the array is the metadata, e.g., "data:image/png;base64"
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch) {
      throw new Error('Invalid data URL');
    }
    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  }

  const handleUseResultAsInput = () => {
    if (!generatedImage) return;

    const newImageFile = dataURLtoFile(generatedImage, 'edited-image.png');

    setOriginalImage(newImageFile);
    setStatus(Status.Masking);
    setGeneratedImage(null);
    setMaskImage(null);
    setPrompt('');
    setError(null);
    setClearCanvasCounter(c => c + 1);
  };

  const handleGenerate = async () => {
    if (!originalImage || !maskImage || !prompt.trim()) {
      setError("Please upload an image, mask an area, and enter a prompt.");
      return;
    }

    setStatus(Status.Loading);
    setError(null);
    setGeneratedImage(null);

    try {
      const { base64: originalImageBase64, mimeType } = await fileToBase64(originalImage);
      const maskImageBase64 = maskImage.split(',')[1];

      const result = await generateInpaintedImage(
        originalImageBase64,
        mimeType,
        maskImageBase64,
        prompt
      );

      setGeneratedImage(`data:image/png;base64,${result}`);
      setStatus(Status.Done);
    } catch (e) {
      // Fix: Used standard `Error` type for error handling as `GoogleGenAIError` is deprecated.
      const error = e as Error;
      console.error(error);
      setError(error.message || 'An unknown error occurred.');
      setStatus(Status.Error);
    }
  };

  const isGenerateDisabled = status === Status.Loading || !maskImage || !prompt.trim();

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col items-center p-4 sm:p-6 md:p-8 font-sans">
      <header className="w-full max-w-6xl text-center mb-8">
        <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
          Gemini AI Room Makeover
        </h1>
        <p className="mt-2 text-lg text-gray-400">Transform your space with the power of AI.</p>
      </header>
      
      <main className="w-full max-w-6xl flex-grow">
        {status === Status.Idle && (
          <div className="flex flex-col items-center justify-center bg-gray-800/50 border-2 border-dashed border-gray-600 rounded-2xl p-12 text-center h-96">
            <UploadIcon className="w-16 h-16 text-gray-500 mb-4" />
            <h2 className="text-2xl font-semibold mb-2">Upload a room photo</h2>
            <p className="text-gray-400 mb-6">Drag & drop or click to select a file (PNG, JPG, WEBP recommended, &lt;4MB).</p>
            <label htmlFor="file-upload" className="cursor-pointer bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg transition-transform transform hover:scale-105">
              Select Image
            </label>
            <input id="file-upload" type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
          </div>
        )}

        {(status === Status.Masking || status === Status.Loading || status === Status.Done || status === Status.Error) && originalImageURL && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="flex flex-col space-y-4">
              <h2 className="text-xl font-semibold text-purple-300">1. Mask the area to change</h2>
              <div className="aspect-square md:aspect-[4/3] relative rounded-lg overflow-hidden border-2 border-gray-700">
                <MaskingCanvas
                  imageUrl={originalImageURL}
                  brushSize={brushSize}
                  brushColor="#FFFFFF"
                  onMaskChange={handleMaskChange}
                  clearCounter={clearCanvasCounter}
                />
              </div>
              <div className="bg-gray-800 p-4 rounded-lg">
                <label htmlFor="brush-size" className="block text-sm font-medium text-gray-300 mb-2">
                  Brush Size: {brushSize}px
                </label>
                <div className="flex items-center space-x-4">
                  <input
                    id="brush-size"
                    type="range"
                    min="5"
                    max="100"
                    value={brushSize}
                    onChange={(e) => setBrushSize(Number(e.target.value))}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                  <button onClick={handleClearMask} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-full transition" title="Clear mask">
                    <ArrowPathIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <h2 className="text-xl font-semibold text-purple-300 mt-4">2. Describe your vision</h2>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g., 'a large, modern painting of a forest', 'a cozy reading nook with a velvet armchair', 'change the wall color to a deep navy blue'"
                className="w-full h-24 p-3 bg-gray-800 border-2 border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition"
              />
              
              <button
                onClick={handleGenerate}
                disabled={isGenerateDisabled}
                className="w-full flex items-center justify-center py-3 px-6 text-lg font-bold bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg text-white transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
              >
                <SparklesIcon className="w-6 h-6 mr-2" />
                {status === Status.Loading ? 'Generating...' : 'Generate Makeover'}
              </button>
            </div>

            <div className="flex flex-col space-y-4">
               <h2 className="text-xl font-semibold text-purple-300">3. See the Result</h2>
              <div className="aspect-square md:aspect-[4/3] bg-gray-800/50 border-2 border-dashed border-gray-600 rounded-lg flex items-center justify-center overflow-hidden">
                {status === Status.Loading && (
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-purple-500 mx-auto mb-4"></div>
                    <p className="text-lg font-semibold">The AI is re-imagining your space...</p>
                    <p className="text-gray-400">This can take a moment.</p>
                  </div>
                )}
                 {status === Status.Error && error && (
                   <div className="p-4 text-center">
                    <XCircleIcon className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-red-400">Generation Failed</h3>
                    <p className="text-red-300 mt-2 text-sm">{error}</p>
                    <button onClick={handleGenerate} className="mt-4 py-2 px-4 bg-yellow-500 text-black font-semibold rounded-lg hover:bg-yellow-600 transition">Try Again</button>
                   </div>
                 )}
                 {generatedImage && status === Status.Done && (
                   <img src={generatedImage} alt="Generated interior design" className="w-full h-full object-contain" />
                 )}
                 {status !== Status.Loading && status !== Status.Error && !generatedImage && (
                   <div className="text-center text-gray-500">
                     <p>Your AI-generated image will appear here.</p>
                   </div>
                 )}
              </div>
              <div className="flex flex-col gap-4">
                {generatedImage && status === Status.Done && (
                  <button
                    onClick={handleUseResultAsInput}
                    className="w-full flex items-center justify-center py-3 px-6 text-lg font-bold bg-purple-600 hover:bg-purple-700 rounded-lg text-white transition-all transform hover:scale-105"
                    title="Use this result as the new image to mask and edit further."
                  >
                    <ArrowUturnLeftIcon className="w-6 h-6 mr-2" />
                    Continue Editing
                  </button>
                )}
                <button 
                  onClick={handleStartOver}
                  className="w-full py-3 px-6 text-lg font-bold bg-gray-700 hover:bg-gray-600 rounded-lg transition"
                >
                  Start a New Project
                </button>
              </div>
            </div>
          </div>
        )}

        {status === Status.Idle && error && (
          <div className="mt-4 p-4 bg-red-900/50 border border-red-700 text-red-300 rounded-lg text-center">
            {error}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;