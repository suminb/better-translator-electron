#!/bin/bash

APP_NAME="BetterTranslator"
ELECTRON_VERSION="0.35.1"

electron-packager better-translator-electron $APP_NAME --platform=darwin \
    --arch=x64 --version=$ELECTRON_VERSION \
    --icon=better-translator-electron/assets/app.icns --overwrite
electron-packager better-translator-electron $APP_NAME --platform=win32 \
    --arch=x64 --version=$ELECTRON_VERSION \
    --overwrite
electron-packager better-translator-electron $APP_NAME --platform=linux \
    --arch=x64 --version=$ELECTRON_VERSION \
    --overwrite
