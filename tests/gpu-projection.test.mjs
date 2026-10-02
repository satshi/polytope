import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as THREE from "three";

import { Polytope, rotationMatrix4 } from "../.test-dist/polytope.js";

async function makePolytope(type = "Solid", name = "c16") {
    const data = JSON.parse(await readFile(new URL(`../src/data/${name}.json`, import.meta.url), "utf8"));
    return new Polytope().initFromPrePolytope(data, type);
}

function compileMaterial(material) {
    // This checks shader integration, not a real WebGL compiler.
    const shader = {
        vertexShader: THREE.ShaderLib.phong.vertexShader,
        fragmentShader: THREE.ShaderLib.phong.fragmentShader,
        uniforms: THREE.UniformsUtils.clone(THREE.ShaderLib.phong.uniforms),
    };
    material.onBeforeCompile(shader, {});
    return shader;
}

function snapshotAttribute(attribute) {
    return { attribute, array: attribute.array, values: Array.from(attribute.array), version: attribute.version };
}

function expectedIndices(facet, type) {
    const result = [];
    let offset = facet.vertices.length;
    for (const face of facet.faces) {
        if (type === "Solid") {
            for (let i = 1; i < face.length - 1; i++) result.push(face[0], face[i], face[i + 1]);
        } else {
            for (let i = 0; i < face.length; i++) {
                const next = (i + 1) % face.length;
                result.push(face[i], face[next], offset + next, face[i], offset + next, offset + i);
            }
            offset += face.length;
        }
    }
    return result;
}

for (const type of ["Solid", "Frame"]) {
    test(`${type} batches by color without changing cell coordinates, IDs, or topology`, async t => {
        const p = await makePolytope(type, "c24thww");
        t.after(() => p.dispose());
        const colors = [...new Set(p.facetList.map(f => f.faces.length % 11))];
        assert.equal(p.object3D.children.length, colors.length);
        for (const mesh of p.object3D.children) {
            assert.ok(mesh instanceof THREE.Mesh);
            assert.ok(!Array.isArray(mesh.material));
            assert.equal(mesh.material.flatShading, true);
            assert.equal(mesh.material.side, THREE.DoubleSide);
            assert.equal(mesh.geometry.hasAttribute("normal"), false);
            assert.deepEqual(mesh.geometry.groups, [], "groups would preserve per-cell draw calls");
            const color = p.projector.materials.indexOf(mesh.material);
            const facets = p.facetList.filter(f => f.faces.length % 11 === color);
            const position = mesh.geometry.getAttribute("position");
            const positionW = mesh.geometry.getAttribute("positionW");
            const cellIndex = mesh.geometry.getAttribute("cellIndex");
            assert.equal(mesh.geometry.hasAttribute("cellNormal"), false);
            assert.equal(position.itemSize, 3);
            assert.equal(positionW.itemSize, 1);
            assert.equal(cellIndex.itemSize, 1);
            assert.equal(positionW.count, position.count);
            assert.equal(cellIndex.count, position.count);
            const indices = [];
            let offset = 0;
            for (const facet of facets) {
                assert.equal(facet.geometry, null, "temporary cell buffers must be released");
                assert.equal(facet.mesh, null, "only color batches should retain meshes");
                if (type === "Frame") assert.ok(facet.triangleVertices.length > facet.vertices.length);
                for (const [i, vertex] of facet.triangleVertices.entries()) {
                    const index = offset + i;
                    assert.deepEqual(
                        [position.getX(index), position.getY(index), position.getZ(index), positionW.getX(index)],
                        vertex.toArray().map(Math.fround),
                    );
                    assert.equal(cellIndex.getX(index), p.facetList.indexOf(facet));
                }
                for (const index of expectedIndices(facet, type)) indices.push(offset + index);
                offset += facet.triangleVertices.length;
            }
            assert.equal(position.count, offset);
            assert.deepEqual(Array.from(mesh.geometry.index.array), indices);
        }
    });

    test(`${type} keeps every vertex/index buffer static while rotating and resetting`, async t => {
        const p = await makePolytope(type);
        t.after(() => p.dispose());
        const snapshots = p.object3D.children.map(mesh => ({
            mesh,
            attributes: Object.fromEntries(Object.entries(mesh.geometry.attributes).map(([name, attribute]) => {
                assert.equal(attribute.usage, THREE.StaticDrawUsage);
                return [name, snapshotAttribute(attribute)];
            })),
            index: snapshotAttribute(mesh.geometry.index),
        }));
        // CPU visibility must not recreate meshes or change vertex/index buffers.
        for (const facet of p.facetList) facet.checkVisibility = () => { throw Error("CPU visibility was called"); };
        for (const direction of [1, 2, 3, 12, 13, 23]) p.applyMatrix4(rotationMatrix4(0.37, direction)).checkVisibility();
        p.identityProjector().checkVisibility();
        for (const { mesh, attributes, index } of snapshots) {
            for (const [name, snapshot] of Object.entries({ ...attributes, index })) {
                const actual = name === "index" ? mesh.geometry.index : mesh.geometry.getAttribute(name);
                assert.equal(actual, snapshot.attribute);
                assert.equal(actual.array, snapshot.array);
                assert.deepEqual(Array.from(actual.array), snapshot.values);
                assert.equal(actual.version, snapshot.version, `${name} must not request another GPU upload`);
            }
        }
    });

    test(`${type} bounds contain all projected vertices in axis and composed rotations`, async t => {
        const p = await makePolytope(type);
        t.after(() => p.dispose());
        const bounds = p.object3D.children.map(mesh => mesh.geometry.boundingSphere);
        const verify = () => {
            const matrix = p.projector.pmatrix.clone().transpose();
            p.object3D.children.forEach((mesh, batchIndex) => {
                const sphere = mesh.geometry.boundingSphere;
                assert.equal(sphere, bounds[batchIndex]);
                assert.deepEqual(sphere.center.toArray(), [0, 0, 0]);
                const position = mesh.geometry.getAttribute("position"), w = mesh.geometry.getAttribute("positionW");
                for (let i = 0; i < position.count; i++) {
                    const vertex = new THREE.Vector4(position.getX(i), position.getY(i), position.getZ(i), w.getX(i)).applyMatrix4(matrix);
                    assert.ok(sphere.containsPoint(new THREE.Vector3(vertex.x, vertex.y, vertex.z)));
                }
            });
        };
        for (const direction of [1, 2, 3, 12, 13, 23]) {
            for (const angle of [0, Math.PI / 4, Math.PI / 2, -Math.PI / 2, Math.PI]) {
                p.identityProjector().applyMatrix4(rotationMatrix4(angle, direction)); verify();
            }
        }
        p.identityProjector();
        for (const direction of [3, 12, 23, 1, 13, 2]) { p.applyMatrix4(rotationMatrix4(0.71, direction)); verify(); }
    });
}

