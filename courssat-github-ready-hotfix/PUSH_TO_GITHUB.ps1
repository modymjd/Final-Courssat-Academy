param(
  [string]$SourcePath = (Get-Location).Path,
  [string]$RepoUrl = "https://github.com/modymjd/Final-Courssat-Academy.git"
)

$ErrorActionPreference = "Stop"
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw "Git is not installed. Install Git for Windows, then run this script again."
}
if (-not (Test-Path (Join-Path $SourcePath "docker-compose.prod.yml"))) {
  throw "SourcePath does not look like the Courssat project root: $SourcePath"
}

$gitName = "$(git config --global user.name)".Trim()
$gitEmail = "$(git config --global user.email)".Trim()
if (-not $gitName -or -not $gitEmail) {
  throw "Configure Git identity first: git config --global user.name 'Your Name'; git config --global user.email 'your@email.com'"
}

$parent = Split-Path -Parent (Resolve-Path $SourcePath)
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$target = Join-Path $parent "Final-Courssat-Academy-upload-$stamp"

Write-Host "Cloning $RepoUrl ..." -ForegroundColor Cyan
git clone $RepoUrl $target
if ($LASTEXITCODE -ne 0) { throw "git clone failed. Complete GitHub authentication and retry." }

git -C $target checkout -B main
if ($LASTEXITCODE -ne 0) { throw "Could not prepare main branch." }

Write-Host "Copying the verified source without secrets or generated files..." -ForegroundColor Cyan
$excludeDirs = @(
  ".git", ".agents", "node_modules", "dist", "build", "__pycache__",
  ".pytest_cache", "media", "staticfiles", "logs", "backups", "certbot-conf"
)
$excludeFiles = @(
  ".env", ".env.production", "*.dump", "*.dump.gpg", "*.dump.gpg.sha256",
  "*.pem", "*.key", "*.pyc", ".coverage", "coverage.xml"
)
$arguments = @($SourcePath, $target, "/MIR", "/R:1", "/W:1", "/NFL", "/NDL", "/NJH", "/NJS", "/NP", "/XD") + $excludeDirs + @("/XF") + $excludeFiles
& robocopy @arguments | Out-Null
if ($LASTEXITCODE -gt 7) { throw "robocopy failed with code $LASTEXITCODE" }

# Restore tracked .gitkeep placeholders removed by broad certificate exclusions.
New-Item -ItemType Directory -Force (Join-Path $target "infrastructure/nginx/certbot-conf") | Out-Null
New-Item -ItemType Directory -Force (Join-Path $target "infrastructure/nginx/certbot-www") | Out-Null
New-Item -ItemType File -Force (Join-Path $target "infrastructure/nginx/certbot-conf/.gitkeep") | Out-Null
New-Item -ItemType File -Force (Join-Path $target "infrastructure/nginx/certbot-www/.gitkeep") | Out-Null

# Refuse to continue if obvious production secrets became trackable.
git -C $target add -A
$staged = git -C $target diff --cached --name-only
$forbidden = $staged | Select-String -Pattern '(^|/)(\.env|\.env\.production)$|privkey|fullchain|\.dump(\.gpg)?$|\.pem$|\.key$'
if ($forbidden) {
  Write-Host $forbidden -ForegroundColor Red
  throw "Potential secret files detected. Nothing was pushed."
}

if (-not $staged) {
  Write-Host "Repository already contains the same files; nothing to commit." -ForegroundColor Yellow
} else {
  git -C $target commit -m "Prepare Courssat Academy pilot release"
  if ($LASTEXITCODE -ne 0) { throw "git commit failed." }
}

git -C $target push -u origin main
if ($LASTEXITCODE -ne 0) { throw "git push failed. Check GitHub access and branch protection." }

Write-Host "Uploaded successfully to $RepoUrl" -ForegroundColor Green
Write-Host "Local clean clone: $target"
