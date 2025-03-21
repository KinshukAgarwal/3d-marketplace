import numpy as np
import open3d as o3d
from concurrent.futures import ThreadPoolExecutor
import copy
import cv2
import time
from tqdm import tqdm

def create_point_cloud(color_image, depth_map, intrinsic, depth_scale=1000.0, depth_trunc=3.0):
    """
    Create point cloud from color image and depth map with improved filtering.
    """
    # Apply bilateral filter to depth map to reduce noise while preserving edges
    if depth_map.dtype != np.float32:
        depth_map = depth_map.astype(np.float32)
    
    # Filter out invalid depth values
    depth_mask = (depth_map > 0) & (depth_map < depth_trunc * depth_scale)
    if np.sum(depth_mask) < 100:  # Check if we have enough valid depth points
        return None
    
    # Create RGBD image
    color_o3d = o3d.geometry.Image(color_image)
    depth_o3d = o3d.geometry.Image(depth_map)
    rgbd = o3d.geometry.RGBDImage.create_from_color_and_depth(
        color_o3d, depth_o3d,
        depth_scale=depth_scale,
        depth_trunc=depth_trunc,
        convert_rgb_to_intensity=False
    )
    
    # Create point cloud
    pcd = o3d.geometry.PointCloud.create_from_rgbd_image(rgbd, intrinsic)
    
    # Apply statistical outlier removal with adaptive parameters
    if len(pcd.points) > 0:
        nb_neighbors = min(30, max(10, int(len(pcd.points) / 1000)))
        pcd, _ = pcd.remove_statistical_outlier(nb_neighbors=nb_neighbors, std_ratio=2.0)
    
    return pcd

def preprocess_point_cloud(pcd, voxel_size):
    """
    Improved point cloud preprocessing with adaptive parameters.
    """
    if len(pcd.points) == 0:
        return None, None
    
    # Create a copy to avoid modifying the original
    pcd_down = pcd.voxel_down_sample(voxel_size)
    
    # Check if downsampling produced a valid point cloud
    if len(pcd_down.points) < 10:
        return None, None
    
    # Estimate normals with adaptive parameters
    radius_normal = voxel_size * 2
    max_nn = min(30, len(pcd_down.points))
    pcd_down.estimate_normals(
        o3d.geometry.KDTreeSearchParamHybrid(radius=radius_normal, max_nn=max_nn)
    )
    
    # Compute FPFH features with adaptive parameters
    radius_feature = voxel_size * 5
    max_nn_feature = min(100, len(pcd_down.points))
    pcd_fpfh = o3d.pipelines.registration.compute_fpfh_feature(
        pcd_down,
        o3d.geometry.KDTreeSearchParamHybrid(radius=radius_feature, max_nn=max_nn_feature)
    )
    
    return pcd_down, pcd_fpfh

def execute_global_registration(source_down, target_down, source_fpfh, target_fpfh, voxel_size):
    """
    Improved global registration with adaptive parameters and error handling.
    """
    if source_down is None or target_down is None:
        return None
    
    # Adaptive distance threshold based on point cloud scale
    source_diameter = np.linalg.norm(
        np.asarray(source_down.get_max_bound()) - np.asarray(source_down.get_min_bound())
    )
    target_diameter = np.linalg.norm(
        np.asarray(target_down.get_max_bound()) - np.asarray(target_down.get_min_bound())
    )
    
    # Use the smaller diameter to set the distance threshold
    model_diameter = min(source_diameter, target_diameter)
    distance_threshold = min(voxel_size * 1.5, model_diameter * 0.05)
    
    # Adjust RANSAC parameters based on point cloud size
    point_count = min(len(source_down.points), len(target_down.points))
    max_iterations = min(4000000, max(100000, point_count * 1000))
    max_validation = min(500, max(50, int(point_count * 0.1)))
    
    try:
        result = o3d.pipelines.registration.registration_ransac_based_on_feature_matching(
            source_down, target_down, source_fpfh, target_fpfh,
            True,
            distance_threshold,
            o3d.pipelines.registration.TransformationEstimationPointToPoint(False),
            3,
            [
                o3d.pipelines.registration.CorrespondenceCheckerBasedOnEdgeLength(0.9),
                o3d.pipelines.registration.CorrespondenceCheckerBasedOnDistance(distance_threshold)
            ],
            o3d.pipelines.registration.RANSACConvergenceCriteria(max_iterations, max_validation)
        )
        
        # Validate registration quality
        if result.fitness < 0.1:  # Low fitness indicates poor registration
            print(f"Warning: Low registration fitness: {result.fitness}")
            
        return result
    except Exception as e:
        print(f"Global registration failed: {str(e)}")
        return None