test("shader shares projection, clips whole hidden triangles, and keeps Phong flat lighting", async t => {
    const p = await makePolytope();
    t.after(() => p.dispose());
    const matrix = p.projector.pmatrix;
    const shaders = p.projector.materials.map(compileMaterial);
    const first = rotationMatrix4(0.37, 3), second = rotationMatrix4(-0.81, 12);
    p.applyMatrix4(first).applyMatrix4(second);
    assert.equal(p.projector.pmatrix, matrix);
    assert.deepEqual(matrix.elements, first.clone().multiply(second).elements);
    for (const shader of shaders) {
        assert.equal(shader.uniforms.projection4D.value, matrix);
        assert.match(shader.vertexShader, /vec4\( position, positionW \) \* projection4D/);
        assert.match(shader.vertexShader, /texelFetch\( cellVisibility, visibilityTexel, 0 \)\.r < 0\.5/);
        assert.match(shader.vertexShader, /textureSize\( cellVisibility, 0 \)\.x/);
        assert.match(shader.vertexShader, /int\( cellIndex \)/);
        assert.equal(shader.uniforms.cellVisibility.value, p.projector.visibilityMask.texture);
        assert.doesNotMatch(shader.vertexShader, /cellNormal/);
        assert.match(shader.vertexShader, /gl_Position = vec4\( 2\.0, 0\.0, 0\.0, 1\.0 \)/);
        assert.ok(shader.vertexShader.indexOf("#include <project_vertex>") < shader.vertexShader.indexOf("gl_Position = vec4"));
        assert.equal(shader.fragmentShader, THREE.ShaderLib.phong.fragmentShader);
    }
    p.identityProjector();
    assert.equal(p.projector.pmatrix, matrix);
    assert.deepEqual(matrix.elements, new THREE.Matrix4().elements);
});

test("CPU mask keeps the original strict positive-side rule, including exactly edge-on cells", async t => {
    const p = await makePolytope();
    t.after(() => p.dispose());
    const normal = p.facetList[0].normal;
    for (const w of [-1, -1e-7, -0, 0, 1e-7, 1]) {
        normal.set(0, 0, 0, w);
        p.identityProjector().checkVisibility();
        assert.equal(p.projector.ifVisible(normal), w > 0);
        assert.equal(p.projector.visibilityMask.data[0], w > 0 ? 255 : 0);
    }
    for (let step = 0; step < 200; step++) {
        p.applyMatrix4(rotationMatrix4(0.0137, [1, 2, 3, 12, 13, 23][step % 6])).checkVisibility();
        const m = p.projector.pmatrix.elements;
        p.facetList.forEach((facet, i) => {
            const n = facet.normal;
            const expected = n.x * m[12] + n.y * m[13] + n.z * m[14] + n.w * m[15] > 0;
            assert.equal(p.projector.visibilityMask.data[i], expected ? 255 : 0);
        });
    }
});

test("large Frame color batches use 32-bit indices without index wraparound", async t => {
    const p = await makePolytope("Frame", "c120s");
    t.after(() => p.dispose());
    assert.equal(p.object3D.children.length, 4);
    let foundLargeBatch = false;
    for (const mesh of p.object3D.children) {
        const count = mesh.geometry.getAttribute("position").count;
        if (count > 65535) { foundLargeBatch = true; assert.ok(mesh.geometry.index.array instanceof Uint32Array); }
        let maxIndex = -1;
        for (const index of mesh.geometry.index.array) { assert.ok(index < count); maxIndex = Math.max(maxIndex, index); }
        assert.equal(maxIndex, count - 1);
    }
    assert.ok(foundLargeBatch);
});

