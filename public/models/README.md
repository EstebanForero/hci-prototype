# 3D Model Optimization Guide

## Quick Setup for 30MB GLB Files

### 1. **Immediate Setup** (No Optimization Required)
Place your `washer.glb` file in this directory:
```
public/models/washer.glb
```

### 2. **Enable GLB Model in UI**
Update your component to use the GLB model:
```jsx
<WashingMachine3D
  health={85}
  cyclesRemaining={450}
  isActive={true}
  useCustomModel={true}
  modelUrl="/models/washer.glb"
/>
```

### 3. **Performance Optimization** (Recommended)

#### **Texture Compression** (Biggest Impact)
- Use tools like [TinyPNG](https://tinypng.com/) for textures
- Resize textures to 1024x1024 or 512x512
- Compress with [Basis Universal](https://github.com/BinomialLLC/basis_universal)

#### **Geometry Optimization**
- Use [Blender](https://www.blender.org/) to reduce polygon count
- Target: < 100,000 triangles
- Remove interior/hidden geometry

#### **File Compression**
- **GLTF Pipeline**: `gltf-pipeline -i washer.glb -o washer_compressed.glb --draco`
- **Online Tools**: [GLTF Transform](https://gltf-transform.donmccurdy.com/)

### 4. **Advanced Optimization**

#### **Create LOD Models** (Multiple Quality Levels)
```
washer_low.glb     ~5MB   (mobile/far view)
washer_medium.glb  ~15MB  (desktop/medium view)
washer_high.glb    ~30MB  (desktop/close view)
```

#### **Enable DRACO Compression** (90% Size Reduction)
1. Add DRACO decoder files to `public/draco/`:
   - Download from: https://github.com/google/draco/tree/master/javascript/decoders/draco_wasm_wrapper.js

2. Files needed:
   ```
   public/draco/draco_decoder.wasm
   public/draco/draco_wasm_wrapper.js
   ```

### 5. **Streaming Loading** (Best UX)
The app supports progressive loading:
- Shows placeholder immediately
- Loads low-quality model first
- Streams higher quality versions
- Smooth transitions between LODs

## File Size Guidelines
- 🟢 **< 5MB**: Excellent for all devices
- 🟡 **5-15MB**: Good for desktop
- 🟠 **15-25MB**: Heavy, use LOD
- 🔴 **> 25MB**: Requires optimization

## Testing Your Model
1. Place model in `public/models/`
2. Open browser dev tools (Network tab)
3. Monitor loading times
4. Check console for errors

## Common Issues
- **CORS errors**: Ensure files are served from same domain
- **Memory issues**: Enable DRACO compression
- **Slow loading**: Use LOD system
- **Materials missing**: Check texture paths in GLB

## Recommended Tools
- **Viewing**: [Babylon.js Viewer](https://sandbox.babylonjs.com/)
- **Compression**: [GLTF Transform](https://gltf-transform.donmccurdy.com/)
- **Optimization**: [Blender](https://www.blender.org/)
- **Analysis**: [gltf-report](https://github.khronos.org/glTF/)