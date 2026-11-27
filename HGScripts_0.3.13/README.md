# HGScripts v0.3.13

HGScripts public export folder.

This folder contains the official Windows release artifacts, CEP panel, user docs, and Windows Illustrator .aip acceleration plugin binaries.

## Recommended Install

For normal Windows installation, use the versioned installer EXE in this folder.

To remove the formal release, close Adobe apps, run the same installer EXE, and select Remove HGScripts. You can also use Windows Apps & Features.

Use the installer EXE for Windows installation. Source folders are provided for inspection; no separate Windows manual-package zip is published.

## Release Notes

- [Changelog](CHANGELOG.md)
- [v0.3.13 release notes](docs/release_notes_0.3.13.md)
- [SHA256 checksums](SHA256SUMS.txt)

## Layout

Versioned installer EXE         Windows installer / uninstaller
Versioned install note TXT      User install note
cep/HGScripts/                 CEP panel
plugins/illustrator-win/       Windows Illustrator unified .aip binaries
docs/                          User docs
tools/windows/                 Windows helper scripts

## Manual Review Or Copy

- CEP panel: cep/HGScripts
- Windows unified .aip binaries: plugins/illustrator-win, grouped by Illustrator year.
- Windows helper scripts: tools/windows

## Public Boundary

This public export must not contain C++ source, Adobe SDK files, Visual Studio projects, debug symbols, runtime data, memory data, backups, local state, or personal data.