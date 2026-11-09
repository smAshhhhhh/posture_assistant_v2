$ErrorActionPreference = 'Stop'

$moduleRoot = Join-Path $PSScriptRoot '../modules/posture-camera'
$specification = Get-Content -LiteralPath (Join-Path $moduleRoot 'pose-model.json') -Raw |
  ConvertFrom-Json
$assetRoot = Join-Path $moduleRoot 'android/src/main/assets'
New-Item -ItemType Directory -Path $assetRoot -Force | Out-Null
$modelPath = Join-Path $assetRoot $specification.fileName
$temporaryPath = $modelPath + '.download'
$lockPath = Join-Path $assetRoot 'pose-model-lock.json'

function Test-ModelFile([string] $Path) {
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $false }
  $file = Get-Item -LiteralPath $Path
  if ($file.Length -ne $specification.sizeBytes) { return $false }
  return (Get-FileHash -LiteralPath $Path -Algorithm MD5).Hash.ToLowerInvariant() -eq `
    $specification.md5
}

if (-not (Test-ModelFile $modelPath)) {
  Write-Output '下载 Pose Landmarker Lite float16/1（约 5.8 MB）…'
  Invoke-WebRequest -Uri $specification.url -OutFile $temporaryPath -UseBasicParsing
  if (-not (Test-ModelFile $temporaryPath)) {
    throw '下载内容与官方模型的大小或 MD5 不符，未替换现有模型。'
  }
  Move-Item -LiteralPath $temporaryPath -Destination $modelPath -Force
}

$sha256 = (Get-FileHash -LiteralPath $modelPath -Algorithm SHA256).Hash.ToLowerInvariant()
$fingerprint = [ordered]@{
  name = $specification.name
  version = $specification.version
  sha256 = $sha256
}
$json = $fingerprint | ConvertTo-Json
[IO.File]::WriteAllText($lockPath, $json + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
Write-Output "模型校验通过，SHA-256：$sha256"
