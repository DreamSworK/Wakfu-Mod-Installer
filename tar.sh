#!/bin/bash
if [ $(uname -m) == 'x86_64' ]; then m="x86_64"; else m="i386"; fi
tar --no-same-owner --preserve-permissions -zcvf "WakfuModInstaller.linux.$m.tar.gz" "WakfuModInstaller.$m.run"
