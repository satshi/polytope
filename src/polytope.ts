import * as THREE from "three";
import { Vector4 } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { PrePolytope } from "./data-validation.js";

export type { PrePolytope } from "./data-validation.js";

//小さい数
const EPSILON = 1.0e-5;

//誤差を除いて等しい
function eql(a: number, b: number) {
    return Math.abs(a - b) < EPSILON;
}

// ４成分の配列の配列からVector4の配列を作る。
function vector4list(numberList: number[][]): Vector4[] {
    const len = numberList.length;
    const veclist: Vector4[] = new Array(len);
    for (let i = 0; i < len; i++) {
        veclist[i] = new Vector4(numberList[i][0], numberList[i][1], numberList[i][2], numberList[i][3]);
    }
    return veclist;
}

//４ベクトルの配列のすべての要素を規格化
function normalize(vectors: Vector4[]) {
    for (let v of vectors) {
        v.normalize();
    }
}

//４ベクトル２つの間の距離
function distance(v1: Vector4, v2: Vector4): number {
    return new Vector4().subVectors(v1, v2).length();
}

// 0から(n-1)までの整数を全体集合とする。その部分集合の包含関係をチェックするためのクラス。
class SubsetChecker {
    elements: boolean[];
    constructor(n: number) {
        this.elements = new Array(n).fill(false);
    }
    clear() {
        this.elements.fill(false);
    }
    setElements(set: number[]) {
        for (let i of set) {
            this.elements[i] = true
        }
    }
    ifSubset(set: number[]) {
        for (let i of set) {
            if (!this.elements[i]) {
                return false;
            }
        }
        return true;
    }
}

//多角形を三角形に分割して頂点インデックスのリストにする
function polygonTriangulation(vertexList: number[]): number[] {
    const indices: number[] = [];
    for (var i = 1; i < vertexList.length - 1; i++) {
        indices.push(vertexList[0], vertexList[i], vertexList[i + 1]);
    }
    return indices;
}

// 多角形のリストを三角形の頂点インデックスのリストにする
function polyhedronFaces(faceList: number[][]): number[] {
    const indices: number[] = [];
    for (var face of faceList) {
        if (face.length < 4) {
            indices.push(face[0], face[1], face[2]);
        } else {
            Array.prototype.push.apply(indices, polygonTriangulation(face));
        }
    }
    return indices;
}

// 4次元の回転行列を作る。angle はラジアン。direction は10進数二桁の数字。
// 方向はx,y,z,w が0,1,2,3
// xyなら01
export function rotationMatrix4(angle: number, direction: number): THREE.Matrix4 {
    const cos_a = Math.cos(angle);
    const sin_a = Math.sin(angle);
    const array = new Array(16).fill(0); // 0で初期化
    const d2 = direction % 10;
    const d1 = (direction - d2) / 10;
    //とりあえず、単位行列を作る。
    for (let i = 0; i < 4; i++) {
        array[i + 4 * i] = 1;
    }
    array[d1 + 4 * d1] = cos_a;
    array[d2 + 4 * d2] = cos_a;
    array[d1 + 4 * d2] = sin_a;
    array[d2 + 4 * d1] = -sin_a;
    return new THREE.Matrix4().fromArray(array);
}


// One byte per cell. A nearly square layout does not assume a particular
// MAX_TEXTURE_SIZE; the actual renderer limit is checked before uploading.
export class CellVisibilityMask {
    readonly data: Uint8Array;
    readonly texture: THREE.DataTexture;

    constructor(readonly cellCount: number) {
        // Float32 vertex attributes represent every integer through 2^24.
        if (!Number.isSafeInteger(cellCount) || cellCount < 0 || cellCount > 2 ** 24) {
            throw new RangeError("Cell count exceeds the exact cell-index range.");
        }
        const width = Math.max(1, Math.ceil(Math.sqrt(cellCount)));
        const height = Math.max(1, Math.ceil(cellCount / width));
        this.data = new Uint8Array(width * height);
        this.data.fill(255, 0, cellCount);
        this.texture = new THREE.DataTexture(this.data, width, height, THREE.RedFormat, THREE.UnsignedByteType);
        this.texture.minFilter = THREE.NearestFilter;
        this.texture.magFilter = THREE.NearestFilter;
        this.texture.generateMipmaps = false;
        this.texture.flipY = false;
        this.texture.unpackAlignment = 1;
        this.texture.colorSpace = THREE.NoColorSpace;
        this.texture.needsUpdate = true;
    }

