# Static color batching with exact CPU visibility

Based on GPU-projection commit
`7fe65eba94d11f25418b0edbaf0c6869784b8151`.

## Rendering and visibility

- Each polytope has one indexed mesh per used color (`faces.length % 11`),
  without per-cell geometry groups. Both Solid and Frame use this path.
  Frame remains the original triangulated polygon bands.
- Original `position`/`positionW` and the owning `cellIndex` are static vertex
  attributes. Vertices are never welded across cells. The previous experimental
  GPU-visibility batch's Float32 `cellNormal` attribute is no longer needed.
- Projection remains the original row-vector calculation
  `vec4(position, positionW) * projection4D`, with Phong derivative flat shading.
- `Polytope.checkVisibility()` calls the original `Projector.ifVisible` on the
  original double-precision cell normals. Its expression, arithmetic order and
  strict `> 0` comparison are unchanged. No Float32 conversion or epsilon is
  used in the CPU decision, including zero and near-tangent cases.
- The result is stored as one byte per cell: 0 (hidden) or 255 (visible) in an
  unsigned-byte red-channel DataTexture. Padding texels are hidden.
  A changed bit marks the texture for upload once; unchanged bits do not.
- The vertex shader uses WebGL2 `textureSize`/`texelFetch` and integer arithmetic
  to fetch exactly that cell's texel. It does not recalculate visibility.
  Every vertex of a hidden triangle is moved to `(2, 0, 0, 1)` in clip space,
  so the complete triangle is removed by the same clipping plane.

## Texture and lifecycle details

The texture uses a nearly square layout: width = ceil(sqrt(cell count)), height
= ceil(cell count / width), each at least one. For c120s, it is 100x99 = 9,900
bytes, including padding. Coordinates come from the texture's actual dimensions;
there is no normalized-UV interpolation, mipmapping, color conversion, or flip.
Each material checks the actual renderer's `maxTextureSize` before uniform
upload. Unsupported dimensions produce an error rather than a resized mask.
Cell counts beyond 2^24 are rejected so each Float32 cell ID remains exact.

`Polytope.object3D.children` holds the renderable batches. Temporary per-facet
geometry/meshes are released after merging, while cell topology and original
vertices remain available. Mode rebuilding preserves the Group and texture;
reinitialization releases the old projector's materials and mask. Different
polytopes own different textures. `dispose()` releases merged buffers and the
projector's materials and mask. Initialization/rebuilding computes the mask
before the first render; rotations and resets use the usual `checkVisibility`
call before rendering, just as in the original app.

Conservative origin-centered bounds use original 4D length plus the existing
margin. Large indexed batches are promoted to Uint32 indices automatically.

## Costs and verification limits

CPU work is again O(cell count) for visibility, plus a small texture upload
when bits change. Geometry is static and draw submission remains one call per
color. Hidden cells are still submitted to the vertex stage, so submitted
triangle count is often about twice the original CPU-culled renderer's count.
Replacing four-component normals with one-component cell IDs saves vertex
buffer memory relative to the previous GPU-visibility batching experiment.

Run `pnpm check` for type checking, production build and all tests. Tests cover
all 180 previous benchmark poses (including tangent offsets), exact original
CPU mask decisions, mask indexing and padding, texture flags/limits, unchanged
upload versions, static buffers, topology, bounds, Uint32 indices, and lifecycle.
The companion three-way kit compares the original GPU renderer, the previous
GPU-visibility batching implementation, and this CPU-mask implementation.

CPU mask equality removes the identified Float32 visibility-decision mismatch;
it is not itself proof of rendered image equality. GLSL integration tests
inspect generated source, not an actual GPU compiler. GPU timings, texture
upload costs, FPS and pixels must be checked in the supplied browser harness.
