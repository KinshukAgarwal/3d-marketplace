import os
import cv2
import numpy as np
import shutil
import argparse
from pathlib import Path
import time
from tqdm import tqdm
import sys

# Try to import Open3D, but provide a fallback if it fails
try:
    import open3d as o3d
    OPEN3D_AVAILABLE = True
except ImportError as e:
    print(f"Warning: Open3D import failed: {e}", file=sys.stderr)
    print("Running in fallback mode without 3D reconstruction", file=sys.stderr)
    OPEN3D_AVAILABLE = False

# Import our modules with error handling
try:
    from .depth_map import process_directory, generate_depth_map
    from .depth_map_visualizer import DepthMapVisualizer
    DEPTH_MODULES_AVAILABLE = True
except ImportError as e:
    print(f"Warning: Depth modules import failed: {e}", file=sys.stderr)
    print("Running in minimal fallback mode", file=sys.stderr)
    DEPTH_MODULES_AVAILABLE = False

# Only import registration if Open3D is available
if OPEN3D_AVAILABLE:
    try:
        from .registration2 import process_frames_to_mesh, create_point_cloud, create_mesh_from_point_cloud, incremental_registration
        REGISTRATION_AVAILABLE = True
    except ImportError as e:
        print(f"Warning: Registration modules import failed: {e}", file=sys.stderr)
        REGISTRATION_AVAILABLE = False
else:
    REGISTRATION_AVAILABLE = False

def ensure_clean_dir(path):
    """Create a new directory or clean existing one."""
    path = Path(path)
    if path.exists():
        shutil.rmtree(path)
    path.mkdir(parents=True, exist_ok=True)

def extract_frames(video_path, skip_frames=10):
    """Extract frames from a video file."""
    if not os.path.exists(video_path):
        print(f"Video file not found: {video_path}")
        return []
    
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"Failed to open video: {video_path}")
        return []
    
    frames = []
    frame_count = 0
    
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        
        if frame_count % skip_frames == 0:
            frames.append(frame)
            
        frame_count += 1
    
    cap.release()
    print(f"Extracted {len(frames)} frames from {frame_count} total frames")
    return frames

def downscale_frame(frame, scale_factor):
    """Downscale a frame by the given factor."""
    if scale_factor == 1.0:
        return frame
    
    width = int(frame.shape[1] * scale_factor)
    height = int(frame.shape[0] * scale_factor)
    return cv2.resize(frame, (width, height), interpolation=cv2.INTER_AREA)

def report_progress(progress, stage):
    """Report progress to stdout for the API to capture."""
    print(f"Progress: {progress}%")
    print(f"Stage: {stage}")
    # Ensure stdout is flushed immediately
    sys.stdout.flush()

def fallback_processing(video_path, base_dir):
    """Fallback processing when Open3D is not available."""
    frames_dir = base_dir / "frames"
    ensure_clean_dir(frames_dir)
    
    report_progress(10, "extracting frames")
    print("Extracting frames from video...")
    frames = extract_frames(video_path, skip_frames=10)
    if not frames:
        print("No frames extracted. Exiting.")
        report_progress(100, "failed")
        return False
    
    # Process and save frames
    report_progress(30, "processing frames")
    print("Processing and saving frames...")
    scale_factor = 0.8
    for i, frame in enumerate(tqdm(frames, desc="Saving frames")):
        # Downscale frame
        frame = downscale_frame(frame, scale_factor)
        # Save frame
        frame_path = frames_dir / f"frame_{i:04d}.jpg"
        cv2.imwrite(str(frame_path), frame)
    
    # Create a simple placeholder file to indicate processing completed
    with open(base_dir / "processing_completed.txt", "w") as f:
        f.write("Processing completed in fallback mode without 3D reconstruction")
    
    report_progress(100, "completed in fallback mode")
    return True

