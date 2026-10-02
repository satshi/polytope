import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as THREE from "three";
import { CellVisibilityMask, Polytope, rotationMatrix4 } from "../.test-dist/polytope.js";
import { automaticRotation } from "../.test-dist/animation.js";

async function create(name = "c120", mode = "Solid") {
    const data = JSON.parse(await readFile(new URL(`../src/data/${name}.json`, import.meta.url), "utf8"));
    return new Polytope().initFromPrePolytope(data, mode);
}

function orientations(p) {
    const poses = [new THREE.Matrix4()];
    for (const steps of [17, 113]) {
        const m = new THREE.Matrix4();
        for (let i = 0; i < steps; i++) m.multiply(automaticRotation(1 / 60));
        poses.push(m);
    }
    poses.push(rotationMatrix4(.37, 3).multiply(rotationMatrix4(-.81, 12)).multiply(rotationMatrix4(.71, 23)));
    poses.push(rotationMatrix4(-1.14, 1).multiply(rotationMatrix4(.6, 13)).multiply(rotationMatrix4(-.83, 2)));
    for (const direction of [3, 13, 23]) for (const offset of [-1e-8, 0, 1e-8]) {
        poses.push(rotationMatrix4(Math.PI / 2 + offset, direction));
    }
    const facet = p.facetList.find(f => Math.abs(f.normal.x) > 1e-3 && Math.abs(f.normal.w) > 1e-3);
    if (facet) {
        const angle = Math.atan2(-facet.normal.w, facet.normal.x);
        for (const offset of [-1e-6, -1e-8, 0, 1e-8, 1e-6]) poses.push(rotationMatrix4(angle + offset, 3));
    }
    return poses;
}

function assertOriginalDecisions(p) {
    const { data, texture } = p.projector.visibilityMask;
    const m = p.projector.pmatrix.elements;
    const width = texture.image.width;
    for (let i = 0; i < p.facetList.length; i++) {
        const n = p.facetList[i].normal;
        // Deliberately spell the original expression/order exactly. No epsilon,
        // Float32 conversion, or reassociation of products is permitted here.
        const visible = n.x * m[12] + n.y * m[13] + n.z * m[14] + n.w * m[15] > 0;
        const x = i % width, y = Math.floor(i / width);
        assert.equal(data[y * width + x], visible ? 255 : 0, `cell ${i}`);
    }
    for (let i = p.facetList.length; i < data.length; i++) assert.equal(data[i], 0, "padding is hidden");
}

test("mask uses one R8 byte per texel, exact integer indexing and no interpolation", () => {
    for (const count of [0, 1, 2, 99, 100, 101, 255, 256, 257, 9840]) {
        const mask = new CellVisibilityMask(count);
        try {
            const { width, height } = mask.texture.image;
            assert.equal(mask.data.length, width * height);
            assert.ok(width * height >= count);
            assert.equal(width, Math.max(1, Math.ceil(Math.sqrt(count))));
            assert.ok(width * height - count < Math.max(width, 2));
            assert.ok(mask.data instanceof Uint8Array);
            assert.equal(mask.texture.format, THREE.RedFormat);
            assert.equal(mask.texture.type, THREE.UnsignedByteType);
            assert.equal(mask.texture.minFilter, THREE.NearestFilter);
            assert.equal(mask.texture.magFilter, THREE.NearestFilter);
            assert.equal(mask.texture.generateMipmaps, false);
            assert.equal(mask.texture.flipY, false);
            assert.equal(mask.texture.unpackAlignment, 1);
            assert.equal(mask.texture.colorSpace, THREE.NoColorSpace);
            for (let i = 0; i < count; i++) {
                const floatIndex = Math.fround(i);
                assert.equal(floatIndex, i);
                assert.equal(Math.floor(floatIndex / width) * width + floatIndex % width, i);
            }
        } finally { mask.dispose(); }
    }
});

test("mask rejects inexact IDs and checks actual renderer texture limits before use", async t => {
    for (const n of [-1, 1.5, NaN, Infinity, 2 ** 24 + 1]) assert.throws(() => new CellVisibilityMask(n), RangeError);
    const mask = new CellVisibilityMask(9840);
    t.after(() => mask.dispose());
    assert.deepEqual([mask.texture.image.width, mask.texture.image.height, mask.data.byteLength], [100, 99, 9900]);
    assert.doesNotThrow(() => mask.assertFits(100));
    assert.throws(() => mask.assertFits(99), /MAX_TEXTURE_SIZE 99/);
    const p = await create();
    t.after(() => p.dispose());
    const material = p.object3D.children[0].material;
    assert.throws(() => material.onBeforeRender({ capabilities: { maxTextureSize: 1 } }), /MAX_TEXTURE_SIZE/);
    assert.doesNotThrow(() => material.onBeforeRender({ capabilities: { maxTextureSize: 4096 } }));
});