    assertFits(maxTextureSize: number) {
        const { width, height } = this.texture.image;
        if (width > maxTextureSize || height > maxTextureSize) {
            throw new RangeError(`Cell visibility mask ${width}x${height} exceeds MAX_TEXTURE_SIZE ${maxTextureSize}.`);
        }
    }

    dispose() {
        this.texture.dispose();
    }
}

// ４次元から３次元への射影のクラス。
class Projector {
    readonly pmatrix = new THREE.Matrix4();
    readonly visibilityMask: CellVisibilityMask;
    readonly materials: THREE.MeshPhongMaterial[];

    constructor(cellCount: number = 0) {
        this.visibilityMask = new CellVisibilityMask(cellCount);
        this.materials = makeMaterialTable(this.pmatrix, this.visibilityMask);
    }

    identity() {
        this.pmatrix.identity();
    }
    // 胞の法線ベクトルを入れて見えるか否かを返す。
    ifVisible(normal: Vector4): boolean {
        const m = this.pmatrix.elements;
        return normal.x * m[12] + normal.y * m[13] + normal.z * m[14] + normal.w * m[15] > 0;
    }
    // ４次元の行列（回転を想定）をかける。
    applyMatrix4(m: THREE.Matrix4) {
        this.pmatrix.multiply(m);
    }
    dispose() {
        for (const material of this.materials) {
            material.dispose();
        }
        this.visibilityMask.dispose();
    }
}

//  使う色の表。11種類用意している。
const colorTable = [new THREE.Color(1.0, 0.4, 1.0), new THREE.Color(0.87, 0.87, 0.0), new THREE.Color(0.0, 1.0, 1.0), new THREE.Color(1.0, 0.4, 0.1), new THREE.Color(0.25, 1.0, 0.25), new THREE.Color(0.55, 0.55, 1.0), new THREE.Color(1.0, 0.7, 0.1), new THREE.Color(0.1, 0.7, 1.0), new THREE.Color(0.775, 0.4, 1.0), new THREE.Color(1.0, 0.1, 0.7), new THREE.Color(0.1, 1.0, 0.7)];

// 同じ多胞体の胞でマテリアルと射影行列を共有する。
function makeMaterialTable(projection: THREE.Matrix4, visibilityMask: CellVisibilityMask): THREE.MeshPhongMaterial[] {
    return colorTable.map(color => {
        // Derivative-based flat shading uses the GPU-projected positions for
        // face normals, so no CPU normal updates are needed either.
        const material = new THREE.MeshPhongMaterial({
            color, side: THREE.DoubleSide, specular: 0x888888, shininess: 30, flatShading: true,
        });
        material.onBeforeRender = renderer => {
            // Data textures must not be silently resized: that would corrupt
            // cell indices. The square layout is minimal in its longest side.
            visibilityMask.assertFits(renderer.capabilities.maxTextureSize);
        };
        material.onBeforeCompile = shader => {
            shader.uniforms.projection4D = { value: projection };
            shader.uniforms.cellVisibility = { value: visibilityMask.texture };
            shader.vertexShader = `
uniform mat4 projection4D;
attribute float positionW;
attribute highp float cellIndex;
uniform highp sampler2D cellVisibility;
${shader.vertexShader}`.replace(
                '#include <begin_vertex>',
                // The projector stores basis vectors in matrix columns. A row
                // vector multiplication preserves the original rotation direction.
                'vec3 transformed = ( vec4( position, positionW ) * projection4D ).xyz;',
            ).replace(
                '#include <project_vertex>',
                `#include <project_vertex>
// WebGL2 integer texel lookup: no normalized UVs, filtering, or
// interpolation can mix neighboring cells. The CPU supplies an exact bit.
int visibilityWidth = textureSize( cellVisibility, 0 ).x;
int visibilityIndex = int( cellIndex );
ivec2 visibilityTexel = ivec2( visibilityIndex % visibilityWidth, visibilityIndex / visibilityWidth );
// All vertices of a cell share the same index, so the whole hidden
// triangle is outside the same clip plane.
if ( texelFetch( cellVisibility, visibilityTexel, 0 ).r < 0.5 ) {
    gl_Position = vec4( 2.0, 0.0, 0.0, 1.0 );
}`,
            );
        };
        material.customProgramCacheKey = () => 'polytope-projection-4d-cpu-mask-v3';
        return material;
    });
}

