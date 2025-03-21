import cv2
import torch
import base64
import io
from PIL import Image
from transformers import pipeline
from accelerate.test_utils.testing import get_backend
from concurrent.futures import ThreadPoolExecutor
import numpy as np
from pathlib import Path
from tqdm import tqdm

def initialize_depth_pipeline():
    """Initialize the depth estimation pipeline with proper error handling."""
    try:
        device, _, _ = get_backend()
        checkpoint = "depth-anything/Depth-Anything-V2-Large-hf"
        depth_pipe = pipeline("depth-estimation", model=checkpoint, device=device, trust_repo=True)
        return depth_pipe
    except Exception as e:
        print(f"Error initializing depth pipeline: {str(e)}")
        return None

# Initialize pipeline only once
depth_pipe = initialize_depth_pipeline()
image_cache = {}

def convert_image_to_data_url(image_path):
    """Convert image to data URL format, with caching."""
    try:
        if image_path in image_cache:
            return image_cache[image_path]
        
        with Image.open(image_path) as img:
            # Convert to RGB to ensure compatibility
            img = img.convert('RGB')
            buffer = io.BytesIO()
            img.save(buffer, format="JPEG")
            base64_str = base64.b64encode(buffer.getvalue()).decode("utf-8")
            data_url = f"data:image/jpeg;base64,{base64_str}"
            image_cache[image_path] = data_url
            return data_url
    except Exception as e:
        print(f"Error converting image {image_path}: {str(e)}")
        return None

def generate_depth_map(image_path):
    """Generate depth map for a single image."""
    if depth_pipe is None:
        print("Depth estimation pipeline not initialized")
        return None

    try:
        data_url = convert_image_to_data_url(image_path)
        if data_url is None:
            return None

        with torch.no_grad():
            outputs = depth_pipe(data_url)
            depth_map = outputs["predicted_depth"]
            if hasattr(depth_map, "detach"):
                depth_map = depth_map.detach().cpu().numpy()
            return depth_map

    except Exception as e:
        print(f"Error processing {image_path}: {str(e)}")
        return None

def process_directory(input_dir, output_dir=None, batch_size=1, max_workers=1):
    """Process all images in a directory and save depth maps."""
    if depth_pipe is None:
        print("Depth estimation pipeline not initialized")
        return []

    input_dir = Path(input_dir)
    if output_dir:
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
    
    image_paths = sorted(list(input_dir.glob("*.jpg")) + list(input_dir.glob("*.png")))
    if not image_paths:
        print(f"No images found in {input_dir}")
        return []
    
    print(f"Processing {len(image_paths)} images...")
    depth_maps = []

    # Process images one by one with progress bar
    for image_path in tqdm(image_paths, desc="Generating depth maps"):
        try:
            depth_map = generate_depth_map(image_path)
            if depth_map is not None:
                depth_maps.append(depth_map)
                if output_dir:
                    output_path = output_dir / f"{image_path.stem}_depth.npy"
                    np.save(str(output_path), depth_map)
            else:
                depth_maps.append(None)
        except Exception as e:
            print(f"Error processing {image_path}: {str(e)}")
            depth_maps.append(None)

    # Report success rate
    success_count = sum(1 for dm in depth_maps if dm is not None)
    print(f"Successfully processed {success_count}/{len(image_paths)} images")
    
    return depth_maps

def clear_cache():
    """Clear the image cache."""
    global image_cache
    image_cache = {}