def main():
    # Parse command line arguments
    parser = argparse.ArgumentParser(description='Process video to 3D mesh')
    parser.add_argument('--video', required=True, help='Path to input video file')
    parser.add_argument('--output', required=True, help='Path to output directory')
    parser.add_argument('--job_id', required=True, help='Job ID for tracking')
    args = parser.parse_args()
    
    # Check for required dependencies
    if not OPEN3D_AVAILABLE:
        print("Open3D is not available. Running in fallback mode.")
        base_dir = Path(args.output)
        success = fallback_processing(args.video, base_dir)
        sys.exit(0 if success else 1)
    
    # Continue with normal processing if Open3D is available
    # Video processing parameters
    video_path = args.video
    skip_frames = 80
    scale_factor = 0.8
    
    # Create output directories
    base_dir = Path(args.output)
    frames_dir = base_dir / "frames"
    depth_maps_dir = base_dir / "depth_maps"
    visualizations_dir = base_dir / "visualizations"
    point_clouds_dir = base_dir / "point_clouds"
    
    # Ensure directories exist
    ensure_clean_dir(frames_dir)
    ensure_clean_dir(depth_maps_dir)
    ensure_clean_dir(visualizations_dir)
    ensure_clean_dir(point_clouds_dir)

    report_progress(5, "extracting frames")
    print("Extracting frames from video...")
    frames = extract_frames(video_path, skip_frames)
    if not frames:
        print("No frames extracted. Exiting.")
        report_progress(100, "failed")
        return

    # Process and save frames
    report_progress(10, "processing frames")
    print("Processing and saving frames...")
    processed_frames = []
    for i, frame in enumerate(tqdm(frames, desc="Saving frames")):
        # Downscale frame
        frame = downscale_frame(frame, scale_factor)
        processed_frames.append(frame)
        # Save frame
        frame_path = frames_dir / f"frame_{i:04d}.jpg"
        cv2.imwrite(str(frame_path), frame)
    print(f"Saved {len(frames)} frames to {frames_dir}")

    # Generate depth maps
    report_progress(20, "generating depth maps")
    print("Generating depth maps...")
    start_time = time.time()
    try:
        depth_maps = process_directory(
            input_dir=frames_dir,
            output_dir=depth_maps_dir,
            batch_size=1,  # Process one at a time for stability
            max_workers=1
        )
        if not depth_maps:
            raise Exception("Failed to generate depth maps")
    except Exception as e:
        print(f"Depth map generation failed: {e}")
        report_progress(100, "failed")
        return

    print(f"Depth map generation completed in {time.time() - start_time:.2f} seconds")

    # Generate visualizations
    report_progress(40, "creating visualizations")
    print("Generating depth map visualizations...")
    visualizer = DepthMapVisualizer()
    try:
        visualizer.visualize_batch(
            depth_maps_dir=depth_maps_dir,
            output_dir=visualizations_dir,
            max_workers=2
        )
    except Exception as e:
        print(f"Visualization generation failed: {e}")
        report_progress(100, "failed")
        return

    # Verify depth maps and visualizations
    depth_map_files = list(depth_maps_dir.glob("*.npy"))
    visualization_files = list(visualizations_dir.glob("*.png"))
    if len(depth_map_files) == 0 or len(visualization_files) == 0:
        print("No depth maps or visualizations generated. Exiting.")
        report_progress(100, "failed")
        return

    print(f"Generated {len(visualization_files)} visualizations")

    # Load depth maps
    report_progress(50, "preparing point cloud generation")
    loaded_depth_maps = []
    for depth_map_file in sorted(depth_map_files):
        loaded_depth_maps.append(np.load(str(depth_map_file)))

    # Create camera intrinsic parameters
    intrinsic = o3d.camera.PinholeCameraIntrinsic(
        width=int(frames[0].shape[1] * scale_factor),
        height=int(frames[0].shape[0] * scale_factor),
        fx=500, fy=500,
        cx=int(frames[0].shape[1] * scale_factor) / 2,
        cy=int(frames[0].shape[0] * scale_factor) / 2
    )

    # Generate point clouds first (for visualization and debugging)
    report_progress(60, "generating point clouds")
    print("Generating individual point clouds...")
    point_clouds = []
    for i, (frame, depth_map) in enumerate(tqdm(zip(processed_frames, loaded_depth_maps), 
                                               desc="Creating point clouds", 
                                               total=len(processed_frames))):
        pcd = create_point_cloud(frame, depth_map, intrinsic)
        if pcd is not None and len(pcd.points) > 0:
            point_clouds.append(pcd)
            # Save individual point cloud for inspection
            pcd_path = point_clouds_dir / f"cloud_{i:04d}.ply"
            o3d.io.write_point_cloud(str(pcd_path), pcd)

    if not point_clouds:
        print("No valid point clouds generated. Exiting.")
        report_progress(100, "failed")
        return

    print(f"Generated {len(point_clouds)} point clouds")

    # Generate mesh using the AI-based registration
    report_progress(75, "generating 3D mesh")
    print("Generating mesh using AI-based point cloud registration...")
    start_time = time.time()
    try:
        # Use our AI-enhanced registration process
        mesh = process_frames_to_mesh(
            frames=processed_frames,
            depth_maps=loaded_depth_maps,
            intrinsic=intrinsic,
            depth_scale=1000.0,
            depth_trunc=3.0
        )
        
        if mesh is None:
            print("AI-based mesh generation failed, trying traditional approach...")
            report_progress(80, "trying alternative approach")
            # Fallback to traditional approach if AI method fails
            from registration import incremental_registration
            
            # Determine scale for registration
            diameters = []
            for pcd in point_clouds:
                diameter = np.linalg.norm(
                    np.asarray(pcd.get_max_bound()) - np.asarray(pcd.get_min_bound())
                )
                diameters.append(diameter)

            median_diameter = np.median(diameters)
            voxel_size = median_diameter * 0.01  # Adaptive voxel size
            
            # Register point clouds
            merged_pcd = incremental_registration(point_clouds, voxel_size)
            
            if merged_pcd is not None and len(merged_pcd.points) > 0:
                # Save the merged point cloud
                merged_pcd_path = point_clouds_dir / "merged_cloud.ply"
                o3d.io.write_point_cloud(str(merged_pcd_path), merged_pcd)
                print(f"Saved merged point cloud to {merged_pcd_path}")
                
                # Create mesh from merged point cloud
                mesh = create_mesh_from_point_cloud(merged_pcd, voxel_size)
    except Exception as e:
        print(f"Mesh generation failed: {e}")
        import traceback
        traceback.print_exc()
        report_progress(100, "failed")
        return

    print(f"Mesh generation completed in {time.time() - start_time:.2f} seconds")

    if mesh is not None:
        report_progress(90, "finalizing model")
        # Save the final mesh
        output_mesh_path = point_clouds_dir / "final_mesh.ply"
        o3d.io.write_triangle_mesh(str(output_mesh_path), mesh)
        print(f"Saved final mesh to {output_mesh_path}")
        
        # Also save a simplified version for easier viewing
        simplified_mesh = mesh.simplify_quadric_decimation(100000)
        simplified_mesh_path = point_clouds_dir / "simplified_mesh.ply"
        o3d.io.write_triangle_mesh(str(simplified_mesh_path), simplified_mesh)
        print(f"Saved simplified mesh to {simplified_mesh_path}")
        
        report_progress(100, "completed")
    else:
        print("Failed to generate mesh")
        report_progress(100, "failed")

if __name__ == "__main__":
    main()
