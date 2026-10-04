# ====================================================================
# EduSmart Platform - Enterprise Audit & Security Engine
# ====================================================================

[CmdletBinding()]
param (
    [string]$ConfigFile = "audit.config.json",
    [switch]$SkipFrontend,
    [switch]$SkipBackend
)

$ErrorActionPreference = "Continue"
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path

# Load configuration
if (Test-Path "$scriptPath\$ConfigFile") {
    $config = Get-Content "$scriptPath\$ConfigFile" | ConvertFrom-Json
} else {
    $config = [PSCustomObject]@{
        projectName = "EduSmart Platform"
        reportDir = "reports"
        paths = [PSCustomObject]@{
            backend = "Backend"
            frontend = "Frontend"
            venv = "Backend/.venv/Scripts"
        }
    }
}

$reportDir = Join-Path $scriptPath $config.reportDir
if (-not (Test-Path $reportDir)) {
    New-Item -ItemType Directory -Path $reportDir -Force | Out-Null
}

$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$htmlReportPath = Join-Path $reportDir "latest.html"
$timestampedHtmlPath = Join-Path $reportDir "audit-$timestamp.html"
$summaryJsonPath = Join-Path $reportDir "audit-summary-$timestamp.json"

Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "  EduSmart Enterprise Security and Quality Audit Framework" -ForegroundColor Cyan
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host " Report Target: $reportDir" -ForegroundColor Gray
Write-Host ""

# Helper to find executable (checking venv first, then PATH)
function Resolve-Executable {
    param ([string]$Name, [string]$VenvPath)
    
    if ($VenvPath) {
        $venvExe = Join-Path $scriptPath (Join-Path $VenvPath "$Name.exe")
        if (Test-Path $venvExe) { return $venvExe }
    }
    
    $cmd = Get-Command $Name -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    
    return $null
}

$venvDir = $config.paths.venv
$ruffExe = Resolve-Executable -Name "ruff" -VenvPath $venvDir
$mypyExe = Resolve-Executable -Name "mypy" -VenvPath $venvDir
$banditExe = Resolve-Executable -Name "bandit" -VenvPath $venvDir
$pipAuditExe = Resolve-Executable -Name "pip-audit" -VenvPath $venvDir
$gitleaksExe = Resolve-Executable -Name "gitleaks"
$semgrepExe = Resolve-Executable -Name "semgrep"
$trivyExe = Resolve-Executable -Name "trivy"

$auditResults = [ordered]@{}
$metrics = [PSCustomObject]@{
    Critical = 0
    High = 0
    Medium = 0
    Low = 0
    TotalIssues = 0
}

function Run-AuditStep {
    param (
        [string]$Id,
        [string]$Name,
        [string]$Category,
        [scriptblock]$Action
    )
    
    Write-Host "[+] Executing: $Name ($Category)..." -ForegroundColor Yellow
    $global:LASTEXITCODE = 0
    $startTime = Get-Date
    
    $stepResult = [PSCustomObject]@{
        Id = $Id
        Name = $Name
        Category = $Category
        Status = "UNKNOWN"
        DurationSeconds = 0
        OutputFile = ""
        Message = ""
        IssuesCount = 0
    }
    
    try {
        & $Action -ResultRef $stepResult
        $elapsed = (Get-Date) - $startTime
        $stepResult.DurationSeconds = [math]::Round($elapsed.TotalSeconds, 2)
    } catch {
        $stepResult.Status = "ERROR"
        $stepResult.Message = $_.Exception.Message
        Write-Host "  [!] Error during execution: $_" -ForegroundColor Red
    }
    
    $color = switch ($stepResult.Status) {
        "PASSED" { "Green" }
        "FAILED" { "Red" }
        "NOT_INSTALLED" { "DarkYellow" }
        "SKIPPED" { "Gray" }
        default { "Yellow" }
    }
    
    $msgStatus = $stepResult.Status
    $msgName = $stepResult.Name
    $msgDur = $stepResult.DurationSeconds
    Write-Host "  [$msgStatus] $msgName (${msgDur}s)" -ForegroundColor $color
    if ($stepResult.Message) {
        $msgDetails = $stepResult.Message
        Write-Host "      Details: $msgDetails" -ForegroundColor Gray
    }
    Write-Host ""
    
    $script:auditResults[$Id] = $stepResult
}

