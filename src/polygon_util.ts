import * as THREE from "three";

//多角形をTHREE.Face3に分けてリストにする
export function polygonTriangulation(vertexlist: number[]): THREE.Face3[]{
    const trianglelist: THREE.Face3[] = [];
    for(var i=1;i<vertexlist.length-1;i++){
        trianglelist.push(new THREE.Face3(vertexlist[0], vertexlist[i], vertexlist[i+1]));
    }
    return trianglelist;
}

// 多角形のリストをTHREE.Face3のリストにする
export function polyhedronFaces(facelist: number[][]): THREE.Face3[]{
    const trianglelist: THREE.Face3[]=[];
    for(var face of facelist){
        if(face.length<4){
            trianglelist.push(new THREE.Face3(face[0],face[1],face[2]));
        } else {
            Array.prototype.push.apply(trianglelist, polygonTriangulation(face));
            //trianglelist = trianglelist.concat(face);
        }
    }
    return trianglelist;
}

// 多面体のクラス。
export class Polyhedron{
    vertices: THREE.Vector3[];
    faces: number[][];

    // three.js のgeometryを返す。
    geometrize(): THREE.Geometry{
        const threefaces: THREE.Face3[] = polyhedronFaces(this.faces);
        const geom = new THREE.Geometry();
        geom.vertices = this.vertices;
        geom.faces = threefaces;
        geom.computeFaceNormals();
        return geom;
    }

    // 面に穴を開けた形（フレーム）の状態のthree.jsのgeometryを返す。
    frameGeometrize(ratio:number = 0.8){
        const framevertices = this.vertices.slice();  //配列をコピー
        const framefaces: THREE.Face3[] = [];
        for(let f of this.faces){
            //面の中心を求める。
            const faceCenter = new THREE.Vector3(0,0,0);
            for(let j of f){
                faceCenter.add(this.vertices[j]);
            }
            faceCenter.multiplyScalar(1/f.length);
            //面の内側の頂点を作っていく。
            const ff: number[] = []; //内側の頂点のラベル。fと同じ順。
            for(let j of f){
                let v = this.vertices[j].clone();
                //面の中心とvertices[j]を1-ratio:ratioに分ける点をvとする。
                v.multiplyScalar(ratio);
                v.addScaledVector(faceCenter,1-ratio);
                ff.push(framevertices.length);
                framevertices.push(v);
            }
            //フレームの面を作る。
            for(let i=0; i< f.length; i++){
                let i1 = (i+1) % f.length;
                framefaces.push(new THREE.Face3(f[i], f[i1], ff[i1]));
                framefaces.push(new THREE.Face3(f[i], ff[i1], ff[i]));                
            }
        }
        const geom = new THREE.Geometry();
        geom.vertices = framevertices;
        geom.faces = framefaces;
        geom.computeFaceNormals;
        return geom;
    }
}

// pythonとかにあるrangeと同じ。startから始まってend-1までの整数の配列を作る。
const range =
    (start: number, end: number) => Array.from({ length: (end - start) }, (v, k) => k + start);

export function prism(n: number, hight: number = 2): Polyhedron {
    const vertices: THREE.Vector3[] = new Array(n * 2);
    for (let i = 0; i < n; i++) {
        vertices[i] = new THREE.Vector3(Math.cos(2 * Math.PI * i / n), Math.sin(2 * Math.PI * i / n), hight / 2);
        vertices[i + n] = new THREE.Vector3(Math.cos(2 * Math.PI * i / n), Math.sin(2 * Math.PI * i / n), -hight / 2);
    }
    const polygonlist: number[][] = [];
    polygonlist.push(range(0, n));
    polygonlist.push(range(n, 2 * n).reverse());
    for (let i = 0; i < n; i++) {
        let i1 = (i + 1) % n;
        polygonlist.push([i, i + n, i1 + n, i1]);
    }
    const poly = new Polyhedron();
    poly.vertices = vertices;
    poly.faces = polygonlist
    return poly;
}


