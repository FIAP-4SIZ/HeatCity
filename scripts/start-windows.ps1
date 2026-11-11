$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$started = @()
function Run-Checked([string]$program, [string[]]$arguments) {
    & $program @arguments
    if ($LASTEXITCODE -ne 0) { throw "Falha ao executar $program (codigo $LASTEXITCODE)." }
}
function Python-Is312([string]$program, [string[]]$prefixArgs) {
    try {
        & $program @prefixArgs -c 'import sys; sys.exit(0 if sys.version_info[:2] == (3,12) else 1)' 2>$null
        return $LASTEXITCODE -eq 0
    } catch { return $false }
}
function Wait-Service([string]$url, [string]$kind) {
    for ($i = 0; $i -lt 60; $i++) {
        try {
            $response = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 2
            if ($kind -eq 'api') {
                $json = $response.Content | ConvertFrom-Json
                if ($json.service -eq 'HeatCity' -and $json.status -eq 'ok') { return }
            } elseif ($response.Content -match 'HeatCity') { return }
        } catch {}
        Start-Sleep -Milliseconds 500
    }
    throw "Servico nao respondeu: $url. Veja a janela de logs."
}
function Assert-FreePort([int]$port) {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $port)
    try { $listener.Start() } catch { throw "Porta $port ocupada. Feche a instancia anterior antes de iniciar novamente." }
    finally { $listener.Stop() }
}
function Install-Prerequisite([string]$id) {
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        throw 'Instale ou atualize App Installer na Microsoft Store para disponibilizar winget e execute novamente.'
    }
    Write-Host "Instalando $id pelo winget..." -ForegroundColor Cyan
    Run-Checked 'winget' @('install','--id',$id,'--exact','--source','winget','--accept-package-agreements','--accept-source-agreements')
    $env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
}
function Node-IsReady {
    if (-not (Get-Command node -ErrorAction SilentlyContinue) -or -not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) { return $false }
    try {
        $nodeVersion = (& node --version 2>$null)
        if ($LASTEXITCODE -ne 0) { return $false }
        if ([version]($nodeVersion.Trim().TrimStart('v')) -lt [version]'22.12.0') { return $false }
        & npm.cmd --version 2>$null | Out-Null
        return $LASTEXITCODE -eq 0
    } catch { return $false }
}
function Ensure-Node {
    if (Node-IsReady) { Write-Host 'Node.js e npm existentes verificados.'; return }
    # Refresh the current process too: an installer may have updated PATH earlier.
    $originalPath = $env:Path
    $env:Path = $originalPath + ';' + [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
    if (Node-IsReady) { return }
    $tools = Join-Path $root '.heatcity-tools'
    foreach ($cached in @(Get-ChildItem $tools -Directory -Filter 'node-v24*-win-*' -ErrorAction SilentlyContinue)) {
        $env:Path = $cached.FullName + ';' + $originalPath
        if (Node-IsReady) { Write-Host 'Usando Node.js local do HeatCity.'; return }
    }
    $env:Path = $originalPath
    $architecture = $env:PROCESSOR_ARCHITECTURE
    if ($env:PROCESSOR_ARCHITEW6432) { $architecture = $env:PROCESSOR_ARCHITEW6432 }
    switch ($architecture) {
        'AMD64' { $arch = 'x64' }
        'ARM64' { $arch = 'arm64' }
        default { throw 'Node.js local requer Windows x64 ou ARM64.' }
    }
    Write-Host 'Preparando Node.js 24 LTS local, sem MSI ou alteracao do PATH permanente...' -ForegroundColor Cyan
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
    $base = 'https://nodejs.org/dist/latest-v24.x'
    $manifest = (Invoke-WebRequest -UseBasicParsing "$base/SHASUMS256.txt").Content
    $pattern = '(?m)^([a-fA-F0-9]{64})\s+(node-v24\.\d+\.\d+-win-' + $arch + '\.zip)\s*$'
    $entry = [regex]::Match($manifest, $pattern)
    if (-not $entry.Success) { throw 'Manifesto oficial do Node.js sem ZIP compativel. Nenhum binario sera executado.' }
    $filename = $entry.Groups[2].Value
    # Fetch immutable version URL after resolving the moving LTS manifest.
    $versionName = ($filename -replace '^node-', '' -replace ('-win-' + $arch + '\.zip$'), '')
    $stageDir = Join-Path $tools ([guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $stageDir -Force | Out-Null
    try {
        $archive = Join-Path $stageDir $filename
        Invoke-WebRequest -UseBasicParsing "https://nodejs.org/dist/$versionName/$filename" -OutFile $archive
        if ((Get-FileHash $archive -Algorithm SHA256).Hash -ne $entry.Groups[1].Value) {
            throw 'SHA-256 do Node.js divergente. Download rejeitado.'
        }
        Expand-Archive -LiteralPath $archive -DestinationPath $stageDir
        $directoryName = $filename -replace '\.zip$', ''
        $destination = Join-Path $tools $directoryName
        if (Test-Path $destination) { throw "Pasta local invalida ja existe: $destination. Renomeie-a e tente novamente." }
        Move-Item (Join-Path $stageDir $directoryName) $destination
        $env:Path = $destination + ';' + $originalPath
        if (-not (Node-IsReady)) { throw 'Node.js extraido, mas node/npm nao executaram. Verifique bloqueios do Windows ou antivirus.' }
        Write-Host "Node.js $versionName e npm prontos (SHA-256 verificado)." -ForegroundColor Green
    } finally {
        Remove-Item -LiteralPath $stageDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}
try {
    Write-Host 'HeatCity - verificando requisitos...' -ForegroundColor Cyan
    if (-not ((Get-Command py -ErrorAction SilentlyContinue) -and (Python-Is312 'py' @('-3.12'))) -and
        -not ((Get-Command python -ErrorAction SilentlyContinue) -and (Python-Is312 'python' @()))) {
        Install-Prerequisite 'Python.Python.3.12'
    }
    Ensure-Node
    $python = $null; $pythonArgs = @()
    if ((Get-Command py -ErrorAction SilentlyContinue) -and (Python-Is312 'py' @('-3.12'))) {
        $python = 'py'; $pythonArgs = @('-3.12')
    } elseif ((Get-Command python -ErrorAction SilentlyContinue) -and (Python-Is312 'python' @())) {
        $python = 'python'
    }
    if (-not $python) { throw 'Instale Python 3.12 (python.org), incluindo o Python Launcher, e execute novamente.' }
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Instale Node.js LTS 24 (nodejs.org), com npm, e execute novamente.' }
    if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) { throw 'npm nao encontrado. Reinstale Node.js LTS com npm e reabra este arquivo.' }
    $version = [version]((& node --version).TrimStart('v'))
    if ($version -lt [version]'22.12.0') { throw 'Atualize Node.js para LTS 24 (minimo 22.12).' }
    Assert-FreePort 8000
    Assert-FreePort 5173
    $venvPython = Join-Path $root '.venv\Scripts\python.exe'
    if ((Test-Path $venvPython) -and -not (Python-Is312 $venvPython @())) {
        throw 'A pasta .venv usa outra versao do Python. Renomeie-a e execute novamente com Python 3.12.'
    }
    if (-not (Test-Path $venvPython)) { Run-Checked $python ($pythonArgs + @('-m','venv','.venv')) }
    Write-Host 'Conferindo dependencias Python...'
    Run-Checked $venvPython @('-m','pip','install','-r','backend/requirements.lock','--disable-pip-version-check')
    Run-Checked $venvPython @('-m','pip','check')
    Write-Host 'Verificando processamento de imagem e relatorios...'
    Run-Checked $venvPython @('-c','import cv2; import numpy; import reportlab')
    Set-Location (Join-Path $root 'frontend')
    $hash = (Get-FileHash 'package-lock.json' -Algorithm SHA256).Hash
    $stamp = 'node_modules/.heatcity-lock'
    if (-not (Test-Path $stamp) -or (Get-Content $stamp -Raw).Trim() -ne $hash) {
        Write-Host 'Instalando dependencias web...'
        Run-Checked 'npm.cmd' @('ci','--no-audit','--no-fund')
        Set-Content $stamp $hash
    } else {
        # Recria os assets locais caso tenham sido removidos.
        Run-Checked 'node' @('scripts/copy-model.mjs')
    }
    if (-not (Test-Path 'public/mediapipe/face_landmarker.task')) {
        Write-Host 'Baixando modelo oficial Face Landmarker para processamento local...'
        try { Run-Checked 'node' @('scripts/install-face-landmarker.mjs') }
        catch { Write-Warning 'Modelo novo indisponivel. Continuando com Face Mesh anterior; confira o detector na tela da camera.' }
    }
    Set-Location $root
    # Janelas separadas preservam logs. Aspas simples protegem caminhos com espacos.
    $safeRoot = $root.Replace("'", "''")
    $safePython = $venvPython.Replace("'", "''")
    $apiCommand = "Set-Location '$safeRoot\backend'; & '$safePython' -m uvicorn heatcity.api:app --host 127.0.0.1 --port 8000"
    $webCommand = "Set-Location '$safeRoot\frontend'; & npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort"
    $started += Start-Process powershell.exe -ArgumentList @('-NoProfile','-NoExit','-Command', $apiCommand) -PassThru
    $started += Start-Process powershell.exe -ArgumentList @('-NoProfile','-NoExit','-Command', $webCommand) -PassThru
    Wait-Service 'http://127.0.0.1:8000/health' 'api'
    Wait-Service 'http://127.0.0.1:5173' 'web'
    Start-Process 'http://127.0.0.1:5173'
    Write-Host 'HeatCity aberto no navegador padrao. Autorize a camera e inicie a calibracao em tela cheia.' -ForegroundColor Green
    Read-Host 'Mantenha esta janela aberta. Pressione ENTER para encerrar os dois servicos'
} catch {
    Write-Host "ERRO: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} finally {
    foreach ($process in $started) {
        # Encerra somente arvores de processos criadas por este launcher.
        if (-not $process.HasExited) { & taskkill.exe /PID $process.Id /T /F 2>$null | Out-Null }
    }
    Set-Location $root
}
