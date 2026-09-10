import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

import { Polytope } from "../.test-dist/polytope.js";

const DATA_DIRECTORY = new URL("../src/data/", import.meta.url);

async function readData(file) {
    return JSON.parse(await readFile(new URL(file, DATA_DIRECTORY), "utf8"));
}

function dot(a, b) {
    return a.reduce((sum, component, index) => sum + component * b[index], 0);
}

function affineDimension(points) {
    let vectors = points.slice(1).map(point => (
        point.map((component, index) => component - points[0][index])
    ));
    const scale = Math.max(...vectors.map(vector => Math.hypot(...vector)));
    const basis = [];

    // Coordinates are rounded in the JSON files. Allow that rounding relative
    // to the face diameter when measuring the distance from its affine span.
    const tolerance = scale * 2e-5;
    while (basis.length < 4) {
        // Choose the longest residual to avoid an unstable basis from almost
        // parallel edges of a polygon with many sides.
        const residual = vectors.reduce((longest, vector) => (
            Math.hypot(...vector) > Math.hypot(...longest) ? vector : longest
        ));
        const length = Math.hypot(...residual);
        if (length <= tolerance) {
            break;
        }
        const direction = residual.map(component => component / length);
        basis.push(direction);
        vectors = vectors.map(vector => {
            const projection = dot(vector, direction);
            return vector.map((component, index) => component - projection * direction[index]);
        });
    }
    return basis.length;
}

function edgeKey(a, b) {
    return a < b ? `${a},${b}` : `${b},${a}`;
}

function countEdges(faces) {
    const edges = new Map();
    for (const face of faces) {
        face.forEach((vertex, index) => {
            const key = edgeKey(vertex, face[(index + 1) % face.length]);
            edges.set(key, (edges.get(key) ?? 0) + 1);
        });
    }
    return edges;
}

test("all bundled faces are distinct, nondegenerate planar polygons", async () => {
    const files = (await readdir(DATA_DIRECTORY))
        .filter(file => file.endsWith(".json"))
        .sort();

    assert.ok(files.length > 0);
    for (const file of files) {
        const data = await readData(file);
        const seen = new Set();
        data.faces.forEach((face, index) => {
            // Winding and starting vertex do not change a convex face.
            const key = face.slice().sort((a, b) => a - b).join(",");
            assert.ok(!seen.has(key), `${file}: duplicate face ${index}`);
            seen.add(key);
            assert.equal(
                affineDimension(face.map(vertex => data.vertices[vertex])),
                2,
                `${file}: face ${index} must span a plane`,
            );
        });
    }
});

for (const file of ["c5hw.json", "c5thw.json", "c8hw.json", "c8thw.json"]) {
    test(`${file} forms closed cells and a closed 4D polytope`, async () => {
        const data = await readData(file);
        const polytope = new Polytope().readJSONFile(data).makeFacetList();
        const faceUses = new Array(data.faces.length).fill(0);
        const usedVertices = new Set();

        polytope.facetToFace.forEach((faceIndices, facetIndex) => {
            const faces = faceIndices.map(index => {
                faceUses[index] += 1;
                return data.faces[index];
            });
            const vertices = new Set(faces.flat());
            for (const vertex of vertices) {
                usedVertices.add(vertex);
            }
            assert.deepEqual(
                vertices,
                new Set(polytope.facetToVertex[facetIndex]),
                `cell ${facetIndex}: every vertex must belong to a face`,
            );

            const edges = countEdges(faces);
            for (const [edge, uses] of edges) {
                assert.equal(uses, 2, `cell ${facetIndex}: edge ${edge} must join two faces`);
            }
            assert.equal(
                vertices.size - edges.size + faces.length,
                2,
                `cell ${facetIndex}: V - E + F must equal 2`,
            );
        });

        faceUses.forEach((uses, index) => {
            assert.equal(uses, 2, `face ${index} must join two cells`);
        });
        assert.equal(usedVertices.size, data.vertices.length, "every vertex must belong to a cell");
        assert.equal(
            data.vertices.length - countEdges(data.faces).size
                + data.faces.length - data.facetCenters.length,
            0,
            "V - E + F - C must equal 0",
        );
    });
}
