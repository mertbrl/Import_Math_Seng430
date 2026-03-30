@echo off
setlocal

set "BACKEND_ROOT=C:\Users\MertBrsl\Workspace\seng 430\Import_Math_Seng430\backend-service"
set "PROJECT_ROOT=C:\Users\MertBrsl\Workspace\seng 430\Import_Math_Seng430"
set "UV_EXE=C:\Users\MertBrsl\.local\bin\uv.exe"
set "STDOUT_LOG=%BACKEND_ROOT%\temp_run\uvicorn.stdout.log"
set "STDERR_LOG=%BACKEND_ROOT%\temp_run\uvicorn.stderr.log"

set "PYTHONPATH=%BACKEND_ROOT%"
set "UV_CACHE_DIR=%PROJECT_ROOT%\.uv-cache"
set "UV_PYTHON_INSTALL_DIR=%PROJECT_ROOT%\.uv-python"

if not exist "%UV_CACHE_DIR%" mkdir "%UV_CACHE_DIR%"
if not exist "%UV_PYTHON_INSTALL_DIR%" mkdir "%UV_PYTHON_INSTALL_DIR%"

cd /d "%BACKEND_ROOT%"
"%UV_EXE%" run --python 3.12 --with-requirements requirements.txt uvicorn app.main:app --host 127.0.0.1 --port 5001 1>>"%STDOUT_LOG%" 2>>"%STDERR_LOG%"

endlocal