// ４次元中の３次元多面体のクラス。４次元多胞体の胞を表すのに使う。
export class Facet {
    vertices: Vector4[] = [];
    faces: number[][] = [];
    normal = new Vector4();//規格化されている。
    cellIndex = 0; // shared visibility-mask texel, constant across this cell
    triangleVertices: Vector4[] = []; //geometryに使うための頂点
    //    face3List: THREE.Face3[];  //geometryに使うためのFace3のリスト
    geometry: THREE.BufferGeometry | null = null; //geometry
    mesh: THREE.Mesh | null = null;
    projector: Projector | null = null;
    // 普通にgeometryを作る。
    makeSolidGeometry(createMesh: boolean = true) {
        this.dispose();
        this.geometry = new THREE.BufferGeometry();
        this.triangleVertices = this.vertices;
        const indices = polyhedronFaces(this.faces);
        this.geometry.setIndex(indices);
        this.initGeometryVertices();
        if (createMesh) {
            this.makeMesh();
        }
    }
    // 枠のgeometryを作る。
    makeFrameGeometry(ratio: number = 0.7, createMesh: boolean = true) {
        this.dispose();
        const frameVertices = this.vertices.slice();  //配列をコピー
        const frameFaces: number[] = [];
        for (let f of this.faces) {
            //面の中心を求める。
            const faceCenter = new Vector4(0, 0, 0, 0);
            for (let j of f) {
                faceCenter.add(this.vertices[j]);
            }
            faceCenter.multiplyScalar(1 / f.length);
            //面の内側の頂点を作っていく。
            const ff: number[] = []; //内側の頂点のラベル。fと同じ順。
            for (let j of f) {
                let v = this.vertices[j].clone();
                //面の中心とvertices[j]を1-ratio:ratioに分ける点をvとする。
                v.multiplyScalar(ratio);
                v.addScaledVector(faceCenter, 1 - ratio);
                ff.push(frameVertices.length);
                frameVertices.push(v);
            }
            //フレームの面を作る。
            for (let i = 0; i < f.length; i++) {
                let i1 = (i + 1) % f.length;
                frameFaces.push(f[i], f[i1], ff[i1]);
                frameFaces.push(f[i], ff[i1], ff[i]);
            }
        }
        this.geometry = new THREE.BufferGeometry();
        this.triangleVertices = frameVertices;
        this.geometry.setIndex(frameFaces);
        this.initGeometryVertices();
        if (createMesh) {
            this.makeMesh();
        }
    }
    // ４次元の頂点を一度だけ転送し、回転・射影は頂点シェーダーで行う。
    initGeometryVertices() {
        if (!this.geometry) {
            throw new Error("Geometry is not initialized.");
        }
        const vertices3 = new Float32Array(this.triangleVertices.length * 3);
        const verticesW = new Float32Array(this.triangleVertices.length);
        const cellIndices = new Float32Array(this.triangleVertices.length);
        cellIndices.fill(this.cellIndex);
        let radiusSquared = 0;
        this.triangleVertices.forEach((vertex, i) => {
            vertices3[i * 3] = vertex.x;
            vertices3[i * 3 + 1] = vertex.y;
            vertices3[i * 3 + 2] = vertex.z;
            verticesW[i] = vertex.w;
            radiusSquared = Math.max(radiusSquared, vertex.lengthSq());
        });
        this.geometry.setAttribute('position', new THREE.BufferAttribute(vertices3, 3));
        this.geometry.setAttribute('positionW', new THREE.BufferAttribute(verticesW, 1));
        this.geometry.setAttribute('cellIndex', new THREE.BufferAttribute(cellIndices, 1));
        // Rotation preserves 4D length and orthographic projection only reduces
        // it. Static xyz bounds would miss vertices rotated in from the w axis.
        this.geometry.boundingSphere = new THREE.Sphere(
            new THREE.Vector3(), Math.sqrt(radiusSquared) + EPSILON,
        );
    }
    // 胞が見える方にあるかのチェック
    checkVisibility() {
        if (!this.mesh || !this.projector) {
            return;
        }
        this.mesh.visible = this.projector.ifVisible(this.normal);
    }
    // メッシュを作る
    makeMesh() {
        if (!this.geometry || !this.projector) {
            throw new Error("Facet is not initialized.");
        }
        this.mesh = new THREE.Mesh(this.geometry, this.projector.materials[this.faces.length % 11]);
    }
    // 破棄
    dispose() {
        this.geometry?.dispose();
        this.geometry = null;
        this.mesh = null;
    }
}



