import type { ManualRotationMode } from "./inertia.js";

export type ControlMode = "auto" | "stop" | "rotate3d" | "rotate4d";

export interface AngularVelocity {
    x: number;
    y: number;
}

export class RotationActivity {
    automatic = true;
    readonly manual: Record<ManualRotationMode, AngularVelocity> = {
        3: { x: 0, y: 0 },
        4: { x: 0, y: 0 },
    };

    startAutomatic(): void {
        this.automatic = true;
    }

    restartAutomatic(): void {
        this.stopAll();
        this.startAutomatic();
    }

    setManualVelocity(
        mode: ManualRotationMode,
        x: number,
        y: number,
    ): void {
        this.manual[mode].x = x;
        this.manual[mode].y = y;
    }

    hasManual(mode: ManualRotationMode): boolean {
        const velocity = this.manual[mode];
        return velocity.x !== 0 || velocity.y !== 0;
    }

    hasMotion(): boolean {
        return this.automatic || this.hasManual(3) || this.hasManual(4);
    }

    stopAll(): void {
        this.automatic = false;
        for (const mode of [3, 4] as const) {
            this.setManualVelocity(mode, 0, 0);
        }
    }
}
