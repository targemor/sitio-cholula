<#
.SYNOPSIS
    Build + deploy de visitcholula.mx a S3 + CloudFront con headers de cache correctos.

.DESCRIPTION
    Sube el sitio estatico de Astro a S3 aplicando Cache-Control por tipo de archivo:
      - Assets con hash (_astro/*) e imagenes/video  -> public, max-age=31536000, immutable
      - HTML (nombres estables)                       -> public, max-age=0, must-revalidate
    Luego invalida CloudFront.

    IMPORTANTE sobre 'aws s3 sync':
    'sync' solo escribe el metadato --cache-control en los archivos que realmente sube;
    omite los que considera sin cambios y NO les actualiza los metadatos. Por eso, la
    PRIMERA vez (o si algun objeto quedo sin header) debes correr con -Force, que resube
    todo desde ./dist y sella el Cache-Control en cada objeto. Una vez sellados, los
    deploys normales con 'sync' conservan ese metadato en los archivos omitidos.

.PARAMETER Force
    Reseca (re-sube) TODOS los archivos desde ./dist para garantizar el Cache-Control
    en cada objeto. Usar en el primer deploy o para reparar metadatos. Mas lento.

.PARAMETER SkipBuild
    Omite 'npm run build' y despliega el ./dist existente.

.PARAMETER SkipInvalidation
    No crea la invalidacion de CloudFront.

.EXAMPLE
    # Primer deploy / reparar headers de cache:
    ./scripts/deploy.ps1 -Force

.EXAMPLE
    # Deploy normal (rapido):
    ./scripts/deploy.ps1
#>

[CmdletBinding()]
param(
    [string]$Bucket         = "visit-cholula",
    [string]$DistributionId = "EXCHH9HZ359RZ",
    [string]$DistDir        = "dist",
    [string]$SiteUrl        = "https://visitcholula.mx",
    [switch]$Force,
    [switch]$SkipBuild,
    [switch]$SkipInvalidation
)

$ErrorActionPreference = "Stop"
$immutable = "public, max-age=31536000, immutable"
$revalidate = "public, max-age=0, must-revalidate"

# --- Rutas: correr siempre desde la raiz del proyecto (padre de /scripts) ---
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot
$DistPath = Join-Path $ProjectRoot $DistDir

function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "    $msg" -ForegroundColor Green }
function Write-Warn2($msg){ Write-Host "    $msg" -ForegroundColor Yellow }

# Ejecuta un comando nativo (aws/npm/curl) y aborta si el exit code != 0.
# No usamos 2>&1: en PS 5.1 eso convierte stderr en errores y rompe el exit code.
function Invoke-Native {
    param([Parameter(Mandatory)][string]$Exe, [Parameter(ValueFromRemainingArguments)]$Args)
    & $Exe @Args
    if ($LASTEXITCODE -ne 0) {
        throw "'$Exe $($Args -join ' ')' fallo con exit code $LASTEXITCODE"
    }
}

# --- Verificaciones previas ---
Write-Step "Verificando herramientas"
if (-not (Get-Command aws -ErrorAction SilentlyContinue)) { throw "AWS CLI no encontrado en PATH." }
if (-not $SkipBuild -and -not (Get-Command npm -ErrorAction SilentlyContinue)) { throw "npm no encontrado en PATH." }
Write-Ok "aws: $((Get-Command aws).Source)"

# --- Build ---
if ($SkipBuild) {
    Write-Step "Build omitido (-SkipBuild)"
} else {
    Write-Step "Build (npm run build)"
    Invoke-Native npm run build
    Write-Ok "Build completado"
}

if (-not (Test-Path $DistPath)) { throw "No existe la carpeta de salida: $DistPath" }

$s3 = "s3://$Bucket/"

# --- Subida ---
if ($Force) {
    Write-Step "Modo -Force: podando borrados y resubiendo TODO con headers de cache"

    # 1) Poda objetos que ya no existen en ./dist (sync --delete tambien sube cambios).
    Invoke-Native aws s3 sync $DistPath $s3 --delete

    # 2) Reseca todos los assets (todo menos HTML) como inmutables.
    Invoke-Native aws s3 cp $DistPath $s3 --recursive `
        --exclude "*.html" `
        --cache-control $immutable

    # 3) Reseca el HTML para que revalide.
    Invoke-Native aws s3 cp $DistPath $s3 --recursive `
        --exclude "*" --include "*.html" `
        --cache-control $revalidate

    Write-Ok "Todos los objetos sellados con Cache-Control"
} else {
    Write-Step "Deploy normal (sync en dos pasadas)"

    # 1) Assets inmutables + poda de borrados.
    Invoke-Native aws s3 sync $DistPath $s3 --delete `
        --exclude "*.html" `
        --cache-control $immutable

    # 2) HTML con revalidacion.
    Invoke-Native aws s3 sync $DistPath $s3 `
        --exclude "*" --include "*.html" `
        --cache-control $revalidate

    Write-Ok "Sync completado"
}

# --- Invalidacion CloudFront ---
if ($SkipInvalidation) {
    Write-Step "Invalidacion omitida (-SkipInvalidation)"
} else {
    Write-Step "Invalidando CloudFront ($DistributionId)"
    # "/*" cuenta como UNA sola ruta de invalidacion. Con assets inmutables de nombre
    # unico, en realidad solo el HTML necesita invalidarse, pero "/*" es simple y barato.
    $out = & aws cloudfront create-invalidation --distribution-id $DistributionId --paths "/*"
    if ($LASTEXITCODE -ne 0) { throw "create-invalidation fallo con exit code $LASTEXITCODE" }
    try {
        $inv = ($out | Out-String | ConvertFrom-Json).Invalidation
        Write-Ok "Invalidacion creada: $($inv.Id)  estado: $($inv.Status)"
    } catch {
        Write-Ok "Invalidacion creada."
    }
}

# --- Verificacion de headers ---
Write-Step "Verificando Cache-Control servido por CloudFront"

function Get-CacheControl($url) {
    try {
        $r = Invoke-WebRequest -Uri $url -Method Head -UseBasicParsing -TimeoutSec 20
        return $r.Headers["Cache-Control"]
    } catch {
        return "(error: $($_.Exception.Message))"
    }
}

# Un asset con hash real (tomado del build) y el HTML raiz.
$assetUrl = $null
$firstAsset = Get-ChildItem -Path (Join-Path $DistPath "_astro") -Filter *.js -ErrorAction SilentlyContinue | Select-Object -First 1
if ($firstAsset) { $assetUrl = "$SiteUrl/_astro/$($firstAsset.Name)" }

if ($assetUrl) {
    $cc = Get-CacheControl $assetUrl
    if ($cc -like "*immutable*") { Write-Ok "asset  OK  -> $cc" }
    else { Write-Warn2 "asset  revisar -> '$cc'  ($assetUrl)" }
}

$ccHtml = Get-CacheControl "$SiteUrl/"
if ($ccHtml -like "*must-revalidate*") { Write-Ok "html   OK  -> $ccHtml" }
else { Write-Warn2 "html   revisar -> '$ccHtml'  (la invalidacion puede tardar unos minutos en propagar)" }

Write-Host "`nDeploy finalizado." -ForegroundColor Cyan
