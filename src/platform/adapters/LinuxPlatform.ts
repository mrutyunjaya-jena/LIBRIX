import { WebPlatform } from './WebPlatform';
import { PlatformInfo } from '../PlatformInterface';

export class LinuxPlatform extends WebPlatform {
  override readonly platform: PlatformInfo = {
    os: 'linux',
    deviceType: 'desktop',
    isMobile: false,
    isDesktop: true,
    isTouch: false,
    isNative: false,
    version: '1.0.0-linux',
  };
}
