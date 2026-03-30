$backendRoot = 'C:\Users\MertBrsl\Workspace\seng 430\Import_Math_Seng430\backend-service'

Set-Location $backendRoot
$env:PYTHONPATH = $backendRoot
$env:UV_CACHE_DIR = 'C:\Users\MertBrsl\Workspace\seng 430\.uv-cache'
$env:UV_PYTHON_INSTALL_DIR = 'C:\Users\MertBrsl\Workspace\seng 430\.uv-python'

uv run --python 3.12 --with-requirements requirements.txt uvicorn app.main:app --host 127.0.0.1 --port 5001
