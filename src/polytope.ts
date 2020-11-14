import * as THREE from "three";
import { Vector4, Vector3} from "three";

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

//多角形をTHREE.Face3に分けてリストにする
function polygonTriangulation(vertexList: number[]): THREE.Face3[] {
    const triangleList: THREE.Face3[] = [];
    for (var i = 1; i < vertexList.length - 1; i++) {
        triangleList.push(new THREE.Face3(vertexList[0], vertexList[i], vertexList[i + 1]));
    }
    return triangleList;
}

// 多角形のリストをTHREE.Face3のリストにする
function polyhedronFaces(faceList: number[][]): THREE.Face3[] {
    const triangleList: THREE.Face3[] = [];
    for (var face of faceList) {
        if (face.length < 4) {
            triangleList.push(new THREE.Face3(face[0], face[1], face[2]));
        } else {
            Array.prototype.push.apply(triangleList, polygonTriangulation(face));
            //triangleList = triangleList.concat(face);
        }
    }
    return triangleList;
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

class Projector {
    pmatrix: THREE.Matrix4;
    constructor() {
        this.pmatrix = new THREE.Matrix4();
    }
    identity() {
        this.pmatrix.identity();
    }
    // v4を射影した後の値をv3に代入する。
    project(v3: Vector3, v4: Vector4) {
        const m = this.pmatrix.elements;
        v3.set(
            v4.x * m[0] + v4.y * m[1] + v4.z * m[2] + v4.w * m[3],
            v4.x * m[4] + v4.y * m[5] + v4.z * m[6] + v4.w * m[7],
            v4.x * m[8] + v4.y * m[9] + v4.z * m[10] + v4.w * m[11],
            );
    }
    // 胞の法線ベクトルを入れて見えるか否かを返す。
    ifVisible(normal: Vector4): boolean {
        const m = this.pmatrix.elements;
        return normal.x * m[12] + normal.y * m[13] + normal.z * m[14] + normal.w * m[15] > 0;
    }
    applyMatrix4(m: THREE.Matrix4) {
        this.pmatrix = this.pmatrix.multiply(m);
    }
}

const colorTable = [new THREE.Color(1.0, 0.6, 1.0), new THREE.Color(0.87, 0.87, 0.), new THREE.Color(0.3, 1.0, 1.0), new THREE.Color(1.0, 0.6, 0.4), new THREE.Color(0.5, 1.0, 0.5), new THREE.Color(0.7, 0.7, 1.0), new THREE.Color(1.0, 0.8, 0.4), new THREE.Color(0.4, 0.8, 1.0), new THREE.Color(0.85, 0.6, 1.0), new THREE.Color(1.0, 0.4, 0.8), new THREE.Color(0.4, 1.0, 0.8)];

const materialTable = colorTable.map(c => {
    const material = new THREE.MeshPhongMaterial({ side: THREE.DoubleSide, specular: 0x888888, flatShading: true });
//    const material = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide});
    material.color = c;
    return material;
});

// ４次元中の３次元多面体のクラス。４次元多胞体の胞を表すのに使う。
export class Facet {
    vertices: Vector4[];
    faces: number[][];
    normal: Vector4;//規格化されている。
    triangleVertices: Vector4[]; //geometryに使うための頂点
    //    face3List: THREE.Face3[];  //geometryに使うためのFace3のリスト
    geometry: THREE.Geometry; //geometry
    mesh: THREE.Mesh;
    projector: Projector;
    // 普通にgeometryを作る。
    makeSolidGeometry() {
        this.geometry = new THREE.Geometry();
        this.triangleVertices = this.vertices;
        this.geometry.faces = polyhedronFaces(this.faces);
        this.initGeometryVertices();
        this.projectVertices();
        this.makeMesh();
    }
    // 枠のgeometryを作る。
    makeFrameGeometry(ratio: number = 0.7) {
        const frameVertices = this.vertices.slice();  //配列をコピー
        const frameFaces: THREE.Face3[] = [];
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
                frameFaces.push(new THREE.Face3(f[i], f[i1], ff[i1]));
                frameFaces.push(new THREE.Face3(f[i], ff[i1], ff[i]));
            }
        }
        this.geometry = new THREE.Geometry();
        this.triangleVertices = frameVertices;
        this.geometry.faces = frameFaces;
        this.initGeometryVertices();
        this.makeMesh();
        this.projectVertices();
    }
    // とりあえず３次元頂点を意味のない値で初期化。
    initGeometryVertices() {
        const vertices3: Vector3[] = new Array(this.triangleVertices.length);
        for (let i = 0; i < this.triangleVertices.length; i++) {
            vertices3[i] = new Vector3();
        }
        this.geometry.vertices = vertices3;
    }
    // 射影した頂点を作る。
    projectVertices() {
        for (let i = 0; i < this.triangleVertices.length; i++) {
            this.projector.project(this.geometry.vertices[i], this.triangleVertices[i]);
        }
        this.geometry.verticesNeedUpdate = true;
        this.geometry.computeFaceNormals();
    }
    // 胞が見える方にあるかのチェック
    checkVisibility() {
        this.mesh.visible = this.projector.ifVisible(this.normal);
    }
    // メッシュを作る
    makeMesh() {
        this.mesh = new THREE.Mesh(this.geometry, materialTable[this.faces.length % 11]);
    }
    // 破棄
    dispose(){
        this.mesh.geometry.dispose();
    }
}



