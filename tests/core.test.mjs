import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import * as THREE from "three";

import {
    AUTO_ROTATION_SPEED,
    MAX_ANIMATION_STEP_SECONDS,
    automaticRotation,
} from "../dist/animation.js";
import {
    PolytopeDataError,
    parsePrePolytope,
} from "../dist/data-validation.js";
import { Polytope, rotationMatrix4 } from "../dist/polytope.js";

const DATA_DIRECTORY = new URL("../src/data/", import.meta.url);

async function readJson(url) {
    return JSON.parse(await readFile(url, "utf8"));
}

test("all bundled polytope data passes runtime validation", async () => {
    const files = (await readdir(DATA_DIRECTORY))
        .filter(file => file.endsWith(".json"))
        .sort();

    assert.ok(files.length > 0);
    for (const file of files) {
        const data = await readJson(new URL(file, DATA_DIRECTORY));
        assert.doesNotThrow(() => parsePrePolytope(data), file);
    }
});

test("runtime validation rejects malformed coordinates and indices", () => {
    const valid = {
        vertices: [
            [1, 0, 0, 0],
            [0, 1, 0, 0],
            [0, 0, 1, 0],
        ],
        faces: [[0, 1, 2]],
        facetCenters: [[0, 0, 0, 1]],
    };

    assert.throws(
        () => parsePrePolytope({ ...valid, vertices: [[1, 2, 3]] }),
        PolytopeDataError,
    );
    assert.throws(
        () => parsePrePolytope({ ...valid, faces: [[0, 1, 3]] }),
        PolytopeDataError,
    );
    assert.throws(
        () => parsePrePolytope({ ...valid, faces: [[0, 1, 1]] }),
        PolytopeDataError,
    );
});

test("4D rotation matrices preserve length and orientation", () => {
    const matrix = rotationMatrix4(Math.PI / 3, 23);
    const vector = new THREE.Vector4(0.3, -0.5, 0.7, 0.2);
    const rotated = vector.clone().applyMatrix4(matrix);

    assert.ok(Math.abs(rotated.length() - vector.length()) < 1e-12);
    assert.ok(Math.abs(matrix.determinant() - 1) < 1e-12);
});

test("automatic rotation uses elapsed time and caps long frames", () => {
    const elapsed = 1 / 60;
    const angle = AUTO_ROTATION_SPEED * elapsed;
    const expected = rotationMatrix4(angle, 23)
        .multiply(rotationMatrix4(angle, 12))
        .multiply(rotationMatrix4(angle, 3));

    assert.deepEqual(automaticRotation(elapsed).elements, expected.elements);
    assert.deepEqual(
        automaticRotation(10).elements,
        automaticRotation(MAX_ANIMATION_STEP_SECONDS).elements,
    );
    assert.throws(() => automaticRotation(-1), RangeError);
});

test("dynamic facets use Three.js derivative-based flat shading", async () => {
    const data = parsePrePolytope(await readJson(new URL("c5.json", DATA_DIRECTORY)));
    const polytope = new Polytope().initFromPrePolytope(data);
    const mesh = polytope.facetList[0].mesh;

    assert.ok(mesh);
    assert.ok(mesh.material instanceof THREE.MeshPhongMaterial);
    assert.equal(mesh.material.flatShading, true);
    assert.equal(mesh.geometry.hasAttribute("normal"), false);

    polytope.dispose();
});
