import assert from "node:assert/strict";
import test from "node:test";

import {
    inertialRotation,
    pointerAngularVelocity,
    pointerRotation,
} from "../.test-dist/inertia.js";

test("3D and 4D pointer motion continues with the last angular velocity", () => {
    const elapsedSeconds = 1 / 60;
    const deltaX = 12;
    const deltaY = -7;
    const xVelocity = pointerAngularVelocity(deltaX, elapsedSeconds);
    const yVelocity = pointerAngularVelocity(deltaY, elapsedSeconds);

    for (const mode of [3, 4]) {
        assert.deepEqual(
            inertialRotation(xVelocity, yVelocity, elapsedSeconds, mode).elements,
            pointerRotation(deltaX, deltaY, mode).elements,
        );
    }
});

test("pointer velocity validation rejects invalid timing", () => {
    assert.throws(() => pointerAngularVelocity(1, -1), RangeError);
    assert.throws(() => pointerAngularVelocity(Number.NaN, 1 / 60), RangeError);
});
