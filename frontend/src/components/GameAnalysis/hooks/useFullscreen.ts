import { useCallback, useEffect, useState } from 'react';

// Cross-browser helpers
function isFullscreenEnabled(): boolean
{
  const docEl: any = document.documentElement;
  return !!(
    docEl.requestFullscreen ||
    docEl.webkitRequestFullscreen ||
    docEl.webkitRequestFullScreen ||
    docEl.msRequestFullscreen ||
    docEl.mozRequestFullScreen
  );
}

function getIsFullscreen(): boolean
{
  const doc: any = document;
  return !!(
    doc.fullscreenElement ||
    doc.webkitFullscreenElement ||
    doc.webkitCurrentFullScreenElement ||
    doc.msFullscreenElement ||
    doc.mozFullScreenElement
  );
}

export function useFullscreen()
{
  const [isFullscreen, setIsFullscreen] = useState<boolean>(getIsFullscreen());
  const supported = isFullscreenEnabled();

  const enter = useCallback(async () =>
  {
    if (!supported) return;
    const el: any = document.documentElement;
    if (el.requestFullscreen) await el.requestFullscreen();
    else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
    else if (el.webkitRequestFullScreen) await el.webkitRequestFullScreen();
    else if (el.msRequestFullscreen) await el.msRequestFullscreen();
    else if (el.mozRequestFullScreen) await el.mozRequestFullScreen();
  }, [supported]);

  const exit = useCallback(async () =>
  {
    const doc: any = document;
    if (doc.exitFullscreen) await doc.exitFullscreen();
    else if (doc.webkitExitFullscreen) await doc.webkitExitFullscreen();
    else if (doc.webkitCancelFullScreen) await doc.webkitCancelFullScreen();
    else if (doc.msExitFullscreen) await doc.msExitFullscreen();
    else if (doc.mozCancelFullScreen) await doc.mozCancelFullScreen();
  }, []);

  const toggle = useCallback(async () =>
  {
    if (!supported) return;
    if (!getIsFullscreen()) await enter();
    else await exit();
  }, [supported, enter, exit]);

  useEffect(() =>
  {
    const handler = () => setIsFullscreen(getIsFullscreen());
    document.addEventListener('fullscreenchange', handler);
    document.addEventListener('webkitfullscreenchange', handler as any);
    document.addEventListener('msfullscreenchange', handler as any);
    document.addEventListener('mozfullscreenchange', handler as any);
    return () =>
    {
      document.removeEventListener('fullscreenchange', handler);
      document.removeEventListener('webkitfullscreenchange', handler as any);
      document.removeEventListener('msfullscreenchange', handler as any);
      document.removeEventListener('mozfullscreenchange', handler as any);
    };
  }, []);

  return {
    isFullscreen,
    isSupported: supported,
    enterFullscreen: enter,
    exitFullscreen: exit,
    toggleFullscreen: toggle,
  } as const;
}
