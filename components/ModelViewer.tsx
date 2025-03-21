import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js';

interface ModelViewerProps {
  modelUrl: string;
}

export function ModelViewer({ modelUrl }: ModelViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (!containerRef.current || !modelUrl) return;
    
    setLoading(true);
    setError(null);
    
    // Setup scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5f5f5);
    
    // Setup camera
    const camera = new THREE.PerspectiveCamera(
      75, 
      containerRef.current.clientWidth / containerRef.current.clientHeight, 
      0.1, 
      1000
    );
    camera.position.z = 5;
    
    // Setup renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    containerRef.current.appendChild(renderer.domElement);
    
    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight2.position.set(-1, 0.5, -1);
    scene.add(directionalLight2);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.3);
    scene.add(hemiLight);
    
    // Add controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    
    // Determine file type and use appropriate loader
    const fileExtension = modelUrl.split('.').pop()?.toLowerCase();

    const loadModel = () => {
      if (!fileExtension) {
        setError("Unknown file format");
        setLoading(false);
        return;
      }
      
      try {
        if (fileExtension === 'gltf' || fileExtension === 'glb') {
          const loader = new GLTFLoader();
          loader.load(
            modelUrl,
            (gltf) => handleLoadedModel(gltf.scene),
            onProgress,
            onError
          );
        } else if (fileExtension === 'obj') {
          const loader = new OBJLoader();
          loader.load(
            modelUrl,
            (obj) => handleLoadedModel(obj),
            onProgress,
            onError
          );
        } else if (fileExtension === 'blend') {
          // For Blender files, we need to check if this is already a converted URL
          // If it contains 'converted/' in the path, it's already been processed
          if (modelUrl.includes('converted/')) {
            // This is a converted .blend file (actually a .glb), so load it with GLTFLoader
            const loader = new GLTFLoader();
            loader.load(
              modelUrl,
              (gltf) => handleLoadedModel(gltf.scene),
              onProgress,
              onError
            );
          } else {
            setError("Blender files require conversion. Please upload through the upload page.");
            setLoading(false);
          }
        } else if (fileExtension === 'stl') {
          const loader = new STLLoader();
          loader.load(
            modelUrl,
            (geometry) => {
              // Create a better material with more realistic properties
              const material = new THREE.MeshPhysicalMaterial({ 
                color: 0x999999,
                metalness: 0.25,
                roughness: 0.6,
                reflectivity: 0.5,
                clearcoat: 0.1,
                clearcoatRoughness: 0.4
              });
              const mesh = new THREE.Mesh(geometry, material);
              handleLoadedModel(mesh);
            },
            onProgress,
            onError
          );
        } else if (fileExtension === 'ply') {
          const loader = new PLYLoader();
          loader.load(
            modelUrl,
            (geometry) => {
              // Check if the geometry has color attributes
              const hasVertexColors = geometry.hasAttribute('color');
              
              // Create appropriate material based on whether colors exist in the model
              const material = hasVertexColors 
                ? new THREE.MeshStandardMaterial({ 
                    vertexColors: true,
                    flatShading: true 
                  }) 
                : new THREE.MeshPhysicalMaterial({ 
                    color: 0x999999,
                    metalness: 0.25,
                    roughness: 0.6
                  });
              
              const mesh = new THREE.Mesh(geometry, material);
              handleLoadedModel(mesh);
            },
            onProgress,
            onError
          );
        } else {
          setError(`Unsupported file format: .${fileExtension}`);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error loading model:', err);
        setError(`Failed to load model: ${err instanceof Error ? err.message : String(err)}`);
        setLoading(false);
      }
    };
    
    const handleLoadedModel = (object: THREE.Object3D) => {
      // Center model
      const box = new THREE.Box3().setFromObject(object);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      
      // Reset model position to center
      object.position.x = -center.x;
      object.position.y = -center.y;
      object.position.z = -center.z;
      
      // Adjust camera
      const maxDim = Math.max(size.x, size.y, size.z);
      camera.position.z = maxDim * 2.5;
      
      scene.add(object);
      setLoading(false);
    };
    
    const onProgress = (xhr: ProgressEvent) => {
      console.log((xhr.loaded / xhr.total) * 100 + '% loaded');
    };
    
    const onError = (err: any) => {
      console.error('Error loading model:', err);
      setError(`Failed to load model: ${err instanceof Error ? err.message : String(err)}`);
      setLoading(false);
    };
    
    loadModel();
    
    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    
    animate();
    
    // Handle resize
    const handleResize = () => {
      if (!containerRef.current) return;
      
      camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    };
    
    window.addEventListener('resize', handleResize);
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (containerRef.current && containerRef.current.contains(renderer.domElement)) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [modelUrl]);
  
  return (
    <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-muted">
      <div ref={containerRef} className="w-full h-full" />
      
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      )}
      
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80">
          <div className="text-center p-4">
            <p className="text-destructive font-medium">Error</p>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}












