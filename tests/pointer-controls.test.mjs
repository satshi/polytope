import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import * as THREE from "three";

import * as animation from "../.test-dist/animation.js";
import * as controls from "../.test-dist/control-state.js";
import * as inertia from "../.test-dist/inertia.js";

// Run the compiled entry point's event handlers and animation loop without
// WebGL or fetching data. Replace only imports and Vite's asset URL glob.
const source = (await readFile(new URL("../.test-dist/main.js", import.meta.url), "utf8"))
    .replace(/^import\s[\s\S]*?;\n/gm, "")
    .replace(/import\.meta\.glob\([\s\S]*?\);/, "{};");

function createViewer() {
    const captures = new Map();
    class Target {
        listeners = new Map();
        value = "";
        classList = { toggle() {} };
        addEventListener(type, callback) {
            if (!this.listeners.has(type)) this.listeners.set(type, new Set());
            this.listeners.get(type).add(callback);
        }
        appendChild() {}
        setAttribute() {}
        setPointerCapture(pointerId) { captures.set(pointerId, this); }
        hasPointerCapture(pointerId) { return captures.get(pointerId) === this; }
        releasePointerCapture(pointerId) {
            captures.delete(pointerId);
            this.dispatch("lostpointercapture", { pointerId });
        }
        dispatch(type, values = {}) {
            const event = { type, preventDefault() {}, ...values };
            for (const callback of this.listeners.get(type) ?? []) callback(event);
        }
    }

    const ids = ["pbtn", "series", "polytope", "ifframe", "auto", "stop",
        "3D-rotation", "4D-rotation", "contents", "status"];
    const elements = Object.fromEntries(ids.map(id => [id, new Target()]));
    elements.series.value = "examples";
    const window = new Target();
    const frames = new Map();
    let frameId = 0;
    window.cancelAnimationFrame = id => frames.delete(id);
    const polytope = {
        applied: [],
        matrix: new THREE.Matrix4(),
        applyMatrix4(matrix) {
            this.applied.push(matrix.clone());
            this.matrix.multiply(matrix);
        },
        projectVertices() {},
        checkVisibility() {},
    };
    const context = vm.createContext({
        THREE, ...animation, ...controls, ...inertia, window,
        document: {
            getElementById: id => elements[id],
            createElement: () => new Target(),
        },
        requestAnimationFrame: callback => {
            frames.set(++frameId, callback);
            return frameId;
        },
        testPolytope: polytope,
    });
    vm.runInContext(`${source}\npolytope = testPolytope;`, context);

    return {
        polytope, elements, window, frames,
        click(id) { elements[id].dispatch("click"); },
        pointer(type, values = {}, target = elements.contents) {
            const event = {
                pointerId: 1, isPrimary: true, button: 0,
                buttons: type === "pointerup" ? 0 : 1,
                clientX: 0, clientY: 0, timeStamp: 0,
                ...values,
            };
            // Pointer capture redirects events from outside the drawing area.
            (captures.get(event.pointerId) ?? target).dispatch(type, event);
        },
        frame(timestamp) {
            const callbacks = [...frames.values()];
            frames.clear();
            for (const callback of callbacks) callback(timestamp);
        },
    };
}

function assertMatrixClose(actual, expected) {
    const error = Math.max(...actual.elements.map((v, i) => Math.abs(v - expected.elements[i])));
    assert.ok(error < 1e-12, `maximum matrix error: ${error}`);
}

test("release outside the viewer ends the drag and Stop cannot be undone by hovering", () => {
    const viewer = createViewer();
    viewer.click("stop");
    viewer.click("3D-rotation");
    viewer.pointer("pointerdown");
    assert.equal(viewer.elements.contents.hasPointerCapture(1), true);
    viewer.pointer("pointermove", { clientX: 10, timeStamp: 16 });
    viewer.pointer("pointerup", { clientX: -10, timeStamp: 32 }, viewer.window);
    assert.equal(viewer.elements.contents.hasPointerCapture(1), false);

    const before = viewer.polytope.applied.length;
    viewer.pointer("pointermove", { clientX: 20, timeStamp: 48, buttons: 0 });
    assert.equal(viewer.polytope.applied.length, before);
    viewer.click("stop");
    viewer.pointer("pointermove", { clientX: 30, timeStamp: 64, buttons: 0 });
    viewer.pointer("pointerdown", { timeStamp: 80 });
    viewer.pointer("pointermove", { clientX: 40, timeStamp: 96 });
    viewer.frame(112);
    assert.equal(viewer.polytope.applied.length, before);
    assert.equal(viewer.frames.size, 0);
});

