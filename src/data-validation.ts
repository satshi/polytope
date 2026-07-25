export interface PrePolytope {
    vertices: number[][];
    faces: number[][];
    facetCenters: number[][];
    facetToVertex?: number[][];
    facetToFace?: number[][];
}

export class PolytopeDataError extends Error {
    constructor(message: string) {
        super(`Invalid polytope data: ${message}`);
        this.name = "PolytopeDataError";
    }
}

function assertArray(value: unknown, path: string): asserts value is unknown[] {
    if (!Array.isArray(value)) {
        throw new PolytopeDataError(`${path} must be an array.`);
    }
}

function assertVector4List(value: unknown, path: string): asserts value is number[][] {
    assertArray(value, path);
    if (value.length === 0) {
        throw new PolytopeDataError(`${path} must not be empty.`);
    }

    value.forEach((vector, index) => {
        if (
            !Array.isArray(vector)
            || vector.length !== 4
            || vector.some(component => typeof component !== "number" || !Number.isFinite(component))
        ) {
            throw new PolytopeDataError(`${path}[${index}] must contain four finite numbers.`);
        }
    });
}

function assertIndexList(
    value: unknown,
    path: string,
    upperBound: number,
    minimumLength: number,
): asserts value is number[][] {
    assertArray(value, path);
    value.forEach((indices, rowIndex) => {
        if (!Array.isArray(indices) || indices.length < minimumLength) {
            throw new PolytopeDataError(
                `${path}[${rowIndex}] must contain at least ${minimumLength} indices.`,
            );
        }

        const seen = new Set<number>();
        indices.forEach((index, columnIndex) => {
            if (
                typeof index !== "number"
                || !Number.isInteger(index)
                || index < 0
                || index >= upperBound
            ) {
                throw new PolytopeDataError(
                    `${path}[${rowIndex}][${columnIndex}] is outside 0..${upperBound - 1}.`,
                );
            }
            if (seen.has(index)) {
                throw new PolytopeDataError(`${path}[${rowIndex}] contains duplicate index ${index}.`);
            }
            seen.add(index);
        });
    });
}

function assertOptionalFacetMap(
    value: unknown,
    path: string,
    facetCount: number,
    upperBound: number,
): asserts value is number[][] {
    assertIndexList(value, path, upperBound, 1);
    if (value.length !== facetCount) {
        throw new PolytopeDataError(
            `${path} has ${value.length} rows; expected ${facetCount}, one per facet.`,
        );
    }
}

export function parsePrePolytope(value: unknown): PrePolytope {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new PolytopeDataError("the root value must be an object.");
    }

    const data = value as Record<string, unknown>;
    assertVector4List(data.vertices, "vertices");
    assertIndexList(data.faces, "faces", data.vertices.length, 3);
    if (data.faces.length === 0) {
        throw new PolytopeDataError("faces must not be empty.");
    }
    assertVector4List(data.facetCenters, "facetCenters");

    if (data.facetToVertex !== undefined) {
        assertOptionalFacetMap(
            data.facetToVertex,
            "facetToVertex",
            data.facetCenters.length,
            data.vertices.length,
        );
    }
    if (data.facetToFace !== undefined) {
        assertOptionalFacetMap(
            data.facetToFace,
            "facetToFace",
            data.facetCenters.length,
            data.faces.length,
        );
    }

    if (data.facetToVertex !== undefined && data.facetToFace !== undefined) {
        const facetToVertex = data.facetToVertex;
        const facetToFace = data.facetToFace;
        const faces = data.faces;
        facetToFace.forEach((faceIndices, facetIndex) => {
            const vertexIndices = new Set(facetToVertex[facetIndex]);
            faceIndices.forEach(faceIndex => {
                if (faces[faceIndex].some(vertexIndex => !vertexIndices.has(vertexIndex))) {
                    throw new PolytopeDataError(
                        `facetToFace[${facetIndex}] includes a face outside its facet vertices.`,
                    );
                }
            });
        });
    }

    return {
        vertices: data.vertices,
        faces: data.faces,
        facetCenters: data.facetCenters,
        ...(data.facetToVertex === undefined ? {} : { facetToVertex: data.facetToVertex }),
        ...(data.facetToFace === undefined ? {} : { facetToFace: data.facetToFace }),
    };
}