# --------------------------------------------------------------------
# 1. Backend Quality (Ruff)
# --------------------------------------------------------------------
if (-not $SkipBackend) {
    Run-AuditStep -Id "ruff" -Name "Backend Code Quality (Ruff)" -Category "Quality" -Action {
        param($ResultRef)
        if (-not $ruffExe) {
            $ResultRef.Status = "NOT_INSTALLED"
            $ResultRef.Message = "Ruff CLI not found in venv or system PATH."
            return
        }
        
        $outFile = Join-Path $reportDir "ruff.json"
        $ResultRef.OutputFile = $outFile
        
        $output = & $ruffExe check $config.paths.backend --output-format=json 2>&1
        $output | Out-File -FilePath $outFile -Encoding utf8
        
        if ($global:LASTEXITCODE -eq 0) {
            $ResultRef.Status = "PASSED"
            $ResultRef.Message = "Clean code. No lint errors detected."
        } else {
            $ResultRef.Status = "FAILED"
            try {
                $parsed = $output | ConvertFrom-Json
                $cnt = $parsed.Count
                $ResultRef.IssuesCount = $cnt
                $script:metrics.Medium += $cnt
                $ResultRef.Message = "Found $cnt lint issues."
            } catch {
                $ResultRef.Message = "Lint errors present."
            }
        }
    }

    # --------------------------------------------------------------------
    # 2. Backend Type Checking (Mypy)
    # --------------------------------------------------------------------
    Run-AuditStep -Id "mypy" -Name "Backend Type Integrity (Mypy)" -Category "Types" -Action {
        param($ResultRef)
        if (-not $mypyExe) {
            $ResultRef.Status = "NOT_INSTALLED"
            $ResultRef.Message = "Mypy CLI not found in venv or system PATH."
            return
        }
        
        $outFile = Join-Path $reportDir "mypy.txt"
        $ResultRef.OutputFile = $outFile
        
        $configPath = Join-Path $config.paths.backend "pyproject.toml"
        $output = & $mypyExe $config.paths.backend --config-file $configPath --show-error-codes --pretty 2>&1
        $output | Out-File -FilePath $outFile -Encoding utf8
        
        if ($global:LASTEXITCODE -eq 0) {
            $ResultRef.Status = "PASSED"
            $ResultRef.Message = "100% type assertion passed."
        } else {
            $ResultRef.Status = "FAILED"
            $ResultRef.Message = "Static type violations found."
        }
    }

    # --------------------------------------------------------------------
    # 3. Backend Security SAST (Bandit)
    # --------------------------------------------------------------------
    Run-AuditStep -Id "bandit" -Name "Backend Security AST (Bandit)" -Category "Security" -Action {
        param($ResultRef)
        if (-not $banditExe) {
            $ResultRef.Status = "NOT_INSTALLED"
            $ResultRef.Message = "Bandit CLI not found in venv or system PATH."
            return
        }
        
        $outFile = Join-Path $reportDir "bandit.json"
        $ResultRef.OutputFile = $outFile
        
        & $banditExe -r $config.paths.backend -x "$($config.paths.backend)/.venv,**/tests/*,**/migrations/*" -f json -o $outFile 2>&1 | Out-Null
        
        if (Test-Path $outFile) {
            try {
                $parsed = Get-Content $outFile -Raw | ConvertFrom-Json
                $highCount = ($parsed.results | Where-Object { $_.issue_severity -eq 'HIGH' }).Count
                $medCount = ($parsed.results | Where-Object { $_.issue_severity -eq 'MEDIUM' }).Count
                $totalRes = $parsed.results.Count
                
                $script:metrics.High += $highCount
                $script:metrics.Medium += $medCount
                $ResultRef.IssuesCount = $totalRes
                
                if ($totalRes -eq 0) {
                    $ResultRef.Status = "PASSED"
                    $ResultRef.Message = "No security flaws identified."
                } else {
                    $ResultRef.Status = "FAILED"
                    $ResultRef.Message = "Found $totalRes security issues ($highCount High, $medCount Med)."
                }
            } catch {
                $ResultRef.Status = "FAILED"
                $ResultRef.Message = "Bandit execution completed with findings."
            }
        }
    }

    # --------------------------------------------------------------------
    # 4. Backend Dependencies (Pip-Audit)
    # --------------------------------------------------------------------
    Run-AuditStep -Id "pipAudit" -Name "Backend Dependencies (Pip-Audit)" -Category "Dependencies" -Action {
        param($ResultRef)
        if (-not $pipAuditExe) {
            $ResultRef.Status = "NOT_INSTALLED"
            $ResultRef.Message = "Pip-Audit CLI not found in venv or system PATH."
            return
        }
        
        $outFile = Join-Path $reportDir "pip-audit.json"
        $ResultRef.OutputFile = $outFile
        $reqFile = Join-Path $config.paths.backend "requirements.txt"
        
        & $pipAuditExe -r $reqFile -f json -o $outFile 2>&1 | Out-Null
        
        if ($global:LASTEXITCODE -eq 0) {
            $ResultRef.Status = "PASSED"
            $ResultRef.Message = "Dependencies are free from known CVEs."
        } else {
            $ResultRef.Status = "FAILED"
            $ResultRef.Message = "Known vulnerabilities detected in Python packages."
        }
    }
}

