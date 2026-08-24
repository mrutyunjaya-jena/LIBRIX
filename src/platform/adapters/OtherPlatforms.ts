import { WebPlatform } from './WebPlatform';
import { PlatformInfo } from '../PlatformInterface';

export class WindowsPlatform extends WebPlatform {
  override readonly platform: PlatformInfo = {
    os: 'windows',
    deviceType: 'desktop',
    isMobile: false,
    isDesktop: true,
    isTouch: false,
    isNative: false,
    version: '1.0.0-windows',
  };
}

export class MacOSPlatform extends WebPlatform {
  override readonly platform: PlatformInfo = {
    os: 'macos',
    deviceType: 'desktop',
    isMobile: false,
    isDesktop: true,
    isTouch: false,
    isNative: false,
    version: '1.0.0-macos',
  };
}

export class AndroidPlatform extends WebPlatform {
  override readonly platform: PlatformInfo = {
    os: 'android',
    deviceType: 'mobile',
    isMobile: true,
    isDesktop: false,
    isTouch: true,
    isNative: false,
    version: '1.0.0-android',
  };
}

export class IOSPlatform extends WebPlatform {
  override readonly platform: PlatformInfo = {
    os: 'ios',
    deviceType: 'mobile',
    isMobile: true,
    isDesktop: false,
    isTouch: true,
    isNative: false,
    version: '1.0.0-ios',
  };
}
