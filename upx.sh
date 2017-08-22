#!/bin/bash
file="WakfuModInstaller"
if [ $(uname -s) == 'Darwin' ]
then
    upx -9 "$file.app/Contents/MacOS/$file"
else
    if [ $(uname -m) == 'x86_64' ]; then m="x86_64"; else m="i386"; fi
    upx -9 "$file.$m.run"
fi