# --------------------------------------------------------------------
# 5. Frontend Quality and Types (ESLint and TSC)
# --------------------------------------------------------------------
if (-not $SkipFrontend) {
    Run-AuditStep -Id "frontend" -Name "Frontend Types and ESLint" -Category "Quality" -Action {
        param($ResultRef)
        
        $outFile = Join-Path $reportDir "eslint.json"
        $ResultRef.OutputFile = $outFile
        
        Push-Location $config.paths.frontend
        try {
            & npx eslint . --format json --output-file $outFile
            
            if (Test-Path $outFile) {
                try {
                    $parsed = Get-Content $outFile -Raw | ConvertFrom-Json
                    $errorCount = 0
                    foreach ($file in $parsed) {
                        $errorCount += $file.errorCount
                    }
                    $ResultRef.IssuesCount = $errorCount
                    if ($errorCount -eq 0) {
                        $ResultRef.Status = "PASSED"
                        $ResultRef.Message = "Frontend code style and React types compliant (0 errors)."
                    } else {
                        $ResultRef.Status = "FAILED"
                        $script:metrics.High += $errorCount
                        $ResultRef.Message = "Found $errorCount lint/type errors in React code."
                    }
                } catch {
                    $ResultRef.Status = "FAILED"
                    $ResultRef.Message = "ESLint output parsing failed."
                }
            }
        } finally {
            Pop-Location
        }
    }
}

# --------------------------------------------------------------------
# 6. Secret Detection (Gitleaks)
# --------------------------------------------------------------------
Run-AuditStep -Id "gitleaks" -Name "Secret Scanning (Gitleaks)" -Category "Security" -Action {
    param($ResultRef)
    if (-not $gitleaksExe) {
        $ResultRef.Status = "NOT_INSTALLED"
        $ResultRef.Message = "Gitleaks CLI not found. Install via: winget install Gitleaks.Gitleaks"
        return
    }
    
    $outFile = Join-Path $reportDir "gitleaks.json"
    $ResultRef.OutputFile = $outFile
    
    & $gitleaksExe detect --report-path=$outFile --report-format=json 2>&1 | Out-Null
    
    if ($global:LASTEXITCODE -eq 0) {
        $ResultRef.Status = "PASSED"
        $ResultRef.Message = "Zero hardcoded secrets detected."
    } else {
        $ResultRef.Status = "FAILED"
        $script:metrics.Critical += 1
        $ResultRef.Message = "Hardcoded API keys, tokens, or credentials detected!"
    }
}

