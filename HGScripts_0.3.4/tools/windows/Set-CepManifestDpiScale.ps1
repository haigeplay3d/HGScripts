#Requires -Version 5.1
param(
  [Parameter(Mandatory = $true)] [string] $ManifestPath,

  [double] $Scale,

  [switch] $DryRun
)

$ErrorActionPreference = "Stop"

function Get-SystemDpiScale {
  $dpi = $null

  foreach ($probe in @(
      @{ Path = "HKCU:\Control Panel\Desktop\WindowMetrics"; Name = "AppliedDPI" },
      @{ Path = "HKCU:\Control Panel\Desktop"; Name = "LogPixels" },
      @{ Path = "HKCU:\Control Panel\Desktop\WindowMetrics"; Name = "LogPixels" }
    )) {
    try {
      $value = (Get-ItemProperty -Path $probe.Path -Name $probe.Name -ErrorAction Stop).($probe.Name)
      if ($value -and $value -ge 72 -and $value -le 384) {
        $dpi = [double]$value
        break
      }
    } catch {
    }
  }

  try {
    if (-not $dpi -or $dpi -lt 72 -or $dpi -gt 384) {
      $source = @"
using System;
using System.Runtime.InteropServices;

public static class HgDpiReader {
    [DllImport("user32.dll")]
    public static extern uint GetDpiForSystem();
}
"@
      Add-Type -TypeDefinition $source -ErrorAction SilentlyContinue
      $dpi = [double][HgDpiReader]::GetDpiForSystem()
    }
  } catch {
  }

  if (-not $dpi -or $dpi -lt 72 -or $dpi -gt 384) {
    $dpi = 96.0
  }

  return [Math]::Round(($dpi / 96.0), 2)
}

function Format-Scale {
  param([double] $Value)
  return $Value.ToString("0.##", [System.Globalization.CultureInfo]::InvariantCulture)
}

function Set-ManifestScale {
  param(
    [Parameter(Mandatory = $true)] [string] $Content,
    [Parameter(Mandatory = $true)] [string] $ScaleText
  )

  $lines = $Content -split "\r?\n", -1
  $hasHighDpi = $Content -match "--high-dpi-support=1"
  $output = New-Object System.Collections.Generic.List[string]
  $insertedHighDpi = $hasHighDpi
  $insertedScale = $false

  foreach ($line in $lines) {
    if ($line -match "<Parameter>--force-device-scale-factor=[^<]+</Parameter>") {
      continue
    }

    $output.Add($line)

    if ($line -match "^(?<indent>\s*)<Parameter>--high-dpi-support=1</Parameter>") {
      $indent = $Matches.indent
      $output.Add($indent + "<Parameter>--force-device-scale-factor=$ScaleText</Parameter>")
      $insertedScale = $true
      continue
    }

    if (-not $hasHighDpi -and $line -match "^(?<indent>\s*)<CEFCommandLine>") {
      $indent = $Matches.indent + "  "
      $output.Add($indent + "<Parameter>--high-dpi-support=1</Parameter>")
      $output.Add($indent + "<Parameter>--force-device-scale-factor=$ScaleText</Parameter>")
      $insertedHighDpi = $true
      $insertedScale = $true
    }
  }

  if (-not $insertedHighDpi -or -not $insertedScale) {
    throw "Could not locate CEFCommandLine block for DPI patch."
  }

  return ($output -join "`r`n")
}

if (-not (Test-Path -LiteralPath $ManifestPath)) {
  throw "Manifest not found: $ManifestPath"
}

if (-not $Scale -or $Scale -le 0) {
  $Scale = Get-SystemDpiScale
}

if ($Scale -lt 0.75 -or $Scale -gt 4.0) {
  throw "Unreasonable DPI scale detected: $Scale"
}

$scaleText = Format-Scale -Value $Scale
$manifest = Get-Content -LiteralPath $ManifestPath -Raw -Encoding UTF8
$patched = Set-ManifestScale -Content $manifest -ScaleText $scaleText

if ($DryRun) {
  Write-Host "[dpi] DRY RUN: $ManifestPath -> --force-device-scale-factor=$scaleText"
} else {
  [System.IO.File]::WriteAllText($ManifestPath, $patched, [System.Text.UTF8Encoding]::new($false))
  Write-Host "[dpi] Patched $ManifestPath -> --force-device-scale-factor=$scaleText"
}
