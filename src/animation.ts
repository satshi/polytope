import type { Matrix4 } from "three";
import { rotationMatrix4 } from "./polytope.js";

export const AUTO_ROTATION_SPEED = 0.6;
export const MAX_ANIMATION_STEP_SECONDS = 0.1;

export function automaticRotation(
    elapsedSeconds: number,
    angularSpeed = AUTO_ROTATION_SPEED,
): Matrix4 {
    if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) {
        throw new RangeError("elapsedSeconds must be a finite, non-negative number.");
    }
    if (!Number.isFinite(angularSpeed)) {
        throw new RangeError("angularSpeed must be finite.");
    }

    const angle = angularSpeed * Math.min(elapsedSeconds, MAX_ANIMATION_STEP_SECONDS);
    return rotationMatrix4(angle, 23)
        .multiply(rotationMatrix4(angle, 12))
        .multiply(rotationMatrix4(angle, 3));
}