export class Polytope {
    vertices: Vector4[] = []; //頂点
    faces: number[][] = [];  //面
    facetList: Facet[] = [];  //胞のリスト
    facetCenter: Vector4[] = []; //胞の中心のリスト
    facetToVertex?: number[][];//各胞に含まれる頂点のリスト
    facetToFace?: number[][];//各胞に含まれる面のリスト
    projector = new Projector();  // 射影の仕方。あるいは向き。
    object3D = new THREE.Group(); //全部まとめた３次元のオブジェクト
    prePolytope: PrePolytope | null = null; //JSONファイル出力のため用のデータ

    // JSONからそのまま読み込んだObjectから作って必要な初期化やる。
    // type はSolidかFrame
    initFromPrePolytope(prePolytope: PrePolytope, type: "Solid" | "Frame" = "Solid") {
        this.disposeGeometry();
        this.readJSONFile(prePolytope);
        this.makeFacetList();
        this.separate();
        if (type == "Solid") {
            this.makeSolidGeometry();
        } else if (type == "Frame") {
            this.makeFrameGeometry();
        } else {
            throw new Error('Type must be "Solid" or "Frame"');
        }
        this.prePolytope = prePolytope;
        return this;
    }
    // JSONからそのまま読み込んだObjectから作る。
    readJSONFile(prePolytope: PrePolytope) {
        this.vertices = vector4list(prePolytope.vertices);
        this.faces = prePolytope.faces;
        this.facetCenter = vector4list(prePolytope.facetCenters);
        this.facetToVertex = prePolytope.facetToVertex;
        this.facetToFace = prePolytope.facetToFace;
        normalize(this.vertices);
        normalize(this.facetCenter);
        return this;
    }

    // projectorを初期化。
    initProjector() {
        this.projector.dispose();
        this.projector = new Projector(this.facetCenter.length);
    }

    // 各胞の頂点のリストを作る。
    makeFacetToVertex() {
        this.facetToVertex = new Array(this.facetCenter.length);
        for (let i = 0; i < this.facetCenter.length; i++) {
            const center = this.facetCenter[i];
            // 胞の中心から最小の距離を求める
            const cvDistances = this.vertices.map(v => distance(center, v));//中心からの距離の配列
            const minDistance = Math.min(...cvDistances);//その中で最小のものをとる。
            // 胞の中心からの距離が最小の頂点が胞に属する頂点。
            const facetVertexList: number[] = [];
            for (let j = 0; j < this.vertices.length; j++) {
                if (eql(minDistance, distance(this.vertices[j], center))) {
                    facetVertexList.push(j);
                }
            }
            this.facetToVertex[i] = facetVertexList;
        }
    }
    // 各胞の面のリストを作る。
    makeFacetToFace() {
        if (!this.facetToVertex) {
            throw new Error("Facet vertices must be initialized before facet faces.");
        }
        const facetSetChecker = new SubsetChecker(this.vertices.length);
        this.facetToFace = new Array(this.facetCenter.length);
        for (let i = 0; i < this.facetCenter.length; i++) {
            const facesInTheFacet: number[] = [];
            facetSetChecker.clear();
            facetSetChecker.setElements(this.facetToVertex[i]);
            for (let j = 0; j < this.faces.length; j++) {
                if (facetSetChecker.ifSubset(this.faces[j])) {
                    facesInTheFacet.push(j);
                }
            }
            this.facetToFace[i] = facesInTheFacet;
        }
    }
    // 胞のリストを作る。
    makeFacetList() {
        this.initProjector();
        this.facetList = new Array(this.facetCenter.length);
        // thisのリストと新しく作る頂点のリストのインデックスの対応
        const vertexFacetTable: number[] = new Array(this.vertices.length);

        if (!this.facetToVertex) {
            this.makeFacetToVertex();
        }
        if (!this.facetToFace) {
            this.makeFacetToFace();
        }
        if (!this.facetToVertex || !this.facetToFace) {
            throw new Error("Facet index data could not be initialized.");
        }
        const facetToVertex = this.facetToVertex;
        const facetToFace = this.facetToFace;
        for (let i = 0; i < this.facetCenter.length; i++) {
            const facetVertexList = facetToVertex[i];
            const facesInTheFacet = facetToFace[i];
            // 胞ごとに頂点をcloneして頂点のリストを作る。
            const facetVertices: Vector4[] = new Array(facetVertexList.length);
            for (let j = 0; j < facetVertexList.length; j++) {
                facetVertices[j] = this.vertices[facetVertexList[j]].clone();
                vertexFacetTable[facetVertexList[j]] = j;//thisと新頂点リストの対応表をつくる。
            }
            // 胞に属する面を新しく作る。
            const facetFaces: number[][] = new Array(facesInTheFacet.length);
            // インデックスの読み替え
            for (let j = 0; j < facesInTheFacet.length; j++) {
                const f = this.faces[facesInTheFacet[j]];
                const face: number[] = new Array(f.length);
                for (let k = 0; k < f.length; k++) {
                    face[k] = vertexFacetTable[f[k]];
                }
                facetFaces[j] = face;
            }
            // 胞のクラスを作って設定。
            const facet = new Facet();
            facet.vertices = facetVertices;
            facet.faces = facetFaces;
            facet.normal = this.facetCenter[i].clone().normalize();
            facet.cellIndex = i;
            facet.projector = this.projector;
            // 胞をthisのリストに追加。
            this.facetList[i] = facet;
        }
        return this;
    }

