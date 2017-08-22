#!/bin/bash
file="WakfuModInstaller"
if [ $(uname -s) == 'Darwin' ]
then
    ./tools/mac/binarycreator --online-only -c config/config.xml -p packages "$file"
    cp -f "config/Info.plist" "$file.app/Info.plist"
else
    if [ $(uname -m) == 'x86_64' ]; then m="x86_64"; else m="i386"; fi
    binarycreator --online-only -c config/config.modern.xml -p packages "$file.$m.run"
fi
bash ./upx.sh