test("polytopes have independent uniforms and release their own merged resources", async t => {
    const first = await makePolytope(), second = await makePolytope("Frame");
    t.after(() => second.dispose());
    const firstMaterials = first.projector.materials, secondMaterials = second.projector.materials;
    const firstDisposals = Array(11).fill(0), secondDisposals = Array(11).fill(0);
    const geometries = first.object3D.children.map(mesh => mesh.geometry);
    const geometryDisposals = geometries.map(() => 0);
    firstMaterials.forEach((material, i) => {
        assert.notEqual(material, secondMaterials[i]);
        material.addEventListener("dispose", () => firstDisposals[i]++);
        secondMaterials[i].addEventListener("dispose", () => secondDisposals[i]++);
    });
    geometries.forEach((geometry, i) => geometry.addEventListener("dispose", () => geometryDisposals[i]++));
    first.applyMatrix4(rotationMatrix4(0.63, 23));
    assert.deepEqual(second.projector.pmatrix.elements, new THREE.Matrix4().elements);
    first.dispose();
    assert.deepEqual(firstDisposals, Array(11).fill(1));
    assert.deepEqual(secondDisposals, Array(11).fill(0));
    assert.deepEqual(geometryDisposals, geometries.map(() => 1));
    assert.equal(first.object3D.children.length, 0);
});

test("mode rebuilds and reinitialization dispose batches and retain the scene Group", async t => {
    const p = await makePolytope();
    t.after(() => p.dispose());
    const group = p.object3D;
    const verifyRebuild = action => {
        const old = p.object3D.children.map(mesh => mesh.geometry), disposals = old.map(() => 0);
        old.forEach((geometry, i) => geometry.addEventListener("dispose", () => disposals[i]++));
        action();
        assert.equal(p.object3D, group);
        assert.deepEqual(disposals, old.map(() => 1));
        assert.ok(p.object3D.children.length > 0);
        for (const mesh of p.object3D.children) assert.ok(!old.includes(mesh.geometry));
    };
    verifyRebuild(() => p.makeFrameGeometry());
    verifyRebuild(() => p.makeSolidGeometry());
    const materials = p.projector.materials, disposals = Array(11).fill(0);
    materials.forEach((material, i) => material.addEventListener("dispose", () => disposals[i]++));
    verifyRebuild(() => p.initFromPrePolytope(p.prePolytope, "Frame"));
    assert.deepEqual(disposals, Array(11).fill(1));
});

test("replacing a projector releases its previous materials", t => {
    const p = new Polytope();
    t.after(() => p.dispose());
    const previous = p.projector, disposals = Array(11).fill(0);
    previous.materials.forEach((material, i) => material.addEventListener("dispose", () => disposals[i]++));
    p.initProjector();
    assert.notEqual(p.projector, previous);
    assert.deepEqual(disposals, Array(11).fill(1));
    assert.deepEqual(p.projector.pmatrix.elements, new THREE.Matrix4().elements);
});

test("a failed cell rebuild releases partial buffers and can be retried", async t => {
    const p = await makePolytope();
    t.after(() => p.dispose());
    const first = p.facetList[0], second = p.facetList[1];
    const makeFirst = first.makeSolidGeometry, makeSecond = second.makeSolidGeometry;
    let released = 0;
    first.makeSolidGeometry = function (...args) {
        makeFirst.apply(this, args);
        this.geometry.addEventListener("dispose", () => released++);
    };
    second.makeSolidGeometry = () => { throw Error("injected rebuild failure"); };
    assert.throws(() => p.makeSolidGeometry(), /injected rebuild failure/);
    assert.equal(released, 1);
    assert.equal(p.object3D.children.length, 0);
    for (const facet of p.facetList) { assert.equal(facet.geometry, null); assert.equal(facet.mesh, null); }
    first.makeSolidGeometry = makeFirst;
    second.makeSolidGeometry = makeSecond;
    p.makeSolidGeometry();
    assert.ok(p.object3D.children.length > 0);
});

test("CPU mask preserves a symmetric boundary decision lost by a Float32 dot", async t => {
    const p = await makePolytope();
    t.after(() => p.dispose());
    const normal = [-0.5, 0.5, 0.5, 0.5];
    p.facetList[0].normal.fromArray(normal);
    p.identityProjector().applyMatrix4(rotationMatrix4(Math.PI / 4, 3)).checkVisibility();
    const column = p.projector.pmatrix.elements.slice(12, 16);
    const cpu = normal.reduce((sum, n, i) => sum + n * column[i], 0);
    const gpuEstimate = normal.reduce((sum, n, i) => Math.fround(sum + Math.fround(Math.fround(n) * Math.fround(column[i]))), 0);
    assert.ok(Math.abs(cpu) < 1e-15);
    assert.equal(gpuEstimate, 0);
    assert.equal(p.projector.visibilityMask.data[0], cpu > 0 ? 255 : 0);
});
