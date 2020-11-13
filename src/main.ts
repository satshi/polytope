import * as THREE from "three";
//import { AlphaFormat } from "three";
//import * as pu from "./polygon_util";
import * as pt from "./polytope";

//window.addEventListener("DOMContentLoaded", main);

document.getElementById("pbtn").addEventListener('click',main);
pullDownMenu();
document.getElementById("series").addEventListener('change',pullDownMenu);
window.addEventListener('resize', onResize, false);
document.getElementById("auto").addEventListener('click', autoClick)
document.getElementById("stop").addEventListener('click', stopClick)

function main(){
    const dataDir = 'data/';
    const dataExt = '.json';
    const basename = getBaseName();
    //const basename = (<HTMLInputElement> document.getElementById("polytopename")).value;
    const mode = (<HTMLInputElement> document.getElementById("ifframe")).checked ? "Frame" : "Solid"
    const fullname = dataDir + basename + dataExt;
    const contents = document.getElementById('contents');
    contents.textContent = 'Please wait.';
    fetch(fullname)
        .then(response => response.json())
        .then(json => {
            init(json,mode);
        })
        .catch((error)=>{
            // const fs = require('fs');
            // fs.readFile(fullname, 'utf8', function (err, data) {
            //     init(JSON.parse(data), mode);
            // });
            alert('Fail to load data:'+ error);
        });
}

// プルダウンメニューを作る。
function pullDownMenu(){
    interface Menu {
        cd: string;
        label: string;
    };
    let menu: Menu[];
    const series = (<HTMLInputElement> document.getElementById("series")).value;
    switch(series){
        case 'examples':
            menu = [
                {cd:'cube', label: 'Cube'},
                {cd:'120', label: '120-cell'},
                {cd: 'a', label: 'a semi-regular polytope' },
                {cd: 'b', label: 'a semi-regular polytope' },
                {cd: 'c', label: 'a semi-regular polytope' }
            ];
            break;
        case '5':
        case '8':
        case '24':
        case '120':
            menu = [
                { cd: '0001', label: 'Regular 1' },
                { cd: '1000', label: 'Regular 2' },
                { cd: '0001', label: '0001' },
                { cd: '0010', label: '0010' },
                { cd: '0011', label: '0011' },
                { cd: '0100', label: '0100' },
                { cd: '0101', label: '0101' },
                { cd: '0110', label: '0110' },
                { cd: '0111', label: '0111' },
                { cd: '1000', label: '1000' },
                { cd: '1001', label: '1001' },
                { cd: '1010', label: '1010' },
                { cd: '1011', label: '1011' },
                { cd: '1100', label: '1100' },
                { cd: '1101', label: '1101' },
                { cd: '1110', label: '1110' },
                { cd: '1111', label: '1111' },
                { cd: 'snub', label: 'Snub' },
            ];
            break;
        case 'others':
            menu = [
                { cd: 'alicia', label: 'Snub 24-cell' },
                { cd: 'anti', label: 'Grand anti-prism' },
                { cd: 'duoprism', label: '15-8 duo-prism' },
                { cd: 'antiduoprism', label: '5-4 anti-duo-prism' },
            ];
            break;
    }
    const polytopePullDown = document.getElementById('polytope');
    polytopePullDown.textContent = null;
    for(let i of menu){
        let item = document.createElement("option");
        item.value = i.cd;
        item.text = i.label;
        polytopePullDown.appendChild(item);
    }
}

