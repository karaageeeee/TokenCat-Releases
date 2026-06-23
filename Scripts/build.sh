#!/bin/bash
# =============================================================================
# Scripts/build.sh
#
# TokenCat を release ビルドして TokenCat.app を組み立てる．
#
# 使い方:
#   ./Scripts/build.sh                  # ./TokenCat.app を作成し、TokenCat vol.N.app として公開
#   ./Scripts/build.sh --install        # 上記＋ /Applications にコピー
#   ./Scripts/build.sh --user-install   # 上記＋ ~/Applications にコピー
#   ./Scripts/build.sh --clean          # 先にビルドキャッシュを掃除
#   ./Scripts/build.sh --no-sign        # 署名スキップ（推奨しない）
#   ./Scripts/build.sh --vol 2.1        # 公開名を TokenCat vol.2.1.app に固定
#   ./Scripts/build.sh --no-publish     # TokenCat vol.N.app への公開をスキップ
# =============================================================================
set -euo pipefail

PRODUCT="TokenCat"
EXECUTABLE="${PRODUCT}"
BUILD_DIR=".build/release"
APP_BUNDLE="${PRODUCT}.app"
CONTENTS="${APP_BUNDLE}/Contents"
MACOS="${CONTENTS}/MacOS"
RESOURCES="${CONTENTS}/Resources"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
DIST_DIR="${TOKENCAT_DIST_DIR:-${PROJECT_DIR}}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

info()  { printf "${GREEN}[INFO]${NC} %s\n" "$1"; }
warn()  { printf "${YELLOW}[WARN]${NC} %s\n" "$1"; }
error() { printf "${RED}[ERROR]${NC} %s\n" "$1" >&2; }

usage() {
    cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Build ${PRODUCT}.app from this SwiftPM project.

Options:
  --clean          Clean .build/ before building
  --install        Copy ${PRODUCT}.app to /Applications after building
  --user-install   Copy ${PRODUCT}.app to ~/Applications after building
  --no-sign        Skip codesign (not recommended)
  --vol VERSION    Publish as TokenCat vol.VERSION.app
  --no-publish     Do not copy a versioned app to the TokenCat folder
  -h, --help       Show this help
EOF
}

DO_CLEAN=false
DO_INSTALL=false
DO_USER_INSTALL=false
NO_SIGN=false
DO_PUBLISH=true
PUBLISH_VOL="${TOKENCAT_VOL:-}"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --clean)        DO_CLEAN=true;        shift ;;
        --install)      DO_INSTALL=true;      shift ;;
        --user-install) DO_USER_INSTALL=true; shift ;;
        --no-sign)      NO_SIGN=true;         shift ;;
        --no-publish)   DO_PUBLISH=false;     shift ;;
        --vol)
            if [[ $# -lt 2 ]]; then
                error "--vol requires a version number."
                exit 1
            fi
            PUBLISH_VOL="$2"
            shift 2
            ;;
        -h|--help)      usage; exit 0 ;;
        *) error "Unknown option: $1"; usage; exit 1 ;;
    esac
done

