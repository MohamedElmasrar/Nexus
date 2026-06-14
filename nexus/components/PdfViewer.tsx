"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Loader2, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Maximize2 } from "lucide-react";
import { Button } from "./ui/button";

interface PdfViewerProps {
  pdfBlob: Blob;
  fileName: string;
}

export default function PdfViewer({ pdfBlob, fileName }: PdfViewerProps) {
  const [libLoaded, setLibLoaded] = useState(false);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfDocRef = useRef<any>(null);
  const renderTaskRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load PDF.js from CDN dynamically
  useEffect(() => {
    if (typeof window === "undefined") return;

    if ((window as any).pdfjsLib) {
      setLibLoaded(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    script.async = true;
    script.onload = () => {
      const pdfjsLib = (window as any).pdfjsLib;
      if (pdfjsLib) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        setLibLoaded(true);
      } else {
        setError("Failed to initialize PDF helper library.");
      }
    };
    script.onerror = () => {
      setError("Failed to load PDF engine script. Please check your network connection.");
    };
    document.body.appendChild(script);

    return () => {
      // Keep script in document body to avoid re-loading on re-mounts
    };
  }, []);

  // Load PDF Document when libLoaded and pdfBlob are available
  useEffect(() => {
    if (!libLoaded || !pdfBlob) return;

    let active = true;
    setLoading(true);
    setError(null);

    const loadPdf = async () => {
      try {
        const arrayBuffer = await pdfBlob.arrayBuffer();
        if (!active) return;

        const pdfjsLib = (window as any).pdfjsLib;
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;

        if (!active) return;
        pdfDocRef.current = pdf;
        setNumPages(pdf.numPages);
        setCurrentPage(1);
        setLoading(false);
      } catch (err: any) {
        console.error("Error loading PDF document:", err);
        if (active) {
          setError(err.message || "Failed to parse PDF document. It might be corrupted.");
          setLoading(false);
        }
      }
    };

    void loadPdf();

    return () => {
      active = false;
      if (pdfDocRef.current) {
        try {
          pdfDocRef.current.destroy();
        } catch (e) {}
        pdfDocRef.current = null;
      }
    };
  }, [libLoaded, pdfBlob]);

  // Render a specific PDF page on canvas
  const renderPage = useCallback(async (pageNum: number, currentScale: number) => {
    const pdf = pdfDocRef.current;
    const canvas = canvasRef.current;
    if (!pdf || !canvas) return;

    // Cancel any active render task
    if (renderTaskRef.current) {
      try {
        renderTaskRef.current.cancel();
      } catch (e) {}
      renderTaskRef.current = null;
    }

    try {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: currentScale });
      const context = canvas.getContext("2d");
      if (!context) return;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = viewport.width * dpr;
      canvas.height = viewport.height * dpr;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;

      context.scale(dpr, dpr);

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      const renderTask = page.render(renderContext);
      renderTaskRef.current = renderTask;
      await renderTask.promise;
      renderTaskRef.current = null;
    } catch (err: any) {
      if (err.name === "RenderingCancelledException" || err.name === "RenderingCancelled") {
        // Safe to ignore: render cancelled because page/scale changed
        return;
      }
      console.error("Error rendering page:", err);
    }
  }, []);

  // Re-render page when currentPage or scale changes
  useEffect(() => {
    if (!loading && !error && numPages && numPages >= currentPage) {
      void renderPage(currentPage, scale);
    }
  }, [loading, error, numPages, currentPage, scale, renderPage]);

  // Fit to container width automatically on first render
  const fitWidth = useCallback(async () => {
    const pdf = pdfDocRef.current;
    const container = containerRef.current;
    if (!pdf || !container) return;

    try {
      const page = await pdf.getPage(currentPage);
      const originalViewport = page.getViewport({ scale: 1.0 });
      // Calculate fit scale (leave some padding)
      const containerWidth = container.clientWidth - 32;
      const fitScale = containerWidth / originalViewport.width;
      // Clamp between 0.5 and 2.5
      setScale(Math.max(0.5, Math.min(2.5, fitScale)));
    } catch (e) {
      console.error("Failed to fit width:", e);
    }
  }, [currentPage]);

  // Automatically fit width on initial load
  useEffect(() => {
    if (!loading && !error && numPages) {
      // Delay slightly to allow container layouts to resolve
      const timer = setTimeout(() => {
        void fitWidth();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [loading, error, numPages, fitWidth]);

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
    }
  };

  const handleNextPage = () => {
    if (numPages && currentPage < numPages) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  const handleZoomIn = () => {
    setScale((prev) => Math.min(2.5, prev + 0.25));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(0.5, prev - 0.25));
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full min-h-[300px] gap-3 bg-muted/5 rounded-xl border border-border/50">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
        <span className="text-xs text-muted-foreground font-medium">Rendering PDF safely...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center w-full h-full min-h-[300px] gap-2 bg-destructive/5 rounded-xl border border-destructive/10">
        <span className="text-sm font-semibold text-destructive">PDF Render Interrupted</span>
        <span className="text-xs text-muted-foreground max-w-sm">{error}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full overflow-hidden bg-muted/10 rounded-xl border border-border/50">
      {/* Control Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card/50 backdrop-blur-md shrink-0">
        {/* Navigation */}
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePrevPage}
            disabled={currentPage <= 1}
            className="h-8 w-8 p-0"
          >
            <ChevronLeft size={16} />
          </Button>
          <span className="text-xs font-semibold text-foreground px-2 min-w-[70px] text-center select-none">
            Page {currentPage} of {numPages || 1}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleNextPage}
            disabled={numPages ? currentPage >= numPages : true}
            className="h-8 w-8 p-0"
          >
            <ChevronRight size={16} />
          </Button>
        </div>

        {/* Zoom and Size Options */}
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleZoomOut}
            disabled={scale <= 0.5}
            className="h-8 w-8 p-0"
            title="Zoom Out"
          >
            <ZoomOut size={15} />
          </Button>
          <span className="text-xs font-semibold text-foreground select-none w-12 text-center">
            {Math.round(scale * 100)}%
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleZoomIn}
            disabled={scale >= 2.5}
            className="h-8 w-8 p-0"
            title="Zoom In"
          >
            <ZoomIn size={15} />
          </Button>
          <div className="w-[1px] h-4 bg-border mx-1" />
          <Button
            variant="ghost"
            size="sm"
            onClick={fitWidth}
            className="h-8 gap-1 px-2 text-[10px] font-semibold uppercase tracking-wider"
            title="Fit to Width"
          >
            <Maximize2 size={13} />
            Fit Width
          </Button>
        </div>
      </div>

      {/* Canvas container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto p-4 flex items-start justify-center bg-muted/20"
      >
        <div className="shadow-lg border border-border/50 bg-background rounded-md overflow-hidden select-none">
          <canvas ref={canvasRef} className="block bg-background" />
        </div>
      </div>
    </div>
  );
}
