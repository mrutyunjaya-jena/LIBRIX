import { IPlatformServices } from './PlatformInterface';
import { WebPlatform } from './adapters/WebPlatform';
import { LinuxPlatform } from './adapters/LinuxPlatform';
import { WindowsPlatform, MacOSPlatform, AndroidPlatform, IOSPlatform } from './adapters/OtherPlatforms';

let currentPlatformService: IPlatformServices | null = null;

export function getPlatformServices(): IPlatformServices {
  if (currentPlatformService) {
    return currentPlatformService;
  }

  // Detect runtime
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  
  if (/Android/i.test(userAgent)) {
    currentPlatformService = new AndroidPlatform();
  } else if (/iPhone|iPad|iPod/i.test(userAgent)) {
    currentPlatformService = new IOSPlatform();
  } else if (/Macintosh|Mac OS X/i.test(userAgent)) {
    currentPlatformService = new MacOSPlatform();
  } else if (/Windows/i.test(userAgent)) {
    currentPlatformService = new WindowsPlatform();
  } else if (/Linux/i.test(userAgent)) {
    currentPlatformService = new LinuxPlatform();
  } else {
    currentPlatformService = new WebPlatform();
  }

  return currentPlatformService;
}
