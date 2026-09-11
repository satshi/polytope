import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as THREE from "three";

import { Polytope, rotationMatrix4 } from "../.test-dist/polytope.js";

async function makePolytope(type = "Solid") {
    const data = JSON.parse(await readFile(new URL("../src/data/c16.json", import.meta.url), "utf8"));
    return new Polytope().initFromPrePolytope(data, type);
}

function compileMaterial(material) {
    const shader = {
        vertexShader: THREE.ShaderLib.phong.vertexShader,
        fragmentShader: THREE.ShaderLib.phong.fragmentShader,
        uniforms: THREE.UniformsUtils.clone(THREE.ShaderLib.phong.uniforms),
    };
    material.onBeforeCompile(shader, {});
    return shader;
}

function snapshotAttribute(attribute) {
    return {
        attribute,
        array: attribute.array,
        values: Array.from(attribute.array),
        version: attribute.version,
    };
}

for (const type of ["Solid", "Frame"]) {
    test(`${type} uploads original 4D coordinates once and keeps them unchanged while rotating`, async t => {
        const polytope = await makePolytope(type);
        t.after(() => polytope.dispose());

        const snapshots = polytope.facetList.map(facet => {
            const position = facet.geometry.getAttribute("position");
            const positionW = facet.geometry.getAttribute("positionW");
            assert.equal(position.itemSize, 3);
            assert.equal(positionW.itemSize, 1);
            assert.equal(position.count, facet.triangleVertices.length);
            assert.equal(positionW.count, position.count);
            assert.equal(position.usage, THREE.StaticDrawUsage);
            assert.equal(positionW.usage, THREE.StaticDrawUsage);
            assert.equal(facet.geometry.hasAttribute("normal"), false);
            assert.equal(facet.mesh.material.flatShading, true);

            if (type === "Frame") {
                assert.ok(position.count > facet.vertices.length, "frame interiors also need 4D coordinates");
            } else {
                assert.equal(position.count, facet.vertices.length);
            }
            facet.triangleVertices.forEach((vertex, index) => {
                assert.deepEqual(
                    [position.getX(index), position.getY(index), position.getZ(index), positionW.getX(index)],
                    vertex.toArray().map(Math.fround),
                );
            });
            return {
                facet,
                position: snapshotAttribute(position),
                positionW: snapshotAttribute(positionW),
            };
        });

        for (const direction of [1, 2, 3, 12, 13, 23]) {
            polytope.applyMatrix4(rotationMatrix4(0.37, direction)).checkVisibility();
        }
        polytope.identityProjector().checkVisibility();

        for (const { facet, ...attributes } of snapshots) {
            for (const [name, snapshot] of Object.entries(attributes)) {
                const actual = facet.geometry.getAttribute(name);
                assert.equal(actual, snapshot.attribute, `${name} attribute must be reused`);
                assert.equal(actual.array, snapshot.array, `${name} buffer must be reused`);
                assert.deepEqual(Array.from(actual.array), snapshot.values, `${name} values must stay static`);
                assert.equal(actual.version, snapshot.version, `${name} must not request another GPU upload`);
            }
        }
    });

    test(`${type} bounds contain GPU-projected vertices in every rotation plane and composed rotations`, async t => {
        const polytope = await makePolytope(type);
        t.after(() => polytope.dispose());

        const bounds = polytope.facetList.map(facet => {
            const sphere = facet.geometry.boundingSphere;
            assert.ok(sphere, "a bound must exist before Three.js considers only the xyz attribute");
            assert.deepEqual(sphere.center.toArray(), [0, 0, 0]);
            assert.ok(Number.isFinite(sphere.radius) && sphere.radius > 0);
            return sphere;
        });

        const assertProjectedVerticesInside = () => {
            // Existing projection uses row vectors. Transpose for Vector4's
            // column-vector API, and use the actual float32 values sent to GPU.
            const matrix = polytope.projector.pmatrix.clone().transpose();
            polytope.facetList.forEach((facet, facetIndex) => {
                const position = facet.geometry.getAttribute("position");
                const positionW = facet.geometry.getAttribute("positionW");
                assert.equal(facet.geometry.boundingSphere, bounds[facetIndex]);
                for (let index = 0; index < position.count; index++) {
                    const vertex = new THREE.Vector4(
                        position.getX(index), position.getY(index), position.getZ(index), positionW.getX(index),
                    ).applyMatrix4(matrix);
                    const projected = new THREE.Vector3(vertex.x, vertex.y, vertex.z);
                    assert.ok(bounds[facetIndex].containsPoint(projected), `cell ${facetIndex}, vertex ${index}`);
                }
            });
        };

        for (const direction of [1, 2, 3, 12, 13, 23]) {
            for (const angle of [0, Math.PI / 4, Math.PI / 2, -Math.PI / 2, Math.PI]) {
                polytope.identityProjector().applyMatrix4(rotationMatrix4(angle, direction));
                assertProjectedVerticesInside();
            }
        }
        polytope.identityProjector();
        for (const direction of [3, 12, 23, 1, 13, 2]) {
            polytope.applyMatrix4(rotationMatrix4(0.71, direction));
            assertProjectedVerticesInside();
        }
    });
}

