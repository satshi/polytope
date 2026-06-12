import * as THREE from "three";
//import { AlphaFormat } from "three";
//import * as pu from "./polygon_util";
import * as pt from "./polytope.js";

//window.addEventListener("DOMContentLoaded", main);

type DisplayMode = "Solid" | "Frame";

const MOUSE_DOWN = 'pointerdown';
const MOUSE_MOVE = 'pointermove';
const MOUSE_UP = 'pointerup';

function getElement<T extends HTMLElement>(id: string): T {
    const element = document.getElementById(id);
    if (!element) {
        throw new Error(`Element #${id} was not found.`);
    }
    return element as T;
}

const viewButton = getElement<HTMLSpanElement>("pbtn");
const seriesSelect = getElement<HTMLSelectElement>("series");
const polytopeSelect = getElement<HTMLSelectElement>("polytope");
const frameCheckbox = getElement<HTMLInputElement>("ifframe");
const autoButton = getElement<HTMLSpanElement>("auto");
const stopButton = getElement<HTMLSpanElement>("stop");
const rotation3DButton = getElement<HTMLSpanElement>("3D-rotation");
const rotation4DButton = getElement<HTMLSpanElement>("4D-rotation");
const contents = getElement<HTMLDivElement>("contents");

viewButton.addEventListener('click', main);
pullDownMenu();
seriesSelect.addEventListener('change', pullDownMenu);
window.addEventListener('resize', onResize, false);
autoButton.addEventListener('click', autoClick);
stopButton.addEventListener('click', stopClick);
rotation3DButton.addEventListener('click', r3DClick);
rotation4DButton.addEventListener('click', r4DClick);
contents.addEventListener(MOUSE_DOWN, preventContentScroll, { passive: false });
contents.addEventListener(MOUSE_MOVE, preventContentScroll, { passive: false });
contents.addEventListener(MOUSE_UP, preventContentScroll, { passive: false });

function main(): void {
    const dataDir = 'data/';
    const dataExt = '.json';
    const basename = getBaseName();
    //const basename = (<HTMLInputElement> document.getElementById("polytopename")).value;
    const mode: DisplayMode = frameCheckbox.checked ? "Frame" : "Solid"
    const fullname = dataDir + basename + dataExt;
    contents.textContent = 'Please wait.';
    fetch(fullname)
        .then(response => {
            if (!response.ok) {
                throw new Error(`${response.status} ${response.statusText}`);
            }
            return response.json() as Promise<pt.PrePolytope>;
        })
        .then((json) => {
            init(json, mode);
        })
        .catch((error) => {
            // const fs = require('fs');
            // fs.readFile(fullname, 'utf8', function (err, data) {
            //     init(JSON.parse(data), mode);
            // });
            alert('Fail to load data:' + String(error));
        });
}

