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
try {
    Write-Host 'HeatCity - verificando requisitos...' -ForegroundColor Cyan
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