export class Polytope {
    vertices: Vector4[]; //頂点
    faces: number[][];  //面
    facetList: Facet[];  //胞のリスト
    facetCenter: Vector4[]; //胞の中心のリスト
    projector: Projector;  // 射影の仕方。あるいは向き。
    object3D: THREE.Group; //全部まとめた３次元のオブジェクト

    // JSONからそのまま読み込んだObjectから作って必要な初期化やる。
    // type はSolidかFrame
    initFromPrePolytope(prePolytope: Object, type: string = "Solid") {
        this.readJSONFile(prePolytope);
        this.initProjector();
        this.makeFacetList();
        this.separate();
        if (type == "Solid") {
            this.makeSolidGeometry();
        } else if (type == "Frame") {
            this.makeFrameGeometry();
        } else {
            throw 'Type must be "Solid" or "Frame"';
        }
        return this;
    }
    // JSONからそのまま読み込んだObjectから作る。
    readJSONFile(prePolytope: Object) {
        this.vertices = vector4list(prePolytope["vertices"]);
        this.faces = prePolytope["faces"];
        this.facetCenter = vector4list(prePolytope["facetCenters"]);
        normalize(this.vertices);
        normalize(this.facetCenter);
        return this;
    }

    // projectorを初期化。
    initProjector() {
        this.projector = new Projector();
    }
    // 胞のリストを作る。
    makeFacetList() {
        this.initProjector();
        this.facetList = new Array(this.facetCenter.length);
        const facetSetChecker = new SubsetChecker(this.vertices.length);
        // thisのリストと新しく作る頂点のリストのインデックスの対応
        const vertexFacetTable: number[] = new Array(this.vertices.length);
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
            facetSetChecker.clear();
            facetSetChecker.setElements(facetVertexList);
            const facesInTheFacet: number[] = [];
            for (let j = 0; j < this.faces.length; j++) {
                if (facetSetChecker.ifSubset(this.faces[j])) {
                    facesInTheFacet.push(j);
                }
            }
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
            facet.normal = center.clone().normalize();
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

    //すべての胞でgeometryを作る。
    makeSolidGeometry() {
        this.object3D = new THREE.Group();
        for (let f of this.facetList) {
            f.makeSolidGeometry();
            this.object3D.add(f.mesh);
        }
        return this;
    }

    //すべての胞でgeometryを作る。
    makeFrameGeometry() {
        this.object3D = new THREE.Group();
        for (let f of this.facetList) {
            f.makeFrameGeometry();
            this.object3D.add(f.mesh);
        }
        return this;
    }

    //すべての胞で射影
    projectVertices() {
        for (let f of this.facetList) {
            f.projectVertices();
        }
        return this;
    }
    //すべての胞で見えるかのチェック
    checkVisibility() {
        for (let f of this.facetList) {
            f.checkVisibility();
        }
        return this;
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
    dispose(){
        for (let f of this.facetList) {
            f.dispose();
        }
        return this;
    }
}
