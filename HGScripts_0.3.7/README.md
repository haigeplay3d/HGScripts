# HGScripts v0.3.7

HGScripts public export folder.

This folder contains the CEP panel, user docs, and Windows Illustrator .aip acceleration plugin binaries. Ready-to-share Windows artifacts and standalone scripts are grouped under `release/HGScripts_0.3.7` in the repository root.

## Recommended Install

For normal Windows installation, use the [versioned installer EXE](../release/HGScripts_0.3.7/HGScripts-v0.3.7-Setup.exe).

To remove the formal release, close Adobe apps, run the same installer EXE, and select Remove HGScripts. You can also use Windows Apps & Features.

Use the installer EXE for Windows installation. Source folders are provided for inspection; no separate Windows manual-package zip is published.

## Release Notes

- [Changelog](CHANGELOG.md)
- [v0.3.7 release notes](docs/release_notes_0.3.7.md)
- [SHA256 checksums](../release/HGScripts_0.3.7/SHA256SUMS.txt)

## Layout

../release/HGScripts_0.3.7/    Windows installer / uninstaller, install note, checksums, standalone scripts
cep/HGScripts/                 CEP panel
plugins/illustrator-win/       Windows Illustrator unified .aip binaries
docs/                          User docs
tools/windows/                 Windows helper scripts

## Manual Review Or Copy

- CEP panel: cep/HGScripts
- Windows unified .aip binaries: plugins/illustrator-win, grouped by Illustrator year.
- Windows helper scripts: tools/windows
- Standalone scripts: ../release/HGScripts_0.3.7/单独脚本-individualScripts

## Public Boundary

This public export must not contain C++ source, Adobe SDK files, Visual Studio projects, debug symbols, runtime data, memory data, backups, local state, or personal data.