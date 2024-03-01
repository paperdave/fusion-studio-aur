# this runs to push the update to the AUR
cd "$(dirname "$0")"

if [ -z "$1" ]; then
  echo "Usage: $0 <version>"
  exit 1
fi

if ! [ -e "deploy" ]; then
  git clone ssh://aur@aur.archlinux.org/fusion-studio.git deploy
fi

cd deploy
git pull

cp ../PKGBUILD ../.SRCINFO .

git add PKGBUILD .SRCINFO
git commit -m "Update to $1"
git push
