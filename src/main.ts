import * as THREE from "three";
import * as pt from "./polytope.js";
import { parsePrePolytope } from "./data-validation.js";
import { automaticRotation } from "./animation.js";
import {
    inertialRotation,
    pointerAngularVelocity,
    pointerRotation,
    type ManualRotationMode,
} from "./inertia.js";


type DisplayMode = "Solid" | "Frame";
type ControlMode = "auto" | "stop" | "rotate3d" | "rotate4d";


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

const viewButton = getElement<HTMLButtonElement>("pbtn");
const seriesSelect = getElement<HTMLSelectElement>("series");
const polytopeSelect = getElement<HTMLSelectElement>("polytope");
const frameCheckbox = getElement<HTMLInputElement>("ifframe");
const autoButton = getElement<HTMLButtonElement>("auto");
const stopButton = getElement<HTMLButtonElement>("stop");
const rotation3DButton = getElement<HTMLButtonElement>("3D-rotation");
const rotation4DButton = getElement<HTMLButtonElement>("4D-rotation");
const contents = getElement<HTMLDivElement>("contents");
const statusMessage = getElement<HTMLDivElement>("status");

viewButton.addEventListener('click', () => void main());
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

let activeLoadController: AbortController | null = null;

async function main(): Promise<void> {
    const dataDir = 'data/';
    const dataExt = '.json';
    const controller = new AbortController();
    activeLoadController?.abort();
    activeLoadController = controller;
    viewButton.disabled = true;
    showStatus("Loading polytope...");

    try {
        const basename = getBaseName();
        const mode: DisplayMode = frameCheckbox.checked ? "Frame" : "Solid";
        const fullname = dataDir + basename + dataExt;
        const response = await fetch(fullname, { signal: controller.signal });
        if (!response.ok) {
            throw new Error(`${response.status} ${response.statusText}`);
        }

        const data: unknown = await response.json();
        const prePolytope = parsePrePolytope(data);
        if (!controller.signal.aborted) {
            init(prePolytope, mode);
            hideStatus();
        }
    } catch (error) {
        if (!controller.signal.aborted) {
            const message = error instanceof Error ? error.message : String(error);
            showStatus(`Failed to load data: ${message}`, true);
        }
    } finally {
        if (activeLoadController === controller) {
            activeLoadController = null;
            viewButton.disabled = false;
        }
    }
}

function showStatus(message: string, isError = false): void {
    statusMessage.textContent = message;
    statusMessage.classList.toggle("error", isError);
    statusMessage.hidden = false;
}

function hideStatus(): void {
    statusMessage.hidden = true;
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

let renderer: THREE.WebGLRenderer | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let scene: THREE.Scene | null = null;
let polytope: pt.Polytope | null = null;
let animationFrame: number | null = null;
let previousAnimationTime: number | null = null;
let controlMode: ControlMode = "auto";

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
    if (renderer && !renderer.domElement.parentElement) {
        contents.appendChild(renderer.domElement);
    }

    renderScene();
    startAnimation();
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
    previousAnimationTime = null;
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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(size, size);

    // カメラのアスペクト比を正す
    camera.aspect = 1;
    camera.updateProjectionMatrix();
    renderScene();
}

////  ボタンクリックのイベントハンドラ

function preventContentScroll(event: Event): void {
    event.preventDefault();
}


// 自動的に回転させる。角度とかは決め打ち
function autoClick() {
    setControlMode("auto");
    contents.removeEventListener(MOUSE_DOWN, onDocumentMouseDown, false);
    startAnimation();
}

// 止める。
function stopClick() {
    setControlMode("stop");
    contents.removeEventListener(MOUSE_DOWN, onDocumentMouseDown, false);
    stopAnimation();
    renderScene();
}

// マウスのドラッグで３次元内での回転する。
function r3DClick() {
    setControlMode("rotate3d");
    stopAnimation();
    contents.addEventListener(MOUSE_DOWN, onDocumentMouseDown, { passive: false });
    clearManualInertia();
    rotationMode = 3;
    renderScene();
}

// マウスのドラッグで４次元内での回転する。
function r4DClick() {
    setControlMode("rotate4d");
    stopAnimation();
    contents.addEventListener(MOUSE_DOWN, onDocumentMouseDown, { passive: false });
    clearManualInertia();
    rotationMode = 4;
    renderScene();
}


