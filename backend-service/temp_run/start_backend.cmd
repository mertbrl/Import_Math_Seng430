@echo off
setlocal

set "BACKEND_ROOT=C:\Users\MertBrsl\Workspace\seng 430\Import_Math_Seng430\backend-service"
set "RUN_SCRIPT=%BACKEND_ROOT%\temp_run\run_backend_forever.cmd"
set "STDOUT_LOG=%BACKEND_ROOT%\temp_run\uvicorn.stdout.log"
set "STDERR_LOG=%BACKEND_ROOT%\temp_run\uvicorn.stderr.log"

if exist "%STDOUT_LOG%" del /q "%STDOUT_LOG%"
if exist "%STDERR_LOG%" del /q "%STDERR_LOG%"
start "imp-ml-backend" /min "%RUN_SCRIPT%"

endlocal