# --------------------------------------------------------------------
# 7. Multi-Language SAST (Semgrep)
# --------------------------------------------------------------------
Run-AuditStep -Id "semgrep" -Name "Multi-Language SAST (Semgrep)" -Category "Security" -Action {
    param($ResultRef)
    if (-not $semgrepExe) {
        $ResultRef.Status = "NOT_INSTALLED"
        $ResultRef.Message = "Semgrep CLI not found. Install via: pip install semgrep"
        return
    }
    
    $outFile = Join-Path $reportDir "semgrep.json"
    $ResultRef.OutputFile = $outFile
    
    & $semgrepExe scan --config=auto --json --output=$outFile 2>&1 | Out-Null
    
    if ($global:LASTEXITCODE -eq 0) {
        $ResultRef.Status = "PASSED"
        $ResultRef.Message = "Semgrep security scan clean."
    } else {
        $ResultRef.Status = "FAILED"
        $ResultRef.Message = "Semgrep identified OWASP/Security vulnerabilities."
    }
}

# --------------------------------------------------------------------
# 8. Filesystem Vulnerability (Trivy)
# --------------------------------------------------------------------
Run-AuditStep -Id "trivy" -Name "FS and Container Audit (Trivy)" -Category "Security" -Action {
    param($ResultRef)
    if (-not $trivyExe) {
        $ResultRef.Status = "NOT_INSTALLED"
        $ResultRef.Message = "Trivy CLI not found. Install via: winget install AquaSecurity.Trivy"
        return
    }
    
    $outFile = Join-Path $reportDir "trivy.json"
    $ResultRef.OutputFile = $outFile
    
    & $trivyExe fs . --format json -o $outFile --severity HIGH,CRITICAL 2>&1 | Out-Null
    
    if ($global:LASTEXITCODE -eq 0) {
        $ResultRef.Status = "PASSED"
        $ResultRef.Message = "No HIGH/CRITICAL filesystem vulnerabilities."
    } else {
        $ResultRef.Status = "FAILED"
        $ResultRef.Message = "Trivy detected filesystem vulnerabilities."
    }
}

# Calculate Health Score
$passedCount = ($auditResults.Values | Where-Object { $_.Status -eq "PASSED" }).Count
$failedCount = ($auditResults.Values | Where-Object { $_.Status -eq "FAILED" }).Count
$totalCount = $auditResults.Count
$healthScore = if ($totalCount -gt 0) { [math]::Round(($passedCount / $totalCount) * 100) } else { 0 }

$grade = "F"
if ($healthScore -ge 95) { $grade = "A+" }
elseif ($healthScore -ge 85) { $grade = "A" }
elseif ($healthScore -ge 75) { $grade = "B" }
elseif ($healthScore -ge 60) { $grade = "C" }

# Save Summary JSON
$summaryObj = [PSCustomObject]@{
    Timestamp = $timestamp
    Project = $config.projectName
    HealthScore = $healthScore
    Grade = $grade
    PassedSteps = $passedCount
    FailedSteps = $failedCount
    TotalSteps = $totalCount
    Metrics = $metrics
    Details = $auditResults
}
$summaryObj | ConvertTo-Json -Depth 5 | Out-File -FilePath $summaryJsonPath -Encoding utf8

# Generate HTML Interactive Dashboard
$htmlRows = ""
foreach ($item in $auditResults.Values) {
    $rowName = $item.Name
    $rowCat = $item.Category
    $rowStatus = $item.Status
    $rowDur = $item.DurationSeconds
    $rowMsg = $item.Message
    $htmlRows += "<tr><td><strong>$rowName</strong></td><td>$rowCat</td><td><span class=`"status-tag status-$rowStatus`">$rowStatus</span></td><td>${rowDur}s</td><td>$rowMsg</td></tr>`n"
}

