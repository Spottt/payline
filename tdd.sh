#! /bin/bash
DIRECTORY_TO_OBSERVE="."
function block_for_change {
 inotifywait -r \
   -e modify,move,create,delete \
   $DIRECTORY_TO_OBSERVE
}
BUILD_SCRIPT="yarn build"
function build {
 $BUILD_SCRIPT
}
build
while block_for_change; do
 build
done
