# Visual & Lighting Makeover Plan: "Thomas Was Here" Aesthetic

This document outlines the plan to transform the game's visual style to emulate the atmospheric, high-contrast, and glowing aesthetic of the game "Thomas Was Alone".

## 1. Implement Bloom Post-Processing

This is the most critical step. We will add a bloom post-processing pipeline to the main camera to make bright areas of the screen bleed into darker ones, creating a soft, luminous glow.

**File to Modify**: `src/GameScene.ts`

**Implementation Steps**:
1.  In the `create()` method, after `this.worldBuilder.setupCamera(this.player);`, add the bloom effect.
2.  Use `this.cameras.main.postFX.addBloom()` with parameters tuned for a noticeable but not overpowering glow.
    -   `color`: `0xffffff` (affect all colors)
    -   `blurStepsX/Y`: `1`
    -   `strength`: `1.2`
    -   `blurQuality`: `0.6`
3.  Add a "breathing" effect to the bloom's strength using `this.tweens.add()` to create a subtle, dynamic atmosphere.

## 2. Add Soft Drop Shadows to Platforms

To create a better sense of depth and make the glowing elements stand out, we will add soft drop shadows beneath all elevated platforms.

**File to Modify**: `src/systems/WorldBuilder.ts`

**Implementation Steps**:
1.  In the `createElevatedPlatforms()` method, iterate through the `ELEVATED_PLATFORMS`.
2.  For each platform, first render a slightly offset, semi-transparent black rectangle to serve as a shadow.
3.  Then, render the main platform on top of the shadow.
4.  Add the shadow to the `this.platforms` physics group so it is treated as part of the world.

## 3. Enhance Impact with Screen Shake

To make hits and deaths feel more impactful, we will add camera shake effects.

**File to Modify**: `src/systems/EffectsSystem.ts`

**Implementation Steps**:
1.  In `createHitEffect()`, add a subtle camera shake using `this.scene.cameras.main.shake()` with a short duration and low intensity (e.g., `100ms`, `0.005` intensity).
2.  In `createDeathEffect()`, add a more pronounced camera shake with a longer duration and higher intensity (e.g., `250ms`, `0.01` intensity).

## 4. Refine Particle Effects with Additive Blending

To make particle effects for deaths, hits, and dashes contribute to the glowing aesthetic, we will switch them to use additive blending. This will make overlapping particles brighter, creating a more natural light emission effect.

### A. Death & Hit Effects

**File to Modify**: `src/systems/EffectsSystem.ts`

**Implementation Steps**:
1.  In `createDeathEffect()`, modify the particle creation to use a `Phaser.GameObjects.Particles.ParticleEmitter`.
2.  Set the `blendMode` of the particle emitter to `Phaser.BlendModes.ADD`.
3.  Adjust particle `quantity`, `alpha`, and `lifespan` to complement the additive blending.
4.  Repeat the process for `createHitEffect()`, ensuring hit sparks also use additive blending and `GLOW` colors.

### B. Dash Trail Effects

**File to Modify**: `src/systems/AnimationSystem.ts`

**Implementation Steps**:
1.  In `createDashTrail()`, locate where the `trail` sprite is created.
2.  Set the blend mode of the trail sprite using `trail.setBlendMode(Phaser.BlendModes.ADD)`.
3.  Slightly reduce the initial `alpha` of the trail to compensate for the brightness increase from additive blending. 