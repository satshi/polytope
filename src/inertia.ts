import type { Matrix4 } from "three";
import { MAX_ANIMATION_STEP_SECONDS } from "./animation.js";
import { rotationMatrix4 } from "./polytope.js";

export type ManualRotationMode = 3 | 4;

export const POINTER_ROTATION_SCALE = 2 / 1000;
const MIN_POINTER_STEP_SECONDS = 1 / 240;

function rotationForAngles(
    xAngle: number,
    yAngle: number,
    mode: ManualRotationMode,
): Matrix4 {
    if (mode === 3) {
        return rotationMatrix4(xAngle, 20)
            .multiply(rotationMatrix4(yAngle, 12));
    }
    return rotationMatrix4(xAngle, 30)
        .multiply(rotationMatrix4(yAngle, 13));
}

export function pointerRotation(
    deltaX: number,
    deltaY: number,
    mode: ManualRotationMode,
): Matrix4 {
    return rotationForAngles(
        deltaX * POINTER_ROTATION_SCALE,
        deltaY * POINTER_ROTATION_SCALE,
        mode,
    );
}

export function pointerAngularVelocity(
    deltaPixels: number,
    elapsedSeconds: number,
): number {
    if (!Number.isFinite(deltaPixels)) {
        throw new RangeError("deltaPixels must be finite.");
    }
    if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) {
        throw new RangeError("elapsedSeconds must be a finite, non-negative number.");
    }

    return deltaPixels * POINTER_ROTATION_SCALE
        / Math.max(elapsedSeconds, MIN_POINTER_STEP_SECONDS);
}

export function inertialRotation(
    xAngularVelocity: number,
    yAngularVelocity: number,
    elapsedSeconds: number,
    mode: ManualRotationMode,
): Matrix4 {
    if (
        !Number.isFinite(xAngularVelocity)
        || !Number.isFinite(yAngularVelocity)
        || !Number.isFinite(elapsedSeconds)
        || elapsedSeconds < 0
    ) {
        throw new RangeError("Inertial rotation values must be finite and time non-negative.");
    }

    const step = Math.min(elapsedSeconds, MAX_ANIMATION_STEP_SECONDS);
    return rotationForAngles(
        xAngularVelocity * step,
        yAngularVelocity * step,
        mode,
    );
}