def refine_registration(source, target, initial_transform, voxel_size):
    """
    Improved ICP registration with adaptive parameters and error handling.
    """
    if source is None or target is None or initial_transform is None:
        return None
    
    try:
        # Adaptive distance threshold
        source_diameter = np.linalg.norm(
            np.asarray(source.get_max_bound()) - np.asarray(source.get_min_bound())
        )
        distance_threshold = min(voxel_size * 0.4, source_diameter * 0.02)
        
        # Adjust max iterations based on point cloud size
        point_count = min(len(source.points), len(target.points))
        max_iteration = min(100, max(30, int(point_count / 1000)))
        
        # Use point-to-plane ICP for better convergence
        result = o3d.pipelines.registration.registration_icp(
            source, target, distance_threshold, initial_transform,
            o3d.pipelines.registration.TransformationEstimationPointToPlane(),
            o3d.pipelines.registration.ICPConvergenceCriteria(max_iteration=max_iteration)
        )
        
        # Validate ICP result
        if result.fitness < 0.2:  # Low fitness indicates poor registration
            print(f"Warning: Low ICP fitness: {result.fitness}")
        
        return result
    except Exception as e:
        print(f"ICP refinement failed: {str(e)}")
        return None

def multi_scale_icp(source, target, voxel_sizes=None):
    """
    Improved multi-scale ICP with adaptive voxel sizes and error handling.
    """
    if source is None or target is None:
        return None
    
    # Determine appropriate voxel sizes based on point cloud scale
    if voxel_sizes is None:
        source_diameter = np.linalg.norm(
            np.asarray(source.get_max_bound()) - np.asarray(source.get_min_bound())
        )
        base_voxel_size = source_diameter * 0.01
        voxel_sizes = [base_voxel_size * 4, base_voxel_size * 2, base_voxel_size]
    
    current_transformation = np.identity(4)
    
    for i, voxel_size in enumerate(voxel_sizes):
        # Preprocess point clouds at current scale
        source_down, source_fpfh = preprocess_point_cloud(source, voxel_size)
        target_down, target_fpfh = preprocess_point_cloud(target, voxel_size)
        
        if source_down is None or target_down is None:
            continue
        
        # Global registration for initial alignment only
        if i == 0 and np.allclose(current_transformation, np.identity(4)):
            result = execute_global_registration(
                source_down, target_down,
                source_fpfh, target_fpfh,
                voxel_size
            )
            
            if result is not None:
                current_transformation = result.transformation
        
        # Local refinement at each scale
        result = refine_registration(
            source_down, target_down,
            current_transformation,
            voxel_size
        )
        
        if result is not None:
            current_transformation = result.transformation
    
    # Validate final transformation
    if not np.any(np.isnan(current_transformation)):
        return current_transformation
    else:
        print("Warning: Invalid transformation matrix")
        return np.identity(4)

def evaluate_registration(source, target, transformation, threshold=0.02):
    """
    Evaluate registration quality with detailed metrics.
    """
    if source is None or target is None:
        return {"fitness": 0, "inlier_rmse": float('inf'), "correspondence_set": 0}
    
    try:
        # Adaptive threshold based on point cloud scale
        source_diameter = np.linalg.norm(
            np.asarray(source.get_max_bound()) - np.asarray(source.get_min_bound())
        )
        adaptive_threshold = min(threshold, source_diameter * 0.01)
        
        evaluation = o3d.pipelines.registration.evaluate_registration(
            source, target, adaptive_threshold, transformation
        )
        
        # Additional metrics
        metrics = {
            'fitness': evaluation.fitness,
            'inlier_rmse': evaluation.inlier_rmse,
            'correspondence_set': len(evaluation.correspondence_set),
            'success': evaluation.fitness > 0.3 and evaluation.inlier_rmse < adaptive_threshold * 2
        }
        
        return metrics
    except Exception as e:
        print(f"Evaluation failed: {str(e)}")
        return {"fitness": 0, "inlier_rmse": float('inf'), "correspondence_set": 0, "success": False}

