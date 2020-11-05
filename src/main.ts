/// <reference path = "polygon_util.ts" />
import * as THREE from "three";
import * as pu from "./polygon_util";
import * as pt from "./polytope";

window.addEventListener("DOMContentLoaded", main);

function main(){
    fetch("data/c120.json")
        .then(response => response.json())
        .then(json => {
            init(json);
        });
}

//  画面を初期化し、物体を置き、アニメーションを定義する。
function init(prePolytope:Object): void{
    // レンダラーを作成
    const renderer = new THREE.WebGLRenderer();
    // レンダラーのサイズを設定
    renderer.setSize(800, 600);
    renderer.setClearColor(new THREE.Color(0x888888));
    // canvasをbodyに追加
    document.body.appendChild(renderer.domElement);

    // シーンを作成
    const scene = new THREE.Scene();

    // カメラを作成
    const camera = new THREE.PerspectiveCamera(45, 800 / 600, 0.1, 1000);
    camera.position.set(0, 0, 5);
    camera.lookAt(scene.position);

    // 物体を作成
    const polytope = new pt.Polytope();
    polytope.initFromPrePolytope(prePolytope, "Frame");
    const theObject = polytope.object3D;
    scene.add(theObject);

    // 平行光源を生成
    const light = new THREE.DirectionalLight(0xffffff);
    light.position.set(1, 1, 1);
    scene.add(light);

    // アンビエントライトを生成
    const ambientLight = new THREE.AmbientLight(new THREE.Color(0x333333));
    ambientLight.position.set(1, 1, 1);
    scene.add(ambientLight);

    //フォグを生成
    scene.fog = new THREE.Fog(0xffffff, 2, 9);

    //４次元回転のための行列
    const rotation = pt.rotationMatrix4(0.02, 23).multiply(pt.rotationMatrix4(0.02, 12)).multiply(pt.rotationMatrix4(0.02,3));
    //アニメーションの設定
    const tick = (): void => {
        requestAnimationFrame(tick);

        theObject.rotation.x += 0.02;
        theObject.rotation.y += 0.02;
        polytope.applyMatrix4(rotation);
        polytope.projectVertices();
        polytope.checkVisibility();
        // 描画
        renderer.render(scene, camera);
    };
    tick();
}

// function initPolytope(fileName: string): pt.Polytope{
//     const polytope = new pt.Polytope();
//     polytope.initFromFile(fileName);
//     return polytope;
// }

//物体を定義する。
function makeObject(): THREE.Mesh {
    const geom: THREE.Geometry = pu.prism(4).frameGeometrize(0.8);
    const material = new THREE.MeshPhongMaterial({ color: 0x22aa11, side: THREE.DoubleSide, specular: 0xaaaaaa, flatShading:true});
    const box = new THREE.Mesh(geom, material);
    return box;
}

