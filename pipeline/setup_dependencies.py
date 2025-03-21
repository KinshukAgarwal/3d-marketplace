"""
Setup script to install required dependencies for the 3D reconstruction pipeline.
Run this script before using the pipeline.
"""

import subprocess
import sys
import os
import platform

def install_package(package):
    print(f"Installing {package}...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", package])
        return True
    except subprocess.CalledProcessError as e:
        print(f"Failed to install {package}: {e}")
        return False

def main():
    print("Setting up dependencies for 3D reconstruction pipeline...")
    
    # Basic dependencies
    basic_deps = [
        "numpy",
        "opencv-python",
        "tqdm",
        "pillow",
        "transformers",
        "torch",
        "accelerate"
    ]
    
    # Install basic dependencies
    for dep in basic_deps:
        install_package(dep)
    
    # Install Open3D with proper error handling
    system = platform.system()
    if system == "Windows":
        print("Installing Open3D for Windows...")
        try:
            # On Windows, we need to ensure Visual C++ Redistributable is installed
            print("Note: Open3D requires Microsoft Visual C++ Redistributable to be installed.")
            print("If you encounter DLL errors, please install the latest Visual C++ Redistributable from:")
            print("https://aka.ms/vs/17/release/vc_redist.x64.exe")
            
            # Try to install Open3D
            install_package("open3d")
        except Exception as e:
            print(f"Error installing Open3D: {e}")
            print("You can still use the pipeline in fallback mode without 3D reconstruction.")
    else:
        # For Linux/Mac
        install_package("open3d")
    
    print("\nSetup completed!")
    print("If you encounter any issues with Open3D, you can still use the pipeline in fallback mode.")
    print("To test if Open3D is working correctly, run: python -c 'import open3d as o3d; print(o3d.__version__)'")

if __name__ == "__main__":
    main()