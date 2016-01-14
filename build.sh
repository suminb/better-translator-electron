#!/bin/bash

APP_NAME="BetterTranslator"
APP_VERSION="0.1.2"
ELECTRON_VERSION="0.35.1"

electron-packager better-translator-electron $APP_NAME --platform=darwin \
    --arch=x64 --version=$ELECTRON_VERSION \
    --icon=better-translator-electron/assets/app.icns --overwrite
tar zcf $APP_NAME-$APP_VERSION-darwin-x86-64.tgz $APP_NAME-darwin-x64

electron-packager better-translator-electron $APP_NAME --platform=win32 \
    --arch=ia32 --version=$ELECTRON_VERSION \
    --overwrite
zip -q -r $APP_NAME-$APP_VERSION-win32-x86.zip $APP_NAME-win32-ia32

electron-packager better-translator-electron $APP_NAME --platform=win32 \
    --arch=x64 --version=$ELECTRON_VERSION \
    --overwrite
zip -q -r $APP_NAME-$APP_VERSION-win32-x86-64.zip $APP_NAME-win32-x64

electron-packager better-translator-electron $APP_NAME --platform=linux \
    --arch=x64 --version=$ELECTRON_VERSION \
    --overwrite
tar zcf $APP_NAME-$APP_VERSION-linux-x86-64.tgz $APP_NAME-linux-x64
