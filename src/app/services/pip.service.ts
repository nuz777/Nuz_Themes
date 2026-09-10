import { Injectable, inject, signal, effect } from '@angular/core';
import { AudioService } from './audio.service';
import { AmbientColorService } from './ambient-color.service';

interface WebkitVideo extends HTMLVideoElement {
  webkitSetPresentationMode?(mode: 'picture-in-picture' | 'inline' | 'fullscreen'): void;
}

const CANVAS_SIZE = 640;

@Injectable({ providedIn: 'root' })
export class PiPService {
  private readonly audio = inject(AudioService);
  private readonly ambient = inject(AmbientColorService);

  readonly active = signal(false);

  private video: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private context: CanvasRenderingContext2D | null = null;
  private canvasStream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private master: GainNode | null = null;
  private streamGain: MediaStreamAudioDestinationNode | null = null;
  private cover: HTMLImageElement | null = null;
  private coverColor = '#202020';
  private rafId = 0;
  private pipEnabled = false;
  private graphReady = false;

  get isBrowser(): boolean {
    return typeof document !== 'undefined' && typeof window !== 'undefined';
  }

  constructor() {
    if (!this.isBrowser) return;

    effect(() => {
      const track = this.audio.currentTrack();
      if (track) {
        this.syncTrack(track.cover);
      }
    });
  }

  get supported(): boolean {
    if (!this.isBrowser) return false;
    return (
      !!document.pictureInPictureEnabled ||
      typeof (document.createElement('video') as WebkitVideo).webkitSetPresentationMode ===
        'function'
    );
  }

  async enter(): Promise<void> {
    if (!this.supported || this.active()) return;

    const graph = this.ensureGraph();
    if (!graph) return;

    try {
      await graph.audioCtx.resume();
      this.buildPiPEnvironment();
      this.switchAudioRoute(true);
      this.pipEnabled = true;
      this.active.set(true);

      this.video!.muted = false;
      this.redrawCover();
      await this.video!.play();

      if (document.pictureInPictureEnabled && document.pictureInPictureElement !== this.video) {
        await this.video!.requestPictureInPicture();
      } else if ((this.video as WebkitVideo).webkitSetPresentationMode) {
        (this.video as WebkitVideo).webkitSetPresentationMode?.('picture-in-picture');
      }

      this.startAnimationLoop();
    } catch (error) {
      this.dispose();
      throw error;
    }
  }

  async exit(): Promise<void> {
    if (!this.active()) return;

    try {
      this.video!.pause();
      if ((this.video as WebkitVideo).webkitSetPresentationMode) {
        (this.video as WebkitVideo).webkitSetPresentationMode?.('inline');
      } else if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      }
    } catch {}

    this.dispose();
  }

  private ensureGraph():
    | { audioCtx: AudioContext; source: MediaElementAudioSourceNode }
    | null {
    const element = this.audio.element;
    if (!element || !this.isBrowser) return null;

    if (!this.graphReady) {
      const AudioContextCtor =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return null;

      this.audioCtx = new AudioContextCtor();
      this.source = this.audioCtx.createMediaElementSource(element);
      this.master = this.audioCtx.createGain();
      this.master.gain.value = 1;
      this.streamGain = this.audioCtx.createMediaStreamDestination();

      this.source.connect(this.master);
      this.master.connect(this.audioCtx.destination);
      this.graphReady = true;
    }

    return { audioCtx: this.audioCtx!, source: this.source! };
  }

  private switchAudioRoute(toPip: boolean): void {
    if (!this.audioCtx || !this.source || !this.master || !this.streamGain) return;
    this.source.disconnect();
    if (toPip) {
      this.source.connect(this.streamGain);
    } else {
      this.source.connect(this.master);
    }
  }

  private buildPiPEnvironment(): void {
    if (!this.audioCtx || !this.streamGain || !this.isBrowser) return;

    this.canvas = document.createElement('canvas');
    this.canvas.width = CANVAS_SIZE;
    this.canvas.height = CANVAS_SIZE;
    this.context = this.canvas.getContext('2d');

    this.canvasStream = this.canvas.captureStream(30);
    for (const videoTrack of this.canvasStream.getVideoTracks()) {
      videoTrack.contentHint = 'detail';
    }

    const merged = new MediaStream([
      ...this.canvasStream.getVideoTracks(),
      ...this.streamGain.stream.getAudioTracks(),
    ]);

    this.video = document.createElement('video');
    this.video.style.position = 'fixed';
    this.video.style.left = '-10000px';
    this.video.style.width = '1px';
    this.video.style.height = '1px';
    this.video.playsInline = true;
    this.video.srcObject = merged;

    this.video.addEventListener('leavepictureinpicture', () => this.dispose());
    this.video.addEventListener('enterpictureinpicture', () => this.active.set(true));

    document.body.appendChild(this.video);
  }

  private dispose(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }

    this.switchAudioRoute(false);
    this.pipEnabled = false;
    this.active.set(false);

    if (this.video) {
      this.video.pause();
      this.video.srcObject = null;
      this.video.remove();
      this.video = null;
    }

    this.canvasStream = null;
    this.canvas = null;
    this.context = null;
    this.cover = null;
  }

  private loadCover(url: string, color: string): void {
    this.coverColor = color;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      this.cover = img;
      this.redrawCover();
    };
    img.src = url;
  }

  private redrawCover(): void {
    const ctx = this.context;
    if (!ctx) return;
    const size = CANVAS_SIZE;

    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, size, size);

    const glow = ctx.createRadialGradient(
      size / 2,
      size / 2,
      size * 0.1,
      size / 2,
      size / 2,
      size * 0.7,
    );
    glow.addColorStop(0, this.coverColor);
    glow.addColorStop(1, '#000000');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, size, size);

    if (!this.cover) return;

    const coverSize = size * 0.72;
    const x = (size - coverSize) / 2;
    const y = (size - coverSize) / 2;

    ctx.save();
    this.roundRect(ctx, x, y, coverSize, coverSize, size * 0.06);
    ctx.clip();
    ctx.drawImage(this.cover, x, y, coverSize, coverSize);
    ctx.restore();
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  private startAnimationLoop(): void {
    const animate = (): void => {
      if (this.pipEnabled) {
        this.redrawCover();
        this.rafId = requestAnimationFrame(animate);
      }
    };
    this.rafId = requestAnimationFrame(animate);
  }

  syncTrack(coverUrl: string): void {
    void this.ambient.getColor(coverUrl).then((color) => {
      this.loadCover(coverUrl, color);
    });
  }
}