    // 胞同士を話す。ratioは離す量。大きい方が離れる。
    separate(ratio: number = 0.1) {
        for (let f of this.facetList) {
            const direction = f.normal.clone().multiplyScalar(ratio);
            for (let vertex of f.vertices) {
                vertex.add(direction);
                vertex.normalize();
            }
        }
        return this;
    }

    // 色ごとに一つの静的geometryにまとめる。胞間で頂点を共有しない。
    private makeBatchedGeometry(type: "Solid" | "Frame") {
        this.disposeGeometry();
        const byColor = new Map<number, THREE.BufferGeometry[]>();
        try {
            for (const facet of this.facetList) {
                if (type === "Solid") {
                    facet.makeSolidGeometry(false);
                } else {
                    facet.makeFrameGeometry(0.7, false);
                }
                const colorIndex = facet.faces.length % colorTable.length;
                const geometries = byColor.get(colorIndex) ?? [];
                geometries.push(facet.geometry!);
                byColor.set(colorIndex, geometries);
            }
            for (const [colorIndex, geometries] of byColor) {
                // No geometry groups: one material and one draw call per color.
                // mergeGeometries promotes indices to Uint32 when necessary.
                const geometry = mergeGeometries(geometries, false);
                if (!geometry) {
                    throw new Error("Cell geometry could not be batched.");
                }
                let radius = 0;
                for (const source of geometries) {
                    radius = Math.max(radius, source.boundingSphere!.radius);
                }
                geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), radius);
                this.object3D.add(new THREE.Mesh(geometry, this.projector.materials[colorIndex]));
            }
        } catch (error) {
            this.disposeGeometry();
            throw error;
        } finally {
            // Only the merged buffers are rendered/retained. Cell topology and
            // original Vector4 vertices remain available for JSON/export tools.
            for (const facet of this.facetList) {
                facet.dispose();
            }
        }
        this.checkVisibility();
        return this;
    }

    makeSolidGeometry() {
        return this.makeBatchedGeometry("Solid");
    }

    makeFrameGeometry() {
        return this.makeBatchedGeometry("Frame");
    }

    // Keep the original double-precision expression and operation order in
    // Projector.ifVisible. Only a changed visibility bit schedules an upload;
    // positions, indices and per-vertex cell IDs stay static.
    checkVisibility() {
        const { data, texture } = this.projector.visibilityMask;
        let changed = false;
        for (let i = 0; i < this.facetList.length; i++) {
            const value = this.projector.ifVisible(this.facetList[i].normal) ? 255 : 0;
            if (data[i] !== value) {
                data[i] = value;
                changed = true;
            }
        }
        if (changed) {
            texture.needsUpdate = true;
        }
        return this;
    }

    private disposeGeometry() {
        for (const child of this.object3D.children) {
            if (child instanceof THREE.Mesh) {
                child.geometry.dispose();
            }
        }
        this.object3D.clear();
        for (const facet of this.facetList) {
            facet.dispose();
        }
    }
    //projectorの回転。
    applyMatrix4(m: THREE.Matrix4) {
        this.projector.applyMatrix4(m);
        return this;
    }
    //projectorを恒等写像に戻す。
    identityProjector() {
        this.projector.identity();
        return this;
    }
    //geometryの破棄
    dispose() {
        this.disposeGeometry();
        this.projector.dispose();
        return this;
    }
    //詳しい情報も加えたJSONファイルを出力
    getFullJSONData(): string {
        if (!this.prePolytope) {
            throw new Error("Polytope data is not initialized.");
        }
        this.prePolytope.facetToVertex = this.facetToVertex;
        this.prePolytope.facetToFace = this.facetToFace;
        return JSON.stringify(this.prePolytope);
    }
}