// プルダウンメニューを作る。
function pullDownMenu() {
    interface Menu {
        cd: string;
        label: string;
    };
    let menu: Menu[] = [];
    const series = seriesSelect.value;
    switch (series) {
        case 'examples':
            menu = [
                { cd: 'cube', label: 'Cube' },
                { cd: '120', label: '120-cell' },
                { cd: 'a', label: 'example 1' },
                { cd: 'b', label: 'example 2' },
                { cd: 'c', label: 'example 3' }
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
    polytopeSelect.textContent = null;
    for (let i of menu) {
        let item = document.createElement("option");
        item.value = i.cd;
        item.text = i.label;
        polytopeSelect.appendChild(item);
    }
}

const polytopeTable: Record<string, Record<string, string>> = {
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

function getBaseName(): string {
    const series = seriesSelect.value;
    const subclass = polytopeSelect.value;
    const basename = polytopeTable[series]?.[subclass];
    if (!basename) {
        throw new Error(`Unknown polytope selection: ${series}/${subclass}`);
    }
    return basename;
}

var renderer: THREE.WebGLRenderer | null = null;
var camera: THREE.PerspectiveCamera | null = null;
var scene: THREE.Scene | null = null;
var polytope: pt.Polytope | null = null;
var animationFrame: number | null = null;
//４次元回転のための行列
var rotation = pt.rotationMatrix4(0.01, 23).multiply(pt.rotationMatrix4(0.01, 12)).multiply(pt.rotationMatrix4(0.01, 3));
var extrarotation = new THREE.Matrix4().identity();

//  画面を初期化し、物体を置き、アニメーションを定義する。
// modeは"Solid"または"Frame"
function init(prePolytope: pt.PrePolytope, mode: DisplayMode = "Solid"): void {
    stopAnimation();
    disposeCurrentPolytope();
    ensureRenderer();
    ensureScene();

    // 大きさをWindowに合わせて調整
    onResize();

    // 物体を作成
    polytope = new pt.Polytope();
    polytope.initFromPrePolytope(prePolytope, mode);
    const theObject = polytope.object3D;
    scene?.add(theObject);

    // canvasをcontentsに追加
    contents.textContent = null;
    if (renderer && !renderer.domElement.parentElement) {
        contents.appendChild(renderer.domElement);
    }

    const tick = (): void => {
        animationFrame = requestAnimationFrame(tick);

        //    theObject.rotation.x += 0.01;
        //    theObject.rotation.y += 0.01;
        polytope?.applyMatrix4(rotation);
        polytope?.applyMatrix4(extrarotation);
        polytope?.projectVertices();
        polytope?.checkVisibility();
        // 描画
        if (renderer && scene && camera) {
            renderer.render(scene, camera);
        }
    };
    tick();
}

function ensureRenderer(): void {
    if (renderer) {
        return;
    }
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setClearColor(new THREE.Color(0x888888));
}

function ensureScene(): void {
    scene = new THREE.Scene();

    // カメラを作成
    camera = new THREE.PerspectiveCamera(33, 1, 1, 10);
    camera.position.set(0, 0, 4);
    camera.lookAt(scene.position);

    // 平行光源を生成
    const light = new THREE.DirectionalLight(0xffffff, 3.0);
    light.position.set(-2, 2, 2);
    scene.add(light);

    // アンビエントライトを生成
    const ambientLight = new THREE.AmbientLight(new THREE.Color(0x555555));
    ambientLight.position.set(1, 1, 1);
    scene.add(ambientLight);

    //フォグを生成
    scene.fog = new THREE.Fog(0xaaaaaa, 1.7, 6.0);
}

function stopAnimation(): void {
    if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = null;
    }
}

function disposeCurrentPolytope(): void {
    if (!polytope) {
        return;
    }
    scene?.remove(polytope.object3D);
    polytope.dispose();
    polytope = null;
}

function onResize() {
    if (!renderer || !camera) {
        return;
    }
    // サイズを取得
    const width = window.innerWidth;
    const height = window.innerHeight;
    const size = Math.floor(Math.min(width, height));

    // レンダラーのサイズを調整する
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(size, size);

    // カメラのアスペクト比を正す
    camera.aspect = 1;
    camera.updateProjectionMatrix();
}

////  ボタンクリックのイベントハンドラ

function preventContentScroll(event: Event): void {
    event.preventDefault();
}


// 自動的に回転させる。角度とかは決め打ち
function autoClick() {
    autoButton.className = "button-on";
    stopButton.className = "button-off";
    rotation3DButton.className = "button-off";
    rotation4DButton.className = "button-off";
    rotation = pt.rotationMatrix4(0.01, 23).multiply(pt.rotationMatrix4(0.01, 12)).multiply(pt.rotationMatrix4(0.01, 3));
    extrarotation.identity();
    contents.removeEventListener(MOUSE_DOWN, onDocumentMouseDown, false);
}

// 止める。
function stopClick() {
    autoButton.className = "button-off";
    stopButton.className = "button-on";
    rotation3DButton.className = "button-off";
    rotation4DButton.className = "button-off";
    rotation.identity();
    extrarotation.identity();
    contents.removeEventListener(MOUSE_DOWN, onDocumentMouseDown, false);
}

// マウスのドラッグで３次元内での回転する。
function r3DClick() {
    autoButton.className = "button-off";
    stopButton.className = "button-off";
    rotation3DButton.className = "button-on";
    rotation4DButton.className = "button-off";
    contents.addEventListener(MOUSE_DOWN, onDocumentMouseDown, { passive: false });
    rotationMode = 3;
}

// マウスのドラッグで４次元内での回転する。
function r4DClick() {
    autoButton.className = "button-off";
    stopButton.className = "button-off";
    rotation3DButton.className = "button-off";
    rotation4DButton.className = "button-on";
    contents.addEventListener(MOUSE_DOWN, onDocumentMouseDown, { passive: false });
    rotationMode = 4;
}


////// マウスのドラッグで多胞体を回転させる用の変数や関数
let onMouseDownMouseX = 0;
let onMouseDownMouseY = 0;
//  回転モードの場合の回転の方向。３次元なら3。４次元なら4
let rotationMode = 3;

function onDocumentMouseDown(event: Event) {
    event.preventDefault();
    const pointerEvent = event as PointerEvent;
    onMouseDownMouseX = pointerEvent.clientX;
    onMouseDownMouseY = pointerEvent.clientY;
    if (rotationMode == 3) {
        rotation.identity();
    } else {
        extrarotation.identity();
    }
    contents.addEventListener(MOUSE_MOVE, onDocumentMouseMove, { passive: false });
    contents.addEventListener(MOUSE_UP, onDocumentMouseUp, { passive: false });
}

function onDocumentMouseMove(event: Event) {
    event.preventDefault();
    const pointerEvent = event as PointerEvent;
    const dX = pointerEvent.clientX - onMouseDownMouseX;
    const dY = pointerEvent.clientY - onMouseDownMouseY;
    onMouseDownMouseX = pointerEvent.clientX;
    onMouseDownMouseY = pointerEvent.clientY;
    setRotationMatrix(dX, dY);
}

function onDocumentMouseUp(event: Event) {
    event.preventDefault();
    contents.removeEventListener(MOUSE_MOVE, onDocumentMouseMove, false);
    contents.removeEventListener(MOUSE_UP, onDocumentMouseUp, false);
}

function setRotationMatrix(dX: number, dY: number) {
    const scale = 2 / 1000
    if (rotationMode == 3) {
        rotation = pt.rotationMatrix4(dX * scale, 20).multiply(pt.rotationMatrix4(dY * scale, 12));
    } else {
        extrarotation = pt.rotationMatrix4(dX * scale, 30).multiply(pt.rotationMatrix4(dY * scale, 13));
    }
}
