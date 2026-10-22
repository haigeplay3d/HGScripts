# HGScripts v0.3.5

HGScripts public export folder.

This folder contains the official Windows release artifacts, CEP panel, user docs, and Windows Illustrator .aip acceleration plugin binaries.

## Recommended Install

For normal Windows installation, use the versioned installer EXE in this folder.

To remove the formal release, close Adobe apps and run the uninstaller EXE in this folder.

This GitHub export is not the official one-click installer package. HGScripts no longer publishes a separate Windows manual-package zip.

## Layout

Versioned installer EXE         Windows installer
Uninstaller EXE                 Windows uninstaller
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