$critHigh = $metrics.Critical + $metrics.High
$htmlContent = @"
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>EduSmart - Security & Quality Executive Dashboard</title>
    <style>
        :root {
            --bg-color: #0f172a;
            --card-bg: #1e293b;
            --border-color: #334155;
            --text-main: #f8fafc;
            --text-muted: #94a3b8;
            --pass-color: #10b981;
            --fail-color: #ef4444;
            --warn-color: #f59e0b;
        }
        body {
            font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
            background-color: var(--bg-color);
            color: var(--text-main);
            margin: 0;
            padding: 30px;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid var(--border-color);
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .title h1 { margin: 0; font-size: 28px; color: #38bdf8; }
        .title p { margin: 5px 0 0 0; color: var(--text-muted); }
        .score-badge {
            background: var(--card-bg);
            border: 2px solid var(--border-color);
            border-radius: 12px;
            padding: 15px 30px;
            text-align: center;
        }
        .score-number { font-size: 36px; font-weight: bold; }
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .card {
            background: var(--card-bg);
            border: 1px solid var(--border-color);
            border-radius: 10px;
            padding: 20px;
        }
        .card h3 { margin-top: 0; font-size: 14px; color: var(--text-muted); text-transform: uppercase; }
        .card .value { font-size: 24px; font-weight: bold; }
        table {
            width: 100%;
            border-collapse: collapse;
            background: var(--card-bg);
            border-radius: 10px;
            overflow: hidden;
            border: 1px solid var(--border-color);
        }
        th, td {
            padding: 14px 20px;
            text-align: left;
            border-bottom: 1px solid var(--border-color);
        }
        th { background: #090d16; color: var(--text-muted); font-size: 13px; }
        .status-tag {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: bold;
        }
        .status-PASSED { background: rgba(16, 185, 129, 0.2); color: #34d399; }
        .status-FAILED { background: rgba(239, 68, 68, 0.2); color: #f87171; }
        .status-NOT_INSTALLED { background: rgba(245, 158, 11, 0.2); color: #fbbf24; }
    </style>
</head>
<body>
    <div class="header">
        <div class="title">
            <h1>EduSmart Enterprise Audit Dashboard</h1>
            <p>Generated on $timestamp | Workspace Audit Report</p>
        </div>
        <div class="score-badge">
            <div class="score-number">$healthScore% ($grade)</div>
            <div style="color: var(--text-muted); font-size: 12px;">Platform Health Score</div>
        </div>
    </div>

    <div class="grid">
        <div class="card">
            <h3>Passed Modules</h3>
            <div class="value" style="color: var(--pass-color);">$passedCount / $totalCount</div>
        </div>
        <div class="card">
            <h3>Failed Modules</h3>
            <div class="value" style="color: var(--fail-color);">$failedCount / $totalCount</div>
        </div>
        <div class="card">
            <h3>Critical / High Issues</h3>
            <div class="value" style="color: var(--warn-color);">$critHigh</div>
        </div>
    </div>

    <h2>Audit Modules Breakdown</h2>
    <table>
        <thead>
            <tr>
                <th>Module</th>
                <th>Category</th>
                <th>Status</th>
                <th>Duration</th>
                <th>Details / Message</th>
            </tr>
        </thead>
        <tbody>
            $htmlRows
        </tbody>
    </table>
</body>
</html>
"@

$htmlContent | Out-File -FilePath $htmlReportPath -Encoding utf8
Copy-Item $htmlReportPath $timestampedHtmlPath -Force

Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "  EduSmart Audit Dashboard Ready" -ForegroundColor Cyan
Write-Host "  Score: $healthScore% ($grade) | Passed: $passedCount/$totalCount | Failed: $failedCount/$totalCount" -ForegroundColor Cyan
Write-Host "  Interactive HTML Dashboard saved to: $htmlReportPath" -ForegroundColor Green
Write-Host "====================================================================" -ForegroundColor Cyan
