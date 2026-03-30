Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = "C:\Users\MertBrsl\Workspace\seng 430\Import_Math_Seng430\backend-service"
shell.Run """C:\Users\MertBrsl\Workspace\seng 430\Import_Math_Seng430\backend-service\.venv\Scripts\uvicorn.exe"" app.main:app --host 127.0.0.1 --port 5001", 0, False
