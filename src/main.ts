import * as THREE from "three";
//import * as pu from "./polygon_util";
import * as pt from "./polytope";

window.addEventListener("DOMContentLoaded", main);

function main(){
    fetch('data/c16thw.json')
        .then(response => response.json())
        .then(json => {
            init(json,"Frame");
        });
}

//  画面を初期化し、物体を置き、アニメーションを定義する。
// modeは"Solid"または"Frame"
function init(prePolytope:Object, mode:string="Solid"): void{
    // レンダラーを作成
    const renderer = new THREE.WebGLRenderer();
    // レンダラーのサイズを設定
    renderer.setSize(1600, 1200);
    renderer.setClearColor(new THREE.Color(0x888888));
    // canvasをbodyに追加
    document.body.appendChild(renderer.domElement);

    // シーンを作成
    const scene = new THREE.Scene();

    // カメラを作成
    const camera = new THREE.PerspectiveCamera(30, 800 / 600, 0.1, 500);
    camera.position.set(0, 0, 5);
    camera.lookAt(scene.position);

    // 物体を作成
    const polytope = new pt.Polytope();
    polytope.initFromPrePolytope(prePolytope, mode);
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
    scene.fog = new THREE.Fog(0xffffff, 2, 8);

    //４次元回転のための行列
    const rotation = pt.rotationMatrix4(0.01, 23).multiply(pt.rotationMatrix4(0.01, 12)).multiply(pt.rotationMatrix4(0.01,3));
    //アニメーションの設定
    const tick = (): void => {
        requestAnimationFrame(tick);

        theObject.rotation.x += 0.01;
        theObject.rotation.y += 0.01;
        polytope.applyMatrix4(rotation);
        polytope.projectVertices();
        polytope.checkVisibility();
        // 描画
        renderer.render(scene, camera);
    };
    tick();
}
