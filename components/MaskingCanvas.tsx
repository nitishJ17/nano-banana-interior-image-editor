import React, { useRef, useEffect, useState, useCallback } from 'react';

interface MaskingCanvasProps {
  imageUrl: string;
  brushSize: number;
  brushColor: string;
  onMaskChange: (maskDataUrl: string) => void;
  clearCounter: number;
}

export const MaskingCanvas: React.FC<MaskingCanvasProps> = ({
  imageUrl,
  brushSize,
  brushColor,
  onMaskChange,
  clearCounter,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Fix: Corrected typo from `constdrawImage` to `const drawImage`.
  const drawImage = useCallback(() => {
    const image = new Image();
    image.src = imageUrl;
    image.onload = () => {
      const container = containerRef.current;
      if (!container) return;
      
      const containerWidth = container.offsetWidth;
      const aspectRatio = image.width / image.height;
      
      let newWidth = containerWidth;
      let newHeight = containerWidth / aspectRatio;

      if (newHeight > container.offsetHeight && container.offsetHeight > 0) {
        newHeight = container.offsetHeight;
        newWidth = newHeight * aspectRatio;
      }
      
      setDimensions({ width: newWidth, height: newHeight });

      setTimeout(() => {
        const imageCanvas = imageCanvasRef.current;
        const drawingCanvas = drawingCanvasRef.current;
        const imgCtx = imageCanvas?.getContext('2d');
        
        if (imageCanvas && drawingCanvas && imgCtx) {
          imageCanvas.width = newWidth;
          imageCanvas.height = newHeight;
          drawingCanvas.width = newWidth;
          drawingCanvas.height = newHeight;
          
          imgCtx.drawImage(image, 0, 0, newWidth, newHeight);
        }
      }, 0);
    };
  }, [imageUrl]);

  useEffect(() => {
    drawImage();
    const handleResize = () => drawImage();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [imageUrl, drawImage]);
  
  const clearCanvas = useCallback(() => {
    const canvas = drawingCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx && canvas) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      onMaskChange(''); // Notify parent that mask is cleared
    }
  }, [onMaskChange]);

  useEffect(() => {
    if (clearCounter > 0) {
      clearCanvas();
    }
  }, [clearCounter, clearCanvas]);

  const getCoordinates = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  };

  const startDrawing = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCoordinates(event);
    if (!coords) return;
    setIsDrawing(true);
    lastPointRef.current = coords;
  };

  const draw = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const coords = getCoordinates(event);
    const lastPoint = lastPointRef.current;
    const ctx = drawingCanvasRef.current?.getContext('2d');
    if (!coords || !lastPoint || !ctx) return;

    ctx.strokeStyle = brushColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(lastPoint.x, lastPoint.y);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
    ctx.closePath();
    
    lastPointRef.current = coords;
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    lastPointRef.current = null;
    if (drawingCanvasRef.current) {
        onMaskChange(drawingCanvasRef.current.toDataURL());
    }
  };

  return (
    <div ref={containerRef} className="w-full h-full relative flex items-center justify-center">
      <canvas
        ref={imageCanvasRef}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ width: dimensions.width, height: dimensions.height }}
      />
      <canvas
        ref={drawingCanvasRef}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 cursor-crosshair"
        style={{ width: dimensions.width, height: dimensions.height }}
      />
    </div>
  );
};