test("3D and 4D drags follow pointer distance once and resume inertia after release", () => {
    for (const mode of [3, 4]) {
        const viewer = createViewer();
        viewer.click("stop");
        viewer.click(`${mode}D-rotation`);
        viewer.pointer("pointerdown");
        for (let i = 1; i <= 60; i++) {
            const timeStamp = i * 1000 / 60;
            viewer.pointer("pointermove", { clientX: i * 12, timeStamp });
            viewer.frame(timeStamp);
        }
        assertMatrixClose(viewer.polytope.matrix, inertia.pointerRotation(720, 0, mode));
        assert.equal(viewer.polytope.applied.length, 60);

        viewer.pointer("pointerup", { clientX: 720, timeStamp: 1000 });
        viewer.frame(1000 + 1000 / 60);
        assert.equal(viewer.polytope.applied.length, 61);
        assertMatrixClose(viewer.polytope.applied.at(-1), inertia.pointerRotation(12, 0, mode));
    }
});

test("dragging one mode preserves automatic rotation and the other mode's inertia", () => {
    for (const mode of [3, 4]) {
        const otherMode = mode === 3 ? 4 : 3;
        const viewer = createViewer();
        viewer.click(`${otherMode}D-rotation`);
        viewer.pointer("pointerdown");
        viewer.pointer("pointermove", { clientX: 10, timeStamp: 20 });
        viewer.pointer("pointerup", { timeStamp: 20 });
        viewer.frame(20);
        viewer.click(`${mode}D-rotation`);
        viewer.pointer("pointerdown", { timeStamp: 20 });
        viewer.pointer("pointermove", { clientX: 5, timeStamp: 40 });
        const before = viewer.polytope.applied.length;
        viewer.frame(40);

        assert.equal(viewer.polytope.applied.length - before, 2);
        assertMatrixClose(viewer.polytope.applied[before], animation.automaticRotation(0.02));
        assertMatrixClose(viewer.polytope.applied[before + 1], inertia.pointerRotation(10, 0, otherMode));
    }
});

test("cancel, lost capture, blur, and a released button end dragging and allow a new drag", () => {
    for (const interruption of ["pointercancel", "lostpointercapture", "blur", "releasedButton"]) {
        const viewer = createViewer();
        viewer.click("stop");
        viewer.click("3D-rotation");
        viewer.pointer("pointerdown");
        viewer.pointer("pointermove", { clientX: 10, timeStamp: 16 });
        if (interruption === "blur") {
            viewer.window.dispatch("blur");
        } else if (interruption === "releasedButton") {
            viewer.pointer("pointermove", { clientX: 20, timeStamp: 32, buttons: 0 });
        } else {
            viewer.pointer(interruption);
        }
        assert.equal(viewer.elements.contents.hasPointerCapture(1), false, interruption);
        const before = viewer.polytope.applied.length;
        viewer.pointer("pointermove", { clientX: 30, timeStamp: 48 });
        viewer.frame(48);
        viewer.frame(64);
        assert.equal(viewer.polytope.applied.length, before, interruption);
        assert.equal(viewer.frames.size, 0, interruption);

        viewer.pointer("pointerdown", { pointerId: 2, timeStamp: 80 });
        viewer.pointer("pointermove", { pointerId: 2, clientX: 10, timeStamp: 96 });
        assert.equal(viewer.polytope.applied.length, before + 1, interruption);
    }
});

test("changing control modes releases the active pointer and ignores its later movement", () => {
    for (const nextMode of ["auto", "stop", "3D-rotation", "4D-rotation"]) {
        const viewer = createViewer();
        viewer.click("stop");
        viewer.click("3D-rotation");
        viewer.pointer("pointerdown");
        viewer.pointer("pointermove", { clientX: 10, timeStamp: 16 });
        viewer.click(nextMode);
        assert.equal(viewer.elements.contents.hasPointerCapture(1), false, nextMode);
        const before = viewer.polytope.applied.length;
        viewer.pointer("pointermove", { clientX: 20, timeStamp: 32 });
        assert.equal(viewer.polytope.applied.length, before, nextMode);
    }
});

test("right clicks and secondary pointers cannot start or disrupt a drag", () => {
    const viewer = createViewer();
    viewer.click("stop");
    viewer.click("3D-rotation");
    viewer.pointer("pointerdown", { button: 2, buttons: 2 });
    viewer.pointer("pointermove", { clientX: 10, timeStamp: 16, buttons: 2 });
    viewer.pointer("pointerdown", { pointerId: 2, isPrimary: false });
    viewer.pointer("pointermove", { pointerId: 2, clientX: 10, timeStamp: 16 });
    assert.equal(viewer.polytope.applied.length, 0);

    viewer.pointer("pointerdown");
    viewer.pointer("pointerdown", { pointerId: 2, clientX: 200 });
    viewer.pointer("pointermove", { pointerId: 2, clientX: 210, timeStamp: 16 });
    viewer.pointer("pointerup", { pointerId: 2 });
    viewer.pointer("pointercancel", { pointerId: 2 });
    viewer.pointer("pointermove", { clientX: 10, timeStamp: 16 });
    assert.equal(viewer.polytope.applied.length, 1);
    assertMatrixClose(viewer.polytope.matrix, inertia.pointerRotation(10, 0, 3));
    assert.equal(viewer.elements.contents.hasPointerCapture(1), true);
});