test("all 180 previous browser poses, including tangent offsets, match original CPU visibility exactly", async () => {
    let poseCount = 0, decisions = 0;
    for (const name of ["c8", "c120", "c600", "c120thww", "c120s"]) for (const mode of ["Solid", "Frame"]) {
        const p = await create(name, mode);
        try {
            assertOriginalDecisions(p); // initialization must be correct before first render
            for (const matrix of orientations(p)) {
                p.identityProjector().applyMatrix4(matrix).checkVisibility();
                assertOriginalDecisions(p);
                poseCount++; decisions += p.facetList.length;
            }
        } finally { p.dispose(); }
    }
    assert.equal(poseCount, 180);
    assert.ok(decisions > 400000);
});

test("unchanged visibility does not dirty the mask or static vertex/index buffers", async t => {
    const p = await create("c16");
    t.after(() => p.dispose());
    const mask = p.projector.visibilityMask;
    const data = mask.data, texture = mask.texture;
    let version = texture.version;
    p.checkVisibility().checkVisibility();
    assert.equal(texture.version, version);
    // A 3D rotation leaves the fourth matrix column unchanged.
    p.applyMatrix4(rotationMatrix4(.3, 12)).checkVisibility();
    assert.equal(texture.version, version);
    p.applyMatrix4(rotationMatrix4(Math.PI, 3)).checkVisibility();
    assert.equal(texture.version, version + 1);
    version = texture.version;
    p.checkVisibility();
    assert.equal(texture.version, version);
    assert.equal(mask.data, data);
    assert.equal(mask.texture, texture);
    assertOriginalDecisions(p);
    p.identityProjector().checkVisibility();
    assert.equal(texture.version, version + 1);
    assertOriginalDecisions(p);
});

test("all vertices of each indexed triangle reference the same mask texel", async t => {
    const p = await create("c120s", "Frame");
    t.after(() => p.dispose());
    const seen = new Set();
    for (const mesh of p.object3D.children) {
        const ids = mesh.geometry.getAttribute("cellIndex"), indices = mesh.geometry.index;
        assert.equal(mesh.geometry.hasAttribute("cellNormal"), false);
        assert.equal(ids.itemSize, 1);
        for (let i = 0; i < indices.count; i += 3) {
            const a = ids.getX(indices.getX(i)), b = ids.getX(indices.getX(i + 1)), c = ids.getX(indices.getX(i + 2));
            assert.equal(a, b); assert.equal(a, c);
            assert.ok(a >= 0 && a < p.facetList.length && Number.isInteger(a));
            seen.add(a);
        }
    }
    assert.equal(seen.size, p.facetList.length);
});

test("texture ownership, mode rebuilding, reset and reinitialization keep mask lifecycle sound", async t => {
    const p = await create("c120"), other = await create("c8");
    t.after(() => p.dispose()); t.after(() => other.dispose());
    const texture = p.projector.visibilityMask.texture;
    const otherTexture = other.projector.visibilityMask.texture;
    assert.notEqual(texture, otherTexture);
    let disposed = 0, otherDisposed = 0;
    texture.addEventListener("dispose", () => disposed++);
    otherTexture.addEventListener("dispose", () => otherDisposed++);
    p.applyMatrix4(rotationMatrix4(.5, 3)).checkVisibility();
    const bits = Array.from(p.projector.visibilityMask.data), version = texture.version;
    p.makeFrameGeometry();
    assert.equal(p.projector.visibilityMask.texture, texture);
    assert.equal(texture.version, version);
    assert.deepEqual(Array.from(p.projector.visibilityMask.data), bits);
    assert.equal(disposed, 0);
    p.initFromPrePolytope(other.prePolytope, "Frame");
    assert.equal(disposed, 1);
    assert.equal(otherDisposed, 0);
    assert.notEqual(p.projector.visibilityMask.texture, texture);
    assert.equal(p.projector.visibilityMask.cellCount, 8);
    assertOriginalDecisions(p);
});
