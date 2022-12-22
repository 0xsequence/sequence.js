#!/usr/bin/env bash
set -eu

function usage() {
  echo "Usage:"
  echo "  $0 link"
  echo "  $0 unlink"
  exit 1
}

test -z "${1-}" && usage
option="$1"
shift

case "$option" in
  "link")
    ;;
  "unlink")
    ;;
  *)
    echo "$option: no such option"
    usage
    ;;
esac

repo_dir=$(cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && cd .. && pwd)

packages=($repo_dir/packages/*)
for p in "${packages[@]}"
do
  x=$(realpath $p)
  # echo $x
  pnpm link $x
done

exit $?
