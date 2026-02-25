import { useRef, useState, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';

/**
 * Hook to control the device flashlight/torch.
 * Uses expo-camera's CameraView with enableTorch prop.
 *
 * Returns:
 * - torchEnabled: current torch state
 * - setTorch: set torch on/off
 * - flash: trigger a flash sequence (blink N times; pass count=-1 for infinite)
 * - stopFlash: stop any ongoing flash sequence
 * - isFlashing: whether currently in a flash sequence
 */
export function useFlashlight() {
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  // Used to cancel an infinite loop mid-cycle
  const stopRequestedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (flashTimeoutRef.current) {
        clearTimeout(flashTimeoutRef.current);
      }
    };
  }, []);

  const setTorch = useCallback((enabled: boolean) => {
    if (!isMountedRef.current) return;
    setTorchEnabled(enabled);
  }, []);

  /**
   * Flash the torch N times with the given interval (ms).
   * Pass count = -1 (or Infinity) for infinite flashing until stopFlash() is called.
   *
   * @param count  Number of flashes; -1 means infinite
   * @param intervalMs Duration of each on/off cycle in ms
   */
  const flash = useCallback(
    async (count: number = 5, intervalMs: number = 200) => {
      if (Platform.OS !== 'android') return;
      if (isFlashing) return;

      stopRequestedRef.current = false;
      setIsFlashing(true);

      const infinite = count < 0;

      const blink = (remaining: number) => {
        // Stop conditions: unmounted, stop requested, or finite count exhausted
        if (!isMountedRef.current || stopRequestedRef.current || (!infinite && remaining <= 0)) {
          setTorchEnabled(false);
          setIsFlashing(false);
          return;
        }

        // Turn on
        setTorchEnabled(true);
        flashTimeoutRef.current = setTimeout(() => {
          if (!isMountedRef.current || stopRequestedRef.current) {
            setTorchEnabled(false);
            setIsFlashing(false);
            return;
          }
          // Turn off
          setTorchEnabled(false);
          flashTimeoutRef.current = setTimeout(() => {
            blink(infinite ? -1 : remaining - 1);
          }, intervalMs / 2);
        }, intervalMs / 2);
      };

      blink(infinite ? -1 : count);
    },
    [isFlashing]
  );

  /**
   * Stop any ongoing flash sequence immediately.
   */
  const stopFlash = useCallback(() => {
    stopRequestedRef.current = true;
    if (flashTimeoutRef.current) {
      clearTimeout(flashTimeoutRef.current);
      flashTimeoutRef.current = null;
    }
    setTorchEnabled(false);
    setIsFlashing(false);
  }, []);

  return {
    torchEnabled,
    setTorch,
    flash,
    stopFlash,
    isFlashing,
  };
}