////// マウスのドラッグで多胞体を回転させる用の変数や関数
let onMouseDownMouseX = 0;
let onMouseDownMouseY = 0;
//  回転モードの場合の回転の方向。３次元なら3。４次元なら4
let rotationMode: ManualRotationMode = 3;
let manualAngularVelocityX = 0;
let manualAngularVelocityY = 0;
let previousPointerTime = 0;

function onDocumentMouseDown(event: Event) {
    event.preventDefault();
    const pointerEvent = event as PointerEvent;
    onMouseDownMouseX = pointerEvent.clientX;
    onMouseDownMouseY = pointerEvent.clientY;
    stopAnimation();
    clearManualInertia();
    previousPointerTime = pointerEvent.timeStamp;
    contents.addEventListener(MOUSE_MOVE, onDocumentMouseMove, { passive: false });
    contents.addEventListener(MOUSE_UP, onDocumentMouseUp, { passive: false });
}

function onDocumentMouseMove(event: Event) {
    event.preventDefault();
    const pointerEvent = event as PointerEvent;
    const dX = pointerEvent.clientX - onMouseDownMouseX;
    const dY = pointerEvent.clientY - onMouseDownMouseY;
    const elapsedSeconds = Math.max((pointerEvent.timeStamp - previousPointerTime) / 1000, 0);
    onMouseDownMouseX = pointerEvent.clientX;
    onMouseDownMouseY = pointerEvent.clientY;
    previousPointerTime = pointerEvent.timeStamp;
    setRotationMatrix(dX, dY, elapsedSeconds);
    renderScene();
    startAnimation();
}

function onDocumentMouseUp(event: Event) {
    event.preventDefault();
    contents.removeEventListener(MOUSE_MOVE, onDocumentMouseMove, false);
    contents.removeEventListener(MOUSE_UP, onDocumentMouseUp, false);
}

function setRotationMatrix(dX: number, dY: number, elapsedSeconds: number): void {
    manualAngularVelocityX = pointerAngularVelocity(dX, elapsedSeconds);
    manualAngularVelocityY = pointerAngularVelocity(dY, elapsedSeconds);
    polytope?.applyMatrix4(pointerRotation(dX, dY, rotationMode));
}

function clearManualInertia(): void {
    manualAngularVelocityX = 0;
    manualAngularVelocityY = 0;
}

function hasManualInertia(): boolean {
    return controlMode !== "auto" && controlMode !== "stop"
        && (manualAngularVelocityX !== 0 || manualAngularVelocityY !== 0);
}

function renderScene(): void {
    polytope?.projectVertices();
    polytope?.checkVisibility();
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}

function tick(timestamp: number): void {
    if (!polytope || (controlMode !== "auto" && !hasManualInertia())) {
        animationFrame = null;
        previousAnimationTime = null;
        return;
    }

    if (previousAnimationTime !== null) {
        const elapsedSeconds = (timestamp - previousAnimationTime) / 1000;
        if (controlMode === "auto") {
            polytope.applyMatrix4(automaticRotation(elapsedSeconds));
        } else {
            polytope.applyMatrix4(inertialRotation(manualAngularVelocityX, manualAngularVelocityY, elapsedSeconds, rotationMode));
        }
    }
    previousAnimationTime = timestamp;
    renderScene();
    animationFrame = requestAnimationFrame(tick);
}

function startAnimation(): void {
    if (animationFrame !== null || !polytope) {
        return;
    }
    if (controlMode !== "auto" && !hasManualInertia()) {
        return;
    }
    previousAnimationTime = null;
    animationFrame = requestAnimationFrame(tick);
}

function setControlMode(mode: ControlMode): void {
    controlMode = mode;
    const controls: Array<[HTMLButtonElement, ControlMode]> = [
        [autoButton, "auto"],
        [stopButton, "stop"],
        [rotation3DButton, "rotate3d"],
        [rotation4DButton, "rotate4d"],
    ];
    controls.forEach(([button, buttonMode]) => {
        const selected = mode === buttonMode;
        button.className = selected ? "button-on" : "button-off";
        button.setAttribute("aria-pressed", String(selected));
    });
}
