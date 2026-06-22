"use client";

import React, { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import { err, ok, Result } from "neverthrow";

/**
 * API exposed by ScoreViewer for high-performance, imperative control.
 */
export interface ScoreViewerActions {
  loadScore(xmlContent: string): Promise<Result<void, string>>;
  nextStep(): void;
  resetCursor(): void;
  moveToMeasure(measureNumber: number): void;
}

interface ScoreViewerProps {
  zoom?: number;
}

/**
 * ScoreViewer Component
 *
 * Encapsulates OpenSheetMusicDisplay (OSMD) for optimized rendering in React/Next.js.
 * Uses useImperativeHandle to bypass React's render cycle for cursor movements,
 * maintaining 60FPS even with complex scores.
 */
export const ScoreViewer = forwardRef<ScoreViewerActions, ScoreViewerProps>(({ zoom = 100 }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const osmdRef = useRef<any>(null);

  useEffect(() => {
    // Dynamic import to ensure OSMD only loads on the client
    import("opensheetmusicdisplay").then(({ OpenSheetMusicDisplay }) => {
      if (containerRef.current && !osmdRef.current) {
        osmdRef.current = new OpenSheetMusicDisplay(containerRef.current, {
          autoResize: true,
          backend: "svg",
          drawTitle: false,
          drawSubtitle: false,
          drawCompass: true,
          cursorsOptions: [{
            type: 0, // Standard vertical bar
            color: "#22c55e", // Tailwind Emerald-500
            alpha: 0.4,
            follow: true
          }]
        });
      }
    });

    return () => {
      if (osmdRef.current) {
        osmdRef.current.clear();
        osmdRef.current = null;
      }
    };
  }, []);

  useImperativeHandle(ref, () => ({
    async loadScore(xmlContent: string): Promise<Result<void, string>> {
      if (!osmdRef.current) return err("OSMD not initialized on the client.");
      try {
        await osmdRef.current.load(xmlContent);
        osmdRef.current.render();
        osmdRef.current.cursor.show();
        return ok(undefined);
      } catch (e) {
        return err(`MusicXML parsing error: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
    nextStep() {
      if (osmdRef.current?.cursor) {
        osmdRef.current.cursor.next();
      }
    },
    resetCursor() {
      if (osmdRef.current?.cursor) {
        osmdRef.current.cursor.reset();
      }
    },
    moveToMeasure(measureNumber: number) {
      if (osmdRef.current?.cursor) {
        osmdRef.current.cursor.reset();
        // Fast sequential traversal (internal to OSMD, no React re-renders)
        for (let i = 0; i < measureNumber; i++) {
          osmdRef.current.cursor.next();
        }
      }
    }
  }));

  return (
    <div className="w-full overflow-x-auto p-4 bg-background border rounded-xl shadow-inner">
      <div ref={containerRef} className="w-full min-h-[300px]" />
    </div>
  );
});

ScoreViewer.displayName = "ScoreViewer";