version_gt() {
    local left="$1"
    local right="$2"
    IFS='.' read -r -a left_parts <<< "${left}"
    IFS='.' read -r -a right_parts <<< "${right}"
    local max_len="${#left_parts[@]}"
    if [[ "${#right_parts[@]}" -gt "${max_len}" ]]; then
        max_len="${#right_parts[@]}"
    fi

    for ((i = 0; i < max_len; i++)); do
        local left_num="${left_parts[i]:-0}"
        local right_num="${right_parts[i]:-0}"
        if ((10#${left_num} > 10#${right_num})); then
            return 0
        fi
        if ((10#${left_num} < 10#${right_num})); then
            return 1
        fi
    done

    return 1
}

next_publish_vol() {
    local highest=""
    local app base version
    shopt -s nullglob
    for app in "${DIST_DIR}"/TokenCat\ vol.*.app; do
        base="$(basename "${app}")"
        version="${base#TokenCat vol.}"
        version="${version%.app}"
        if [[ "${version}" =~ ^[0-9]+(\.[0-9]+)*$ ]]; then
            if [[ -z "${highest}" ]] || version_gt "${version}" "${highest}"; then
                highest="${version}"
            fi
        fi
    done
    shopt -u nullglob

    if [[ -z "${highest}" ]]; then
        printf "1"
        return
    fi

    IFS='.' read -r -a parts <<< "${highest}"
    local last_index=$((${#parts[@]} - 1))
    parts[last_index]="$((10#${parts[last_index]} + 1))"
    local next="${parts[0]}"
    for ((i = 1; i < ${#parts[@]}; i++)); do
        next+=".${parts[i]}"
    done
    printf "%s" "${next}"
}

publish_versioned_app() {
    local version="$1"
    local published_app="${DIST_DIR}/${PRODUCT} vol.${version}.app"

    if [[ -e "${published_app}" ]]; then
        error "${published_app} already exists. Pick a new --vol value or remove it manually."
        exit 1
    fi

    cp -R "${APP_BUNDLE}" "${published_app}"
    info "Published ${published_app}"
}

cd "${PROJECT_DIR}"

if ${DO_CLEAN}; then
    info "Cleaning build artifacts..."
    swift package clean
    rm -rf "${APP_BUNDLE}"
fi

info "Building ${PRODUCT} (release)..."
swift build -c release --product "${PRODUCT}"

info "Assembling ${APP_BUNDLE}..."
rm -rf "${APP_BUNDLE}"
mkdir -p "${MACOS}" "${RESOURCES}"
cp "${BUILD_DIR}/${EXECUTABLE}" "${MACOS}/"
cp Resources/Info.plist "${CONTENTS}/"
# Info.plist の CFBundleIconFile=AppIcon は無条件のため、.icns 不在を静かに通さない．
if [[ ! -f Resources/AppIcon.icns ]]; then
    error "Resources/AppIcon.icns が見つかりません。Info.plist の CFBundleIconFile=AppIcon と整合させるため必須です。"
    exit 1
fi
cp Resources/AppIcon.icns "${RESOURCES}/"

if [[ -d Resources/CatFrames ]]; then
    cp -R Resources/CatFrames "${RESOURCES}/"
fi

if [[ -d Sources/TokenCat/Resources ]]; then
    find Sources/TokenCat/Resources -maxdepth 1 -name "*.lproj" -type d -exec cp -R {} "${RESOURCES}/" \;
fi

# MIT 帰属表示の同梱: 本ソフトウェアおよび ccmeter (MIT) 由来部分のライセンス本文と
# 著作権表示を配布バイナリ内に同梱する必要がある．
if [[ -f LICENSE ]]; then
    cp LICENSE "${RESOURCES}/"
else
    error "LICENSE が見つかりません。MIT 帰属表示のため必須です。"
    exit 1
fi

if ! ${NO_SIGN}; then
    info "Code signing ${APP_BUNDLE}..."
    # 注: || true を末尾に入れる必要がある．grep が一致無しで exit 1 を返すと
    # set -euo pipefail の pipefail と errexit が組み合わさってここで script が落ちる．
    #
    # identity の優先順位:
    #   1. Developer ID Application … 配布用。ダウンロード配布では別途 Notarization が必要
    #   2. Apple Development … ローカル実行/開発用。一般配布には使わない
    #   3. なし … ad-hoc 署名にフォールバック
    APPLE_DEV_IDENTITY=$(security find-identity -v -p codesigning 2>/dev/null | grep '"Apple Development' | head -1 | sed -E 's/.*"(.*)"/\1/' || true)
    DEVID_IDENTITY=$(security find-identity -v -p codesigning 2>/dev/null | grep '"Developer ID Application' | head -1 | sed -E 's/.*"(.*)"/\1/' || true)

    if [[ -n "${DEVID_IDENTITY}" ]]; then
        warn "Notarization なしでは Gatekeeper にブロックされる場合があります."
        codesign --force --deep --sign "${DEVID_IDENTITY}" \
            --options runtime \
            "${APP_BUNDLE}"
        info "Signed with: ${DEVID_IDENTITY}"
    elif [[ -n "${APPLE_DEV_IDENTITY}" ]]; then
        warn "Developer ID identity not found; using Apple Development for local testing only."
        codesign --force --deep --sign "${APPLE_DEV_IDENTITY}" \
            --options runtime \
            "${APP_BUNDLE}"
        info "Signed with: ${APPLE_DEV_IDENTITY}"
    else
        warn "No signing identity found; using ad-hoc signature."
        codesign --force --deep --sign - "${APP_BUNDLE}"
        info "Signed with ad-hoc identity"
    fi
fi

if ${DO_INSTALL}; then
    info "Installing to /Applications..."
    rm -rf "/Applications/${APP_BUNDLE}"
    cp -R "${APP_BUNDLE}" "/Applications/"
    info "Installed to /Applications/${APP_BUNDLE}"
fi

if ${DO_USER_INSTALL}; then
    info "Installing to ~/Applications..."
    mkdir -p "${HOME}/Applications"
    rm -rf "${HOME}/Applications/${APP_BUNDLE}"
    cp -R "${APP_BUNDLE}" "${HOME}/Applications/"
    info "Installed to ${HOME}/Applications/${APP_BUNDLE}"
fi

if ${DO_PUBLISH}; then
    if [[ -z "${PUBLISH_VOL}" ]]; then
        PUBLISH_VOL="$(next_publish_vol)"
    fi
    if [[ ! "${PUBLISH_VOL}" =~ ^[0-9]+(\.[0-9]+)*$ ]]; then
        error "Invalid --vol value: ${PUBLISH_VOL}"
        exit 1
    fi
    publish_versioned_app "${PUBLISH_VOL}"
fi

info "Built ${APP_BUNDLE}"
