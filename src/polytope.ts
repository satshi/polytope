import * as THREE from "three";
import { Vector4, Vector3 } from "three";

//====================================================================
// 補助関数・定数
//====================================================================

// ごく小さい数
const EPSILON = 1.0e-5;

// 誤差を除いて等しいか？
function eql(a: number, b: number) {
    return Math.abs(a - b) < EPSILON;
}

// 4成分の数値配列の配列から Vector4 の配列を作成
function vector4list(numberList: number[][]): Vector4[] {
    const len = numberList.length;
    const veclist: Vector4[] = new Array(len);
    for (let i = 0; i < len; i++) {
        veclist[i] = new Vector4(numberList[i][0], numberList[i][1], numberList[i][2], numberList[i][3]);
    }
    return veclist;
}

// Vector4 の配列の各要素を正規化する
function normalize(vectors: Vector4[]) {
    for (let v of vectors) {
        v.normalize();
    }
}

// 4次元ベクトル同士の距離
function distance(v1: Vector4, v2: Vector4): number {
    return new Vector4().subVectors(v1, v2).length();
}

// 0〜(n-1)までの整数全体の部分集合かどうかをチェックするクラス
class SubsetChecker {
    n: number;
    elements: boolean[];
    constructor(n: number) {
        this.n = n;
        this.elements = new Array(n).fill(false);
    }
    clear() {
        this.elements.fill(false);
    }
    setElements(set: number[]) {
        for (let i of set) {
            this.elements[i] = true;
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

//====================================================================
// 4次元回転行列（angle: ラジアン、direction: 2桁の数字、例：23は2と3の面の回転）
export function rotationMatrix4(angle: number, direction: number): THREE.Matrix4 {
    const cos_a = Math.cos(angle);
    const sin_a = Math.sin(angle);
    const array = new Array(16).fill(0);
    const d2 = direction % 10;
    const d1 = (direction - d2) / 10;
    // 単位行列に初期化
    for (let i = 0; i < 4; i++) {
        array[i + 4 * i] = 1;
    }
    array[d1 + 4 * d1] = cos_a;
    array[d2 + 4 * d2] = cos_a;
    array[d1 + 4 * d2] = sin_a;
    array[d2 + 4 * d1] = -sin_a;
    return new THREE.Matrix4().fromArray(array);
}

//====================================================================
// 4次元→3次元への射影クラス
//====================================================================
class Projector {
    pmatrix: THREE.Matrix4;
    constructor() {
        this.pmatrix = new THREE.Matrix4();
    }
    identity() {
        this.pmatrix.identity();
    }
    // 4次元ベクトル v4 を射影して v3 にセットする
    project(v3: Vector3, v4: Vector4) {
        const m = this.pmatrix.elements;
        v3.set(
            v4.x * m[0] + v4.y * m[1] + v4.z * m[2] + v4.w * m[3],
            v4.x * m[4] + v4.y * m[5] + v4.z * m[6] + v4.w * m[7],
            v4.x * m[8] + v4.y * m[9] + v4.z * m[10] + v4.w * m[11]
        );
    }
    // 法線ベクトルから、射影後に見えるかどうか判定する
    ifVisible(normal: Vector4): boolean {
        const m = this.pmatrix.elements;
        return normal.x * m[12] + normal.y * m[13] + normal.z * m[14] + normal.w * m[15] > 0;
    }
    // 4次元行列を乗算する（主に回転用）
    applyMatrix4(m: THREE.Matrix4) {
        this.pmatrix = this.pmatrix.multiply(m);
    }
}

//====================================================================
// 色・マテリアル設定
//====================================================================
const colorTable = [
    new THREE.Color(1.0, 0.6, 1.0),
    new THREE.Color(0.87, 0.87, 0.0),
    new THREE.Color(0.3, 1.0, 1.0),
    new THREE.Color(1.0, 0.6, 0.4),
    new THREE.Color(0.5, 1.0, 0.5),
    new THREE.Color(0.7, 0.7, 1.0),
    new THREE.Color(1.0, 0.8, 0.4),
    new THREE.Color(0.4, 0.8, 1.0),
    new THREE.Color(0.85, 0.6, 1.0),
    new THREE.Color(1.0, 0.4, 0.8),
    new THREE.Color(0.4, 1.0, 0.8)
];

function computeFlatNormals( geometry: THREE.BufferGeometry ) {
    // ここでは、ジオメトリが非インデックス化（展開済み）になっている前提です。
    const posAttr = geometry.getAttribute('position');
    const count = posAttr.count;
    const normals = new Float32Array( count * 3 );
    const pA = new THREE.Vector3(), pB = new THREE.Vector3(), pC = new THREE.Vector3();
    const cb = new THREE.Vector3(), ab = new THREE.Vector3();
    
    // 各三角形ごとに flat な法線を計算
    for (let i = 0; i < count; i += 3) {
        pA.fromBufferAttribute( posAttr, i );
        pB.fromBufferAttribute( posAttr, i + 1 );
        pC.fromBufferAttribute( posAttr, i + 2 );
        
        // 辺のベクトルを計算し、外積で法線を求める
        cb.subVectors( pC, pB );
        ab.subVectors( pA, pB );
        cb.cross( ab ).normalize();
        
        // 同じ法線を3頂点にセット
        for (let j = 0; j < 3; j++) {
            normals[(i+j) * 3    ] = cb.x;
            normals[(i+j) * 3 + 1] = cb.y;
            normals[(i+j) * 3 + 2] = cb.z;
        }
    }
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
}


const materialTable = colorTable.map(c => {
    // flatShading:true を指定して平坦なシェーディングにする
    const material = new THREE.MeshPhongMaterial({ side: THREE.DoubleSide, specular: 0x888888, flatShading: true });
    material.color = c;
    return material;
});

//====================================================================
// Facet クラス（4次元中の3次元多面体の胞を表す）
//====================================================================
export class Facet {
    // この胞で用いる頂点（Polytope.makeFacetList()で設定）
    vertices: Vector4[];
    // 各面は、vertices 配列のインデックスの配列で表される
    faces: number[][];
    // 胞全体の法線（正規化済み）
    normal: Vector4;
    // BufferGeometry を用いるので geometry は BufferGeometry 型
    geometry: THREE.BufferGeometry;
    mesh: THREE.Mesh;
    projector: Projector;
    
    // 展開済み頂点配列（non-indexed 用：各面ごとに独立の頂点が入る）
    triangleVertices: Vector4[];

    // Solid 表示用ジオメトリ作成
    makeSolidGeometry() {
        // 各面（face）ごとに、三角形ファン方式で頂点を展開して新たな配列を作成
        const expandedTriangleVertices: Vector4[] = [];
        for (const face of this.faces) {
            if (face.length === 3) {
                expandedTriangleVertices.push(
                    this.vertices[face[0]].clone(),
                    this.vertices[face[1]].clone(),
                    this.vertices[face[2]].clone()
                );
            } else if (face.length > 3) {
                // 三角形ファン方式： face[0] を固定して (face[0], face[i], face[i+1]) とする
                for (let i = 1; i < face.length - 1; i++) {
                    expandedTriangleVertices.push(
                        this.vertices[face[0]].clone(),
                        this.vertices[face[i]].clone(),
                        this.vertices[face[i + 1]].clone()
                    );
                }
            }
        }
        // この expandedTriangleVertices を triangleVertices として保持
        this.triangleVertices = expandedTriangleVertices;
        const numExpanded = expandedTriangleVertices.length;
        // BufferGeometry を作成（非インデックス化：各頂点が独立している）
        this.geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(numExpanded * 3);
        this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        // 初期の射影結果を反映
        this.projectVertices();
        // 共有頂点がなくなっているので、computeVertexNormals() で各面ごとの平坦な法線が得られる
        computeFlatNormals(this.geometry);
        this.makeMesh();
    }
    
    // Frame 表示用ジオメトリ作成
    // ※ こちらは内側頂点も追加して展開済み頂点配列を作る（更新はしない想定）
    makeFrameGeometry(ratio: number = 0.7) {
        const frameVertices: Vector4[] = [];
        // まず、各 face について、元の頂点を展開すると同時に内側頂点も作成する
        const expandedTriangleVertices: Vector4[] = [];
        for (const face of this.faces) {
            // 面の中心を計算（元の vertices を使う）
            const faceCenter = new Vector4(0, 0, 0, 0);
            for (const idx of face) {
                faceCenter.add(this.vertices[idx]);
            }
            faceCenter.multiplyScalar(1 / face.length);
            
            // 外側頂点（元の頂点）を展開する
            const outer: Vector4[] = [];
            for (const idx of face) {
                outer.push(this.vertices[idx].clone());
            }
            // 内側頂点を計算（元の頂点から面中心へ向けて内分）
            const inner: Vector4[] = [];
            for (const v of outer) {
                const vInner = v.clone();
                vInner.multiplyScalar(ratio);
                vInner.addScaledVector(faceCenter, 1 - ratio);
                inner.push(vInner);
            }
            // 各辺ごとに、外側頂点と内側頂点を使って枠状（2つの三角形）に展開
            const n = face.length;
            for (let i = 0; i < n; i++) {
                const next = (i + 1) % n;
                // 三角形 1: (outer[i], outer[next], inner[next])
                expandedTriangleVertices.push(outer[i].clone(), outer[next].clone(), inner[next].clone());
                // 三角形 2: (outer[i], inner[next], inner[i])
                expandedTriangleVertices.push(outer[i].clone(), inner[next].clone(), inner[i].clone());
            }
        }
        // 展開済み頂点を保持
        this.triangleVertices = expandedTriangleVertices;
        const numExpanded = expandedTriangleVertices.length;
        this.geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(numExpanded * 3);
        this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        // 初期の射影結果を反映
        this.projectVertices();
        computeFlatNormals(this.geometry);
        this.makeMesh();
    }
    
    // projectVertices() は、展開済み頂点配列（this.triangleVertices）から各頂点を射影して位置属性を更新する
    projectVertices() {
        const posAttr = this.geometry.getAttribute('position') as THREE.BufferAttribute;
        if (this.triangleVertices) {
            for (let i = 0; i < this.triangleVertices.length; i++) {
                const v4 = this.triangleVertices[i];
                const v3 = new Vector3();
                this.projector.project(v3, v4);
                posAttr.setXYZ(i, v3.x, v3.y, v3.z);
            }
        }
        posAttr.needsUpdate = true;
    }
    
    // 胞の可視性チェック（projector の状態から判断）
    checkVisibility() {
        this.mesh.visible = this.projector.ifVisible(this.normal);
    }
    
    // Mesh を生成
    makeMesh() {
        this.mesh = new THREE.Mesh(this.geometry, materialTable[this.faces.length % materialTable.length]);
    }
    
    dispose() {
        this.mesh.geometry.dispose();
    }
}

//====================================================================
// Polytope クラス（4次元多胞体全体を表す）
//====================================================================
export class Polytope {
    vertices: Vector4[];       // JSON から読み込んだ頂点
    faces: number[][];         // JSON から読み込んだ面
    facetList: Facet[];        // 各胞のリスト
    facetCenter: Vector4[];    // JSON から読み込んだ胞の中心
    facetToVertex: number[][]; // 各胞に属する頂点のリスト
    facetToFace: number[][];   // 各胞に属する面のリスト
    projector: Projector;
    object3D: THREE.Group;     // すべての Mesh をまとめた 3次元オブジェクト
    prePolytope: Object;       // 元の JSON オブジェクト（出力用）
    
    // JSON から読み込んだオブジェクトから初期化（type: "Solid" または "Frame"）
    initFromPrePolytope(prePolytope: Object, type: string = "Solid") {
        this.readJSONFile(prePolytope);
        this.initProjector();
        this.makeFacetList();
        this.separate();
        if (type === "Solid") {
            this.makeSolidGeometry();
        } else if (type === "Frame") {
            this.makeFrameGeometry();
        } else {
            throw 'Type must be "Solid" or "Frame"';
        }
        this.prePolytope = prePolytope;
        return this;
    }
    
    // JSON から各種データを読み込む
    readJSONFile(prePolytope: Object) {
        this.vertices = vector4list(prePolytope["vertices"]);
        this.faces = prePolytope["faces"];
        this.facetCenter = vector4list(prePolytope["facetCenters"]);
        this.facetToVertex = prePolytope["facetToVertex"];
        this.facetToFace = prePolytope["facetToFace"];
        normalize(this.vertices);
        normalize(this.facetCenter);
        return this;
    }
    
    initProjector() {
        this.projector = new Projector();
    }
    
    // 各胞の頂点リストを作成する
    makeFacetToVertex() {
        this.facetToVertex = new Array(this.facetCenter.length);
        for (let i = 0; i < this.facetCenter.length; i++) {
            const center = this.facetCenter[i];
            const cvDistances = this.vertices.map(v => distance(center, v));
            const minDistance = Math.min(...cvDistances);
            const facetVertexList: number[] = [];
            for (let j = 0; j < this.vertices.length; j++) {
                if (eql(minDistance, distance(this.vertices[j], center))) {
                    facetVertexList.push(j);
                }
            }
            this.facetToVertex[i] = facetVertexList;
        }
    }
    
    // 各胞の面リストを作成する
    makeFacetToFace() {
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
    
    // 各胞のリストを作成する
    makeFacetList() {
        this.initProjector();
        this.facetList = new Array(this.facetCenter.length);
        const vertexFacetTable: number[] = new Array(this.vertices.length);
        if (!this.facetToVertex) {
            this.makeFacetToVertex();
        }
        if (!this.facetToFace) {
            this.makeFacetToFace();
        }
        for (let i = 0; i < this.facetCenter.length; i++) {
            const facetVertexList = this.facetToVertex[i];
            const facesInTheFacet = this.facetToFace[i];
            const facetVertices: Vector4[] = new Array(facetVertexList.length);
            for (let j = 0; j < facetVertexList.length; j++) {
                facetVertices[j] = this.vertices[facetVertexList[j]].clone();
                vertexFacetTable[facetVertexList[j]] = j;
            }
            const facetFaces: number[][] = new Array(facesInTheFacet.length);
            for (let j = 0; j < facesInTheFacet.length; j++) {
                const f = this.faces[facesInTheFacet[j]];
                const face: number[] = new Array(f.length);
                for (let k = 0; k < f.length; k++) {
                    face[k] = vertexFacetTable[f[k]];
                }
                facetFaces[j] = face;
            }
            const facet = new Facet();
            facet.vertices = facetVertices;
            facet.faces = facetFaces;
            facet.normal = this.facetCenter[i].clone().normalize();
            facet.projector = this.projector;
            this.facetList[i] = facet;
        }
        return this;
    }
    
    // 各胞同士を少し離す（ratio: 調整パラメータ）
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
    
    // Solid 表示用ジオメトリ作成
    makeSolidGeometry() {
        this.object3D = new THREE.Group();
        for (let f of this.facetList) {
            f.makeSolidGeometry();
            this.object3D.add(f.mesh);
        }
        return this;
    }
    
    // Frame 表示用ジオメトリ作成
    makeFrameGeometry() {
        this.object3D = new THREE.Group();
        for (let f of this.facetList) {
            f.makeFrameGeometry();
            this.object3D.add(f.mesh);
        }
        return this;
    }
    
    // すべての胞で射影更新
    projectVertices() {
        for (let f of this.facetList) {
            f.projectVertices();
        }
        return this;
    }
    
    // すべての胞で可視性チェック
    checkVisibility() {
        for (let f of this.facetList) {
            f.checkVisibility();
        }
        return this;
    }
    
    // projector に回転を適用
    applyMatrix4(m: THREE.Matrix4) {
        this.projector.applyMatrix4(m);
        return this;
    }
    
    // projector を恒等写像に戻す
    identityProjector() {
        this.projector.identity();
        return this;
    }
    
    dispose() {
        for (let f of this.facetList) {
            f.dispose();
        }
        return this;
    }
    
    // 詳細情報付き JSON を出力
    getFullJSONData(): string {
        this.prePolytope["facetToVertex"] = this.facetToVertex;
        this.prePolytope["facetToFace"] = this.facetToFace;
        return JSON.stringify(this.prePolytope);
    }
}
