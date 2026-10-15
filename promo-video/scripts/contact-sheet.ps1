param(
  [Parameter(Mandatory)][string]$Pattern,
  [Parameter(Mandatory)][string]$Out,
  [int]$Columns = 3,
  [int]$CellWidth = 640
)
# Tiles rendered stills into one labelled image for quick review.
Add-Type -AssemblyName System.Drawing
$files = Get-ChildItem $Pattern | Sort-Object { [int]($_.BaseName -replace '\D', '') }
if (-not $files) { throw "No files match $Pattern" }
$first = [System.Drawing.Image]::FromFile($files[0].FullName)
$cellHeight = [int]($CellWidth * $first.Height / $first.Width)
$first.Dispose()
$rows = [Math]::Ceiling($files.Count / $Columns)
$sheet = New-Object System.Drawing.Bitmap ($Columns * $CellWidth), ($rows * $cellHeight)
$g = [System.Drawing.Graphics]::FromImage($sheet)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$labelFont = New-Object System.Drawing.Font 'Segoe UI', 14, ([System.Drawing.FontStyle]::Bold)
for ($i = 0; $i -lt $files.Count; $i++) {
  $img = [System.Drawing.Image]::FromFile($files[$i].FullName)
  $x = ($i % $Columns) * $CellWidth; $y = [Math]::Floor($i / $Columns) * $cellHeight
  $g.DrawImage($img, $x, $y, $CellWidth, $cellHeight)
  $g.FillRectangle([System.Drawing.Brushes]::Black, $x, $y, 150, 26)
  $g.DrawString($files[$i].BaseName, $labelFont, [System.Drawing.Brushes]::Yellow, $x + 4, $y + 2)
  $img.Dispose()
}
$sheet.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
"saved $Out"
