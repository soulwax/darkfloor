// File: packages/audio-adapters/src/web/audioContextManager.ts

interface AudioConnection {
  sourceNode: MediaElementAudioSourceNode;
  audioContext: AudioContext;
  analyser?: AnalyserNode;
  filters?: BiquadFilterNode[];
  gainNode?: GainNode;
  refCount: number;
}

const connectedAudioElements = new WeakMap<HTMLAudioElement, AudioConnection>();
let hasLoggedIOSWarning = false;

export function isIOSDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const userAgent = navigator.userAgent ?? "";
  const isAppleMobile = /iPad|iPhone|iPod/i.test(userAgent);
  const isIPadOS =
    /Macintosh/i.test(userAgent) && navigator.maxTouchPoints > 1;
  return isAppleMobile || isIPadOS;
}

export function shouldBypassWebAudio(): boolean {
  return isIOSDevice();
}

export function getOrCreateAudioConnection(
  audioElement: HTMLAudioElement,
): AudioConnection | null {
  if (shouldBypassWebAudio()) {
    if (!hasLoggedIOSWarning) {
      console.warn(
        "[audioContextManager] Web Audio disabled on iOS to allow background playback",
      );
      hasLoggedIOSWarning = true;
    }
    return null;
  }

  const existing = connectedAudioElements.get(audioElement);
  if (existing) {

    if (existing.audioContext.state !== "closed" && existing.sourceNode) {

      existing.refCount++;
      return existing;
    } else {

      connectedAudioElements.delete(audioElement);
    }
  }

  const AudioContextClass =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioContextClass) {
    console.error("Web Audio API is not supported in this browser");
    return null;
  }

  try {
    const audioContext = new AudioContextClass();
    const sourceNode = audioContext.createMediaElementSource(audioElement);
    const gainNode = audioContext.createGain();
    gainNode.gain.value = 1;

    const connection: AudioConnection = {
      sourceNode,
      audioContext,
      gainNode,
      refCount: 1,
    };

    connectedAudioElements.set(audioElement, connection);

    if (audioContext.state === "suspended") {
      void audioContext.resume();
    }

    sourceNode.connect(gainNode);
    gainNode.connect(audioContext.destination);

    return connection;
  } catch (error) {

    const retryExisting = connectedAudioElements.get(audioElement);
    if (retryExisting) {
      retryExisting.refCount++;
      return retryExisting;
    }

    if (error instanceof DOMException && error.name === "InvalidStateError") {

      return null;
    }

    console.error("Failed to create audio connection:", error);
    return null;
  }
}

export function releaseAudioConnection(audioElement: HTMLAudioElement): void {
  const connection = connectedAudioElements.get(audioElement);
  if (!connection) return;

  connection.refCount--;

  if (connection.refCount <= 0 && !audioElement.src) {
    console.log("[audioContextManager] Cleaning up audio connection (no source loaded)");
    try {

      if (connection.analyser) {
        connection.analyser.disconnect();
      }
      if (connection.gainNode) {
        connection.gainNode.disconnect();
      }
      if (connection.filters && connection.filters.length > 0) {
        connection.filters.forEach((filter) => filter.disconnect());
      }

      if (connection.audioContext.state !== "closed") {
        void connection.audioContext.close();
      }
    } catch (error) {

      console.warn("Error during audio connection cleanup:", error);
    }

    connectedAudioElements.delete(audioElement);
  } else if (connection.refCount <= 0) {
    console.log("[audioContextManager] Keeping connection alive (audio source is loaded)", {
      src: audioElement.src.substring(0, 50) + "...",
      refCount: connection.refCount,
    });
  }
}

export function getAudioConnection(
  audioElement: HTMLAudioElement,
): AudioConnection | undefined {
  return connectedAudioElements.get(audioElement);
}

export function verifyConnectionChain(connection: AudioConnection): boolean {
  try {

    if (!connection.sourceNode) return false;

    if (connection.filters && connection.filters.length > 0) {

    }

    if (connection.analyser) {

    }

    if (connection.audioContext.state === "closed") {
      console.warn("[audioContextManager] Audio context is closed");
      return false;
    }

    return true;
  } catch (error) {
    console.error(
      "[audioContextManager] Error verifying connection chain:",
      error,
    );
    return false;
  }
}

export function ensureConnectionChain(connection: AudioConnection): void {
  try {
    console.log("[audioContextManager] Ensuring connection chain", {
      hasFilters: !!(connection.filters && connection.filters.length > 0),
      hasAnalyser: !!connection.analyser,
      contextState: connection.audioContext.state,
    });

    try {
      connection.sourceNode.disconnect();
    } catch (e) {

      console.debug(
        "[audioContextManager] SourceNode disconnect (expected):",
        e,
      );
    }

    if (connection.analyser) {
      try {
        connection.analyser.disconnect();
      } catch (e) {

        console.debug(
          "[audioContextManager] Analyser disconnect (expected):",
          e,
        );
      }
    }

    if (connection.gainNode) {
      try {
        connection.gainNode.disconnect();
      } catch (e) {

        console.debug(
          "[audioContextManager] GainNode disconnect (expected):",
          e,
        );
      }
    }

    if (connection.filters && connection.filters.length > 0) {
      connection.filters.forEach((filter) => {
        try {
          filter.disconnect();
        } catch (e) {

          console.debug(
            "[audioContextManager] Filter disconnect (expected):",
            e,
          );
        }
      });
    }

    const filters =
      connection.filters && connection.filters.length > 0
        ? connection.filters
        : null;
    let lastNode: AudioNode = connection.sourceNode;

    if (filters) {
      for (const filter of filters) {
        lastNode.connect(filter);
        lastNode = filter;
      }
    }

    if (connection.gainNode) {
      lastNode.connect(connection.gainNode);
      lastNode = connection.gainNode;
    }

    if (connection.analyser) {
      lastNode.connect(connection.analyser);
      connection.analyser.connect(connection.audioContext.destination);
    } else {
      lastNode.connect(connection.audioContext.destination);
    }

    console.log("[audioContextManager] ✅ Chain ready", {
      filterCount: filters ? filters.length : 0,
      hasGain: !!connection.gainNode,
      analyserExists: !!connection.analyser,
      destinationExists: !!connection.audioContext.destination,
    });

    if (connection.audioContext.state === "suspended") {
      console.log(
        "[audioContextManager] ⚠️ Audio context suspended, resuming...",
      );
      void connection.audioContext
        .resume()
        .then(() => {
          console.log("[audioContextManager] ✅ Audio context resumed");
        })
        .catch((err) => {
          console.error(
            "[audioContextManager] ❌ Failed to resume audio context:",
            err,
          );
        });
    }

    console.log("[audioContextManager] ✅ Connection chain verified", {
      contextState: connection.audioContext.state,
    });
  } catch (error) {
    console.error(
      "[audioContextManager] ❌ Error ensuring connection chain:",
      error,
    );

    try {
      connection.sourceNode.disconnect();
      connection.sourceNode.connect(connection.audioContext.destination);
      console.log(
        "[audioContextManager] ✅ Fallback chain: source -> destination",
      );
    } catch (fallbackError) {
      console.error(
        "[audioContextManager] ❌ Fallback chain failed:",
        fallbackError,
      );
    }
  }
}
