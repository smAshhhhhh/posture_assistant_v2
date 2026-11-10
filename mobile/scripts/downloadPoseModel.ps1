$ErrorActionPreference = 'Stop'

$moduleRoot = Join-Path $PSScriptRoot '../modules/posture-camera'
$specification = Get-Content -LiteralPath (Join-Path $moduleRoot 'pose-model.json') -Raw |
  ConvertFrom-Json
$assetRoot = Join-Path $moduleRoot 'android/src/main/assets'
New-Item -ItemType Directory -Path $assetRoot -Force | Out-Null

function Test-ModelFile([string] $Path, $Model) {
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $false }
  $file = Get-Item -LiteralPath $Path
  if ($file.Length -ne $Model.sizeBytes) { return $false }
  return (Get-FileHash -LiteralPath $Path -Algorithm MD5).Hash.ToLowerInvariant() -eq `
    $Model.md5
}

foreach ($model in $specification.models) {
  $modelPath = Join-Path $assetRoot $model.fileName
  $temporaryPath = $modelPath + '.download'
  $lockPath = Join-Path $assetRoot ("pose-model-" + $model.id + "-lock.json")
  if (-not (Test-ModelFile $modelPath $model)) {
    $sizeMb = [Math]::Round($model.sizeBytes / 1000000, 1)
    Write-Output ("Downloading " + $model.name + " " + $model.version + " (" + $sizeMb + " MB)...")
    Invoke-WebRequest -Uri $model.url -OutFile $temporaryPath -UseBasicParsing
    if (-not (Test-ModelFile $temporaryPath $model)) {
      throw ('Model size or MD5 verification failed: ' + $model.id)
    }
    Move-Item -LiteralPath $temporaryPath -Destination $modelPath -Force
  }

  $sha256 = (Get-FileHash -LiteralPath $modelPath -Algorithm SHA256).Hash.ToLowerInvariant()
  $fingerprint = [ordered]@{
    name = $model.name
    version = $model.version
    sha256 = $sha256
  }
  $json = $fingerprint | ConvertTo-Json
  [IO.File]::WriteAllText($lockPath, $json + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
  Write-Output ($model.id + ' verified. SHA-256: ' + $sha256)
}