def incremental_registration(pcd_list, voxel_size=None, batch_size=4):
    """
    Improved incremental registration with overlap detection and loop closure.
    """
    if not pcd_list or len(pcd_list) < 2:
        return None if not pcd_list else pcd_list[0]
    
    # Determine appropriate voxel size based on point cloud scale
    if voxel_size is None:
        diameters = []
        for pcd in pcd_list:
            if len(pcd.points) > 0:
                diameter = np.linalg.norm(
                    np.asarray(pcd.get_max_bound()) - np.asarray(pcd.get_min_bound())
                )
                diameters.append(diameter)
        
        if diameters:
            median_diameter = np.median(diameters)
            voxel_size = median_diameter * 0.01
        else:
            voxel_size = 0.05  # Default if we can't determine scale
    
    # Filter out empty point clouds
    valid_pcd_list = [pcd for pcd in pcd_list if pcd is not None and len(pcd.points) > 0]
    if not valid_pcd_list:
        return None
    
    # Initialize with first point cloud
    merged = copy.deepcopy(valid_pcd_list[0])
    transformations = [np.identity(4)]  # Store all transformations for loop closure
    
    # Process remaining point clouds incrementally
    for i in tqdm(range(1, len(valid_pcd_list))):
        current_pcd = valid_pcd_list[i]
        
        # Register current point cloud to merged cloud
        transformation = multi_scale_icp(
            current_pcd, merged,
            voxel_sizes=[voxel_size * 4, voxel_size * 2, voxel_size]
        )
        
        if transformation is None:
            print(f"Warning: Failed to register point cloud {i}")
            continue
        
        # Evaluate registration quality
        metrics = evaluate_registration(current_pcd, merged, transformation, voxel_size * 2)
        
        if metrics["success"]:
            # Apply transformation and merge
            current_transformed = copy.deepcopy(current_pcd)
            current_transformed.transform(transformation)
            merged += current_transformed
            
            # Store transformation for potential loop closure
            transformations.append(transformation)
            
            # Clean up merged point cloud periodically
            if i % batch_size == 0:
                merged = merged.voxel_down_sample(voxel_size)
                merged, _ = merged.remove_statistical_outlier(nb_neighbors=20, std_ratio=2.0)
        else:
            print(f"Warning: Poor registration quality for point cloud {i}, skipping")
    
    # Perform loop closure if we have enough point clouds
    if len(valid_pcd_list) > 10:
        try:
            # Check if first and last point clouds have overlap
            first_pcd = valid_pcd_list[0]
            last_transformed = copy.deepcopy(valid_pcd_list[-1])
            
            # Apply accumulated transformation to last point cloud
            accumulated_transform = np.identity(4)
            for t in transformations[1:]:
                accumulated_transform = accumulated_transform @ t
            
            last_transformed.transform(accumulated_transform)
            
            # Try to register first and last point clouds
            loop_transform = multi_scale_icp(
                last_transformed, first_pcd,
                voxel_sizes=[voxel_size * 4, voxel_size * 2, voxel_size]
            )
            
            if loop_transform is not None:
                metrics = evaluate_registration(last_transformed, first_pcd, loop_transform, voxel_size * 2)
                
                if metrics["success"]:
                    print("Loop closure successful, redistributing error")
                    # Redistribute loop closure error across all transformations
                    # This is a simplified approach - more sophisticated methods exist
                    error_per_transform = np.linalg.inv(accumulated_transform @ loop_transform)
                    error_root = np.identity(4)
                    for i in range(6):  # Approximate 6th root of transformation matrix
                        error_root = error_root @ np.linalg.inv(error_per_transform) ** (1/6)
                    
                    # Rebuild merged point cloud with corrected transformations
                    merged = copy.deepcopy(valid_pcd_list[0])
                    for i in range(1, len(valid_pcd_list)):
                        current_pcd = valid_pcd_list[i]
                        # Apply original transformation with error correction
                        corrected_transform = transformations[i] @ (error_root ** i)
                        current_transformed = copy.deepcopy(current_pcd)
                        current_transformed.transform(corrected_transform)
                        merged += current_transformed
        except Exception as e:
            print(f"Loop closure failed: {str(e)}")
    
    # Final cleanup
    merged = merged.voxel_down_sample(voxel_size)
    merged, _ = merged.remove_statistical_outlier(nb_neighbors=20, std_ratio=2.0)
    
    # Compute normals for better mesh generation
    merged.estimate_normals(
        o3d.geometry.KDTreeSearchParamHybrid(radius=voxel_size * 2, max_nn=30)
    )
    merged.orient_normals_consistent_tangent_plane(k=15)
    
    return merged