const polytopeTable ={
    "examples": {
        "cube": "c8",
        "120": "c120",
        "a": "c16thw",
        "b": "c5tw",
        "c": "c24thw"
    },
    "5": {
        "0001": "c5",
        "0010": "c5h",
        "0011": "c5t",
        "0100": "c5h",
        "0101": "c5hw",
        "0110": "c5th",
        "0111": "c5thw",
        "1000": "c5",
        "1001": "c5w",
        "1010": "c5hw",
        "1011": "c5tw",
        "1100": "c5t",
        "1101": "c5tw",
        "1110": "c5thw",
        "1111": "c5thww",
        "snub": "c5s"
    },
    "8": {
        "0001": "c8",
        "0010": "c8h",
        "0011": "c8t",
        "0100": "c24",
        "0101": "c16hw",
        "0110": "c16th",
        "0111": "c16thw",
        "1000": "c16",
        "1001": "c8w",
        "1010": "c8hw",
        "1011": "c8tw",
        "1100": "c16t",
        "1101": "c16tw",
        "1110": "c8thw",
        "1111": "c8thww",
        "snub": "c8s"
    },
    "24": {
        "0001": "c24",
        "0010": "c24h",
        "0011": "c24t",
        "0100": "c24h",
        "0101": "c24hw",
        "0110": "c24th",
        "0111": "c24thw",
        "1000": "c24",
        "1001": "c24w",
        "1010": "c24hw",
        "1011": "c24tw",
        "1100": "c24t",
        "1101": "c24tw",
        "1110": "c24thw",
        "1111": "c24thww",
        "snub": "c24s"
    },
    "120": {
        "0001": "c120",
        "0010": "c120h",
        "0011": "c120t",
        "0100": "c600h",
        "0101": "c600hw",
        "0110": "c600th",
        "0111": "c600thw",
        "1000": "c600",
        "1001": "c120w",
        "1010": "c120hw",
        "1011": "c120tw",
        "1100": "c600t",
        "1101": "c600tw",
        "1110": "c120thw",
        "1111": "c120thww",
        "snub": "c120s"
    },
    "others": {
        "alicia": "alicia",
        "anti": "anti",
        "duoprism": "p15-8",
        "antiduoprism": "a5-4"
    }
}

function getBaseName(): string{
    const series = (<HTMLInputElement>document.getElementById("series")).value;
    const subclass = (<HTMLInputElement>document.getElementById("polytope")).value;
    return polytopeTable[series][subclass];
}

var renderer: THREE.WebGLRenderer;
var camera: THREE.PerspectiveCamera;
//４次元回転のための行列
var rotation = pt.rotationMatrix4(0.01, 23).multiply(pt.rotationMatrix4(0.01, 12)).multiply(pt.rotationMatrix4(0.01, 3));

//  画面を初期化し、物体を置き、アニメーションを定義する。
// modeは"Solid"または"Frame"
function init(prePolytope:Object, mode:string="Solid"): void{
    // レンダラーを作成
    renderer = new THREE.WebGLRenderer({antialias: true});
    // レンダラーのサイズを設定
    //const size = Math.min(window.innerHeight, window.innerWidth);
    //renderer.setSize(size, size);
    renderer.setClearColor(new THREE.Color(0x888888));

    // シーンを作成
    const scene = new THREE.Scene();

    // カメラを作成
    camera = new THREE.PerspectiveCamera(33, 1, 1, 10);
    camera.position.set(0, 0, 4);
    camera.lookAt(scene.position);

    // 大きさをWindowに合わせて調整
    onResize();

    // 物体を作成
    const polytope = new pt.Polytope();
    polytope.initFromPrePolytope(prePolytope, mode);
    const theObject = polytope.object3D;
    scene.add(theObject);

    // canvasをcontentsに追加
    const contents = document.getElementById('contents')
    contents.textContent = null;
    contents.appendChild(renderer.domElement);

    // 平行光源を生成
    const light = new THREE.DirectionalLight(0xffffff);
    light.position.set(-3, 3, 3);
    scene.add(light);

    // アンビエントライトを生成
    const ambientLight = new THREE.AmbientLight(new THREE.Color(0x444444));
    ambientLight.position.set(1, 1, 1);
    scene.add(ambientLight);

    //フォグを生成
    scene.fog = new THREE.Fog(0xaaaaaa, 1.5, 6.5);

    //アニメーションの設定
    const tick = (): void => {
        requestAnimationFrame(tick);

    //    theObject.rotation.x += 0.01;
    //    theObject.rotation.y += 0.01;
        polytope.applyMatrix4(rotation);
        polytope.projectVertices();
        polytope.checkVisibility();
        // 描画
        renderer.render(scene, camera);
    };
    tick();
}

function onResize() {
    // サイズを取得
    const width = window.innerWidth;
    const height = window.innerHeight;
    const size = Math.min(width,height);

    // レンダラーのサイズを調整する
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(size, size);

    // カメラのアスペクト比を正す
    camera.aspect = 1;
    camera.updateProjectionMatrix();
}

function autoClick(){
    const autobutton = document.getElementById("auto");
    const stopbutton = document.getElementById("stop");
    autobutton.className = "button-on";
    stopbutton.className = "button-off";
    rotation = pt.rotationMatrix4(0.01, 23).multiply(pt.rotationMatrix4(0.01, 12)).multiply(pt.rotationMatrix4(0.01, 3));
}

function stopClick(){
    const autobutton = document.getElementById("auto");
    const stopbutton = document.getElementById("stop");
    autobutton.className = "button-off";
    stopbutton.className = "button-on";
    rotation.identity();
}
