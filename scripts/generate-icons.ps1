param(
  [string]$Source = "icons/source-logo.png"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $Source)) {
  throw "Source logo not found at $Source"
}

Add-Type -AssemblyName System.Drawing

$root = (Resolve-Path ".").Path
$iconsDir = Join-Path $root "icons"
if (-not (Test-Path -LiteralPath $iconsDir)) {
  New-Item -ItemType Directory -Path $iconsDir | Out-Null
}

function Save-IconPng {
  param(
    [System.Drawing.Image]$SourceImage,
    [int]$Size,
    [string]$Output,
    [int]$Padding = 0
  )

  $bitmap = New-Object System.Drawing.Bitmap $Size, $Size
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)

  try {
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.Clear([System.Drawing.Color]::FromArgb(11, 18, 32))

    $available = $Size - ($Padding * 2)
    $scale = [Math]::Min($available / $SourceImage.Width, $available / $SourceImage.Height)
    $width = [int]($SourceImage.Width * $scale)
    $height = [int]($SourceImage.Height * $scale)
    $x = [int](($Size - $width) / 2)
    $y = [int](($Size - $height) / 2)

    $graphics.DrawImage($SourceImage, $x, $y, $width, $height)
    $bitmap.Save((Join-Path $iconsDir $Output), [System.Drawing.Imaging.ImageFormat]::Png)
  }
  finally {
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}

$sourceImage = [System.Drawing.Image]::FromFile((Resolve-Path -LiteralPath $Source).Path)

try {
  Save-IconPng $sourceImage 16 "favicon-16.png"
  Save-IconPng $sourceImage 32 "favicon-32.png"
  Save-IconPng $sourceImage 48 "favicon-48.png"
  Save-IconPng $sourceImage 180 "apple-touch-icon.png"
  Save-IconPng $sourceImage 192 "icon-192.png"
  Save-IconPng $sourceImage 512 "icon-512.png"
  Save-IconPng $sourceImage 192 "icon-maskable-192.png" 28
  Save-IconPng $sourceImage 512 "icon-maskable-512.png" 76
}
finally {
  $sourceImage.Dispose()
}

Write-Host "Generated Foodie icons in $iconsDir"
