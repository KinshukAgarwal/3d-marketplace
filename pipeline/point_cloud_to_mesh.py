import open3d as o3d
import numpy as np
from concurrent.futures import ThreadPoolExecutor
from functools import partial

def preprocess_point_cloud(pcd, voxel_size=0.05):
    """Preprocess point cloud with downsampling and normal estimation."""
    # Downsample the point cloud
    # pcd_down = pcd.voxel_down_sample(voxel_size)
    pcd_down = pcd.voxel_down_sample(voxel_size)
    
    # Estimate normals with optimized parameters
    pcd_down.estimate_normals(
        search_param=o3d.geometry.KDTreeSearchParamHybrid(
            radius=voxel_size * 2,
            max_nn=30
        )
    )
    return pcd_down

def remove_outliers(pcd, nb_neighbors=20, std_ratio=2.0):
    """Remove statistical outliers from point cloud."""
    cl, ind = pcd.remove_statistical_outlier(
        nb_neighbors=nb_neighbors,
        std_ratio=std_ratio
    )
    return cl

def generate_mesh_from_point_cloud(pcd, depth=9, preprocessing=True):
    """Generate mesh from point cloud with optimized parameters."""
    if preprocessing:
        # Preprocess the point cloud
        pcd = preprocess_point_cloud(pcd)
        pcd = remove_outliers(pcd)
    
    # Create mesh using Poisson reconstruction
    mesh, densities = o3d.geometry.TriangleMesh.create_from_point_cloud_poisson(
        pcd,
        depth=depth,
        width=0,
        scale=1.1,
        linear_fit=False
    )
    
    # Remove low-density vertices
    vertices_to_remove = densities < np.quantile(densities, 0.1)
    mesh.remove_vertices_by_mask(vertices_to_remove)
    
    # Optional mesh cleanup
    mesh.remove_degenerate_triangles()
    mesh.remove_duplicated_triangles()
    mesh.remove_duplicated_vertices()
    mesh.remove_non_manifold_edges()
    
    return mesh

def process_multiple_point_clouds(pcd_list, depth=9, max_workers=4):
    """Process multiple point clouds in parallel."""
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        process_func = partial(generate_mesh_from_point_cloud, depth=depth)
        meshes = list(executor.map(process_func, pcd_list))
    return meshes
