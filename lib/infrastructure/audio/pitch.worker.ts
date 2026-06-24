import { PitchDetector } from '../../pitch-detector';

let detector: PitchDetector | null = null;

self.onmessage = (event: MessageEvent) => {
  const { type, buffer, sampleRate, rmsThreshold, timestamp } = event.data;

  if (type === 'init') {
    detector = new PitchDetector(sampleRate);
    return;
  }

  if (type === 'process' && detector && buffer) {
    const result = detector.detectPitchWithValidation(buffer, rmsThreshold ?? 0.01);

    // Devolvemos el resultado y el buffer (transferido de vuelta para reuso)
    // Incluimos el timestamp original para mantener la sincronización musical
    // @ts-ignore - self is a worker context
    self.postMessage({ type: 'result', result, buffer, timestamp }, [buffer.buffer]);
  }
};