def create_mesh_from_point_cloud(pcd, voxel_size=None):
    """
    Create a mesh from point cloud with improved parameters.
    """
    if pcd is None or len(pcd.points) == 0:
        return None
    
    # Determine appropriate parameters based on point cloud scale
    if voxel_size is None:
        diameter = np.linalg.norm(
            np.asarray(pcd.get_max_bound()) - np.asarray(pcd.get_min_bound())
        )
        voxel_size = diameter * 0.005  # 0.5% of diameter
    
    # Ensure normals are computed
    if not pcd.has_normals():
        pcd.estimate_normals(
            o3d.geometry.KDTreeSearchParamHybrid(radius=voxel_size * 2, max_nn=30)
        )
        pcd.orient_normals_consistent_tangent_plane(k=15)
    
    # Use Poisson surface reconstruction with adaptive parameters
    point_density = len(pcd.points) / (
        np.prod(np.asarray(pcd.get_max_bound()) - np.asarray(pcd.get_min_bound()))
    )
    
    # Adjust depth based on point density
    depth = min(12, max(8, int(np.log2(point_density) + 6)))
    
    mesh, densities = o3d.geometry.TriangleMesh.create_from_point_cloud_poisson(
        pcd, depth=depth, width=0, scale=1.1, linear_fit=True
    )
    
    # Filter mesh vertices based on density
    density_colors = np.asarray(densities)
    density_threshold = np.quantile(density_colors, 0.1)  # Remove lowest 10% density vertices
    vertices_to_remove = densities < density_threshold
    mesh.remove_vertices_by_mask(vertices_to_remove)
    
    # Clean up mesh
    mesh.remove_degenerate_triangles()
    mesh.remove_duplicated_triangles()
    mesh.remove_duplicated_vertices()
    mesh.remove_non_manifold_edges()
    
    return mesh

def process_frames_to_mesh(frames, depth_maps, intrinsic, depth_scale=1000.0, depth_trunc=3.0):
    """
    Complete pipeline from frames and depth maps to final mesh.
    """
    # Create point clouds
    point_clouds = []
    for i, (frame, depth_map) in enumerate(zip(frames, depth_maps)):
        pcd = create_point_cloud(frame, depth_map, intrinsic, depth_scale, depth_trunc)
        if pcd is not None and len(pcd.points) > 0:
            point_clouds.append(pcd)
    
    if not point_clouds:
        print("No valid point clouds created")
        return None
    
    # Determine scale for registration
    diameters = []
    for pcd in point_clouds:
        diameter = np.linalg.norm(
            np.asarray(pcd.get_max_bound()) - np.asarray(pcd.get_min_bound())
        )
        diameters.append(diameter)
    
    median_diameter = np.median(diameters)
    voxel_size = median_diameter * 0.01  # Adaptive voxel size
    
    # Register and merge point clouds
    merged_pcd = incremental_registration(point_clouds, voxel_size)
    
    if merged_pcd is None or len(merged_pcd.points) == 0:
        print("Failed to create merged point cloud")
        return None
    
    # Create mesh from merged point cloud
    mesh = create_mesh_from_point_cloud(merged_pcd, voxel_size)
    
    return mesh
