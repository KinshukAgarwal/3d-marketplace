import numpy as np
import matplotlib.pyplot as plt
import cv2
from pathlib import Path
import os
from concurrent.futures import ThreadPoolExecutor
from functools import partial

class DepthMapVisualizer:
    def __init__(self):
        self.colormaps = {
            'plasma': plt.cm.plasma,
        }
        
    def normalize_depth(self, depth_map):
        depth_min = np.min(depth_map)
        depth_max = np.max(depth_map)
        if depth_max - depth_min == 0:
            return np.zeros_like(depth_map)
        return (depth_map - depth_min) / (depth_max - depth_min)
    
    def apply_colormap(self, depth_map, colormap='plasma'):
        if colormap not in self.colormaps:
            raise ValueError(f"Unsupported colormap: {colormap}")
            
        normalized_depth = self.normalize_depth(depth_map)
        if len(normalized_depth.shape) > 2:
            normalized_depth = normalized_depth[:, :, 0]
            
        colored_map = self.colormaps[colormap](normalized_depth)
        colored_map = (colored_map[:, :, :3] * 255).astype(np.uint8)
        return cv2.cvtColor(colored_map, cv2.COLOR_RGB2BGR)
    
    def add_depth_legend(self, image, min_depth, max_depth):
        height, width = image.shape[:2]
        legend_width = 50
        
        # Create gradient more efficiently
        gradient = np.linspace(1, 0, height)[:, np.newaxis]
        gradient = np.tile(gradient, (1, legend_width))
        
        colored_gradient = self.colormaps['plasma'](gradient)
        colored_gradient = (colored_gradient[:, :, :3] * 255).astype(np.uint8)
        colored_gradient = cv2.cvtColor(colored_gradient, cv2.COLOR_RGB2BGR)
        
        # Add text efficiently
        font = cv2.FONT_HERSHEY_SIMPLEX
        cv2.putText(colored_gradient, f'{max_depth:.2f}m', (5, 25), 
                    font, 0.6, (255, 255, 255), 1)
        cv2.putText(colored_gradient, f'{min_depth:.2f}m', (5, height-10), 
                    font, 0.6, (255, 255, 255), 1)
        
        return np.hstack((image, colored_gradient))
    
    def process_single_depth_map(self, depth_map_path, output_dir):
        try:
            depth_map = np.load(depth_map_path)
            depth_map = np.nan_to_num(depth_map, nan=0.0, posinf=0.0, neginf=0.0)
            
            colored_depth = self.apply_colormap(depth_map, 'plasma')
            min_depth = np.min(depth_map)
            max_depth = np.max(depth_map)
            
            visualization = self.add_depth_legend(colored_depth, min_depth, max_depth)
            
            output_path = output_dir / f"{depth_map_path.stem}_plasma.png"
            cv2.imwrite(str(output_path), visualization)
            return True
        except Exception as e:
            print(f"Error processing {depth_map_path}: {str(e)}")
            return False

    def visualize_batch(self, depth_maps_dir, output_dir, max_workers=4):
        depth_maps_dir = Path(depth_maps_dir)
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        
        depth_map_files = sorted(depth_maps_dir.glob('*.npy'))
        if not depth_map_files:
            print(f"No depth maps found in {depth_maps_dir}")
            return
        
        print(f"Processing {len(depth_map_files)} depth maps...")
        
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            process_func = partial(self.process_single_depth_map, output_dir=output_dir)
            results = list(executor.map(process_func, depth_map_files))
        
        successful = sum(results)
        print(f"Successfully processed {successful}/{len(depth_map_files)} depth maps")
        print(f"Results saved to {output_dir}")

def main():
    visualizer = DepthMapVisualizer()
    depth_maps_dir = Path('results/depth_maps')
    output_dir = Path('results/visualizations')
    
    # Process all depth maps in parallel
    visualizer.visualize_batch(depth_maps_dir, output_dir)

if __name__ == "__main__":
    main()
