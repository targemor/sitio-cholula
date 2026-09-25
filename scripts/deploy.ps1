<#
.SYNOPSIS
    Deploy local desactivado: visitcholula.mx se publica solo desde GitHub Actions.

.DESCRIPTION
    El build y la subida a S3 + CloudFront viven en .github/workflows/wp-extract.yml,
    que extrae los datos de WordPress, convierte las imagenes y corre
    scripts/deploy.sh dentro del runner.

    Este archivo se dejo como senal: antes hacia el deploy desde Windows y ya no
    debe usarse. El historico de git conserva la version completa.

.NOTES
    Para lanzar el deploy:
      - GitHub -> pestana Actions -> "WordPress Data Extract" -> Run workflow
      - o el repository_dispatch 'wordpress_update' que dispara WordPress

    Emergencia (fuera de CI, bajo tu responsabilidad):
      bash scripts/deploy.sh --allow-local
#>

Write-Host ""
Write-Host "Deploy local desactivado." -ForegroundColor Red
Write-Host "  visitcholula.mx se publica solo desde GitHub Actions." -ForegroundColor Yellow
Write-Host "  Lanzalo en: Actions -> 'WordPress Data Extract' -> Run workflow"
Write-Host "  (o con el repository_dispatch 'wordpress_update' desde WordPress)."
Write-Host ""
Write-Host "  Emergencia: bash scripts/deploy.sh --allow-local"
Write-Host ""
exit 1
