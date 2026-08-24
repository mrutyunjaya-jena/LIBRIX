#!/bin/bash
set -e

SDK_DIR="/home/mantu/Android/Sdk"
mkdir -p "$SDK_DIR/cmdline-tools"

echo "=== 1. Downloading Official Android Commandline Tools ==="
if [ ! -d "$SDK_DIR/cmdline-tools/latest" ]; then
  cd "$SDK_DIR"
  curl -o cmdline-tools.zip https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
  unzip -q cmdline-tools.zip
  rm cmdline-tools.zip
  mkdir -p "$SDK_DIR/cmdline-tools/latest"
  mv cmdline-tools/* "$SDK_DIR/cmdline-tools/latest/" 2>/dev/null || true
fi

export JAVA_HOME=/usr/lib/jvm/jdk-17.0.12-oracle-x64
export PATH=$JAVA_HOME/bin:$SDK_DIR/cmdline-tools/latest/bin:$PATH
export ANDROID_HOME=$SDK_DIR

echo "=== 2. Accepting Licenses and Installing SDK Platform 34 & Build Tools ==="
yes | "$SDK_DIR/cmdline-tools/latest/bin/sdkmanager" --sdk_root="$SDK_DIR" --licenses || true
"$SDK_DIR/cmdline-tools/latest/bin/sdkmanager" --sdk_root="$SDK_DIR" "platform-tools" "platforms;android-34" "build-tools;34.0.0"

echo "=== 3. Writing local.properties for Gradle ==="
echo "sdk.dir=$SDK_DIR" > /home/mantu/Documents/PROJECTS/LIBRIX/android/local.properties

echo "=== 4. Building Android Debug APK ==="
cd /home/mantu/Documents/PROJECTS/LIBRIX/android
./gradlew assembleDebug

echo "=== BUILD COMPLETE! ==="
ls -lh /home/mantu/Documents/PROJECTS/LIBRIX/android/app/build/outputs/apk/debug/app-debug.apk
