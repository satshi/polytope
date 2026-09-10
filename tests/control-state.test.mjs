import assert from "node:assert/strict";
import test from "node:test";

import {
    RotationActivity,
} from "../.test-dist/control-state.js";

test("3D and 4D manual rotations remain active independently", () => {
    const activity = new RotationActivity();
    activity.setManualVelocity(3, 1, 2);
    activity.setManualVelocity(4, 3, 4);

    assert.deepEqual(activity.manual[3], { x: 1, y: 2 });
    assert.deepEqual(activity.manual[4], { x: 3, y: 4 });
    assert.equal(activity.hasManual(3), true);
    assert.equal(activity.hasManual(4), true);
});

test("Stop clears automatic, 3D, and 4D rotations together", () => {
    const activity = new RotationActivity();
    activity.setManualVelocity(3, 1, 2);
    activity.setManualVelocity(4, 3, 4);

    activity.stopAll();

    assert.equal(activity.automatic, false);
    assert.deepEqual(activity.manual[3], { x: 0, y: 0 });
    assert.deepEqual(activity.manual[4], { x: 0, y: 0 });
    assert.equal(activity.hasMotion(), false);
});

test("restarting Auto clears manual rotations before starting", () => {
    const activity = new RotationActivity();
    activity.setManualVelocity(3, 5, 6);
    activity.setManualVelocity(4, 7, 8);

    activity.restartAutomatic();

    assert.deepEqual(activity.manual[3], { x: 0, y: 0 });
    assert.deepEqual(activity.manual[4], { x: 0, y: 0 });
    assert.equal(activity.automatic, true);
    assert.equal(activity.hasMotion(), true);
});
