import os
import shutil
import subprocess
import sys
from pathlib import Path

def run_command(command, cwd=None):
    print(f"Running: {command}")
    try:
        subprocess.check_call(command, shell=True, cwd=cwd)
    except subprocess.CalledProcessError as e:
        print(f"Error running command: {e}")
        sys.exit(1)

def main():
    # Define paths
    BACKEND_DIR = Path(__file__).parent.absolute()
    PROJECT_ROOT = BACKEND_DIR.parent
    BUILD_DIR = PROJECT_ROOT / "build"
    STATIC_DEST = BACKEND_DIR / "static"
    DIST_DIR = BACKEND_DIR / "dist"

    print(f"Backend Dir: {BACKEND_DIR}")
    print(f"Project Root: {PROJECT_ROOT}")

    # 1. Build React App
    print("\n--- Building React App ---")
    if not (PROJECT_ROOT / "node_modules").exists():
        print("Installing dependencies...")
        run_command("npm install", cwd=PROJECT_ROOT)
    
    # Set CI=false to avoid treating warnings as errors
    env = os.environ.copy()
    env["CI"] = "false"
    # CI=false is set in .env
    # Set PUBLIC_URL to / to override homepage field in package.json
    if os.name == 'nt':
        run_command('cmd /c "set PUBLIC_URL=/&& npm run build"', cwd=PROJECT_ROOT)
    else:
        run_command("PUBLIC_URL=/ npm run build", cwd=PROJECT_ROOT)

    # 2. Prepare Static Files
    print("\n--- Preparing Static Files ---")
    if STATIC_DEST.exists():
        shutil.rmtree(STATIC_DEST)
    
    if not BUILD_DIR.exists():
        print("Error: Build directory not found!")
        sys.exit(1)
        
    shutil.copytree(BUILD_DIR, STATIC_DEST)
    print(f"Copied build to {STATIC_DEST}")

    # 3. Run PyInstaller
    print("\n--- Running PyInstaller ---")
    
    # Check if pyinstaller is installed
    try:
        subprocess.check_call("pyinstaller --version", shell=True)
    except:
        print("Installing PyInstaller...")
        run_command("pip install pyinstaller")

    # PyInstaller Arguments
    # --onefile: Create a single executable
    # --name: Name of the executable
    # --add-data: Include static files (Windows uses ; separator)
    # --hidden-import: Ensure uvicorn dependencies are included
    
    sep = ";" if os.name == 'nt' else ":"
    
    cmd = [
        "pyinstaller",
        "--noconfirm",
        "--onefile",
        "--name", "PV_Dashboard",
        "--add-data", f"static{sep}static",  # Source: static, Dest: static
        "--add-data", f"mb_list.json{sep}.", # Include default mb_list
        "--hidden-import", "uvicorn.logging",
        "--hidden-import", "uvicorn.loops",
        "--hidden-import", "uvicorn.loops.auto",
        "--hidden-import", "uvicorn.protocols",
        "--hidden-import", "uvicorn.protocols.http",
        "--hidden-import", "uvicorn.protocols.http.auto",
        "--hidden-import", "uvicorn.lifespan",
        "--hidden-import", "uvicorn.lifespan.on",
        "--hidden-import", "engineio.async_drivers.threading",
        "--clean",
        "server.py"
    ]
    
    run_command(" ".join(cmd), cwd=BACKEND_DIR)

    print("\n--- Build Complete ---")
    print(f"Executable created at: {DIST_DIR / 'PV_Dashboard.exe'}")
    
    # Copy default config files to dist for convenience (if they don't exist in exe, it will create new ones, but good to have defaults)
    # Actually, server.py expects them in the same dir as exe.
    # Since it's --onefile, the exe is a zip. It unpacks to temp.
    # But our server.py logic uses BASE_DIR = os.path.dirname(sys.executable) for config files.
    # So we should copy config.json to dist/ so it sits next to the exe.
    
    if (BACKEND_DIR / "config.json").exists():
        shutil.copy(BACKEND_DIR / "config.json", DIST_DIR / "config.json")
        print("Copied config.json to dist/")
        
    if (BACKEND_DIR / "mb_list.json").exists():
        shutil.copy(BACKEND_DIR / "mb_list.json", DIST_DIR / "mb_list.json")
        print("Copied mb_list.json to dist/")

if __name__ == "__main__":
    main()