test("every cell material observes rotations and reset through a persistent matrix uniform", async t => {
    const polytope = await makePolytope();
    t.after(() => polytope.dispose());
    const matrix = polytope.projector.pmatrix;
    const shaders = polytope.projector.materials.map(compileMaterial);

    const first = rotationMatrix4(0.37, 3);
    const second = rotationMatrix4(-0.81, 12);
    polytope.applyMatrix4(first).applyMatrix4(second);

    assert.equal(polytope.projector.pmatrix, matrix);
    assert.deepEqual(matrix.elements, first.clone().multiply(second).elements);
    for (const shader of shaders) {
        assert.equal(shader.uniforms.projection4D.value, matrix);
    }
    for (const facet of polytope.facetList) {
        assert.ok(polytope.projector.materials.includes(facet.mesh.material));
    }

    polytope.identityProjector();
    assert.equal(polytope.projector.pmatrix, matrix);
    for (const shader of shaders) {
        assert.equal(shader.uniforms.projection4D.value, matrix);
        assert.deepEqual(shader.uniforms.projection4D.value.elements, new THREE.Matrix4().elements);
    }
});

test("polytopes own independent material uniforms and release only their own GPU resources", async t => {
    const first = await makePolytope();
    const second = await makePolytope("Frame");
    t.after(() => second.dispose());
    const firstMaterials = first.projector.materials;
    const secondMaterials = second.projector.materials;
    assert.equal(firstMaterials.length, 11);
    assert.equal(secondMaterials.length, 11);

    const firstShaders = firstMaterials.map(compileMaterial);
    const secondShaders = secondMaterials.map(compileMaterial);
    const firstDisposals = new Array(firstMaterials.length).fill(0);
    const secondDisposals = new Array(secondMaterials.length).fill(0);
    const geometryDisposals = new Array(first.facetList.length).fill(0);
    firstMaterials.forEach((material, index) => {
        assert.notEqual(material, secondMaterials[index]);
        assert.equal(material.customProgramCacheKey(), secondMaterials[index].customProgramCacheKey());
        material.addEventListener("dispose", () => firstDisposals[index]++);
        secondMaterials[index].addEventListener("dispose", () => secondDisposals[index]++);
    });
    first.facetList.forEach((facet, index) => {
        facet.geometry.addEventListener("dispose", () => geometryDisposals[index]++);
    });

    first.applyMatrix4(rotationMatrix4(0.63, 23));
    for (let index = 0; index < firstShaders.length; index++) {
        assert.notEqual(firstShaders[index].uniforms.projection4D.value, secondShaders[index].uniforms.projection4D.value);
        assert.deepEqual(secondShaders[index].uniforms.projection4D.value.elements, new THREE.Matrix4().elements);
    }

    first.dispose();
    assert.deepEqual(firstDisposals, new Array(11).fill(1));
    assert.deepEqual(secondDisposals, new Array(11).fill(0));
    assert.deepEqual(geometryDisposals, new Array(first.facetList.length).fill(1));

    const rotation = rotationMatrix4(-0.28, 13);
    second.applyMatrix4(rotation);
    for (const shader of secondShaders) {
        assert.deepEqual(shader.uniforms.projection4D.value.elements, rotation.elements);
    }
});

test("replacing a projector releases its previous materials", t => {
    const polytope = new Polytope();
    t.after(() => polytope.dispose());
    const previous = polytope.projector;
    const disposals = new Array(previous.materials.length).fill(0);
    previous.materials.forEach((material, index) => {
        material.addEventListener("dispose", () => disposals[index]++);
    });

    polytope.initProjector();

    assert.notEqual(polytope.projector, previous);
    assert.deepEqual(disposals, new Array(11).fill(1));
    assert.deepEqual(polytope.projector.pmatrix.elements, new THREE.Matrix4().elements);
});
