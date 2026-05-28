# What Needs Improvement

Based on Graphic-Design-Bench Section 7: Animation & Temporal Tasks.

Source: https://arxiv.org/html/2604.04192v1#S7

## Benchmark Takeaways

Graphic-Design-Bench shows that current models are weak at professional animation tasks, especially when multiple elements move independently.

Important findings:

- Keyframe ordering is still unsolved. The best exact match is only 16%, even though first-frame detection is much easier.
- Motion type classification is below 13% accuracy across models, even with constrained labels.
- Duration and start-time prediction degrade sharply from single-component to multi-component scenes.
- Animation parameter generation fails mainly because of grounding: models cannot reliably map a textual component reference to the correct visual region.
- Generated videos often apply one global motion, animate the wrong elements, or hallucinate unrelated motion.
- Full video input does not fix the issue. The missing piece is structured per-component conditioning.
- Fine-grained control of speed, easing, magnitude, and visual effects remains hard even when the coarse motion type is correct.

This strongly supports Sketchmark's current direction: keep the kernel structured, explicit, and component-local. Do not ask AI to invent raw animation math or infer components from pixels.

## Current Sketchmark Position

Sketchmark is now a reasonable render and animation kernel:

- Explicit element IDs.
- Element-local timelines.
- Object keyframes.
- Per-segment interpolation curves.
- Strict validation for known animatable tracks.
- SVG/HTML/video-oriented rendering pipeline.
- A tiny editor for selecting, scrubbing, keyframing, dragging, rotating, scaling, and editing interpolation.

This is a good foundation because the benchmark says models need structured component-level information. Sketchmark provides that structure.

But Sketchmark is not yet an AI-friendly animation system. The kernel is intentionally low-level. AI should not be expected to author many raw timelines directly.

Approximate current rating:

- Kernel: 7/10
- Tiny editor: 3.5/10
- AI animation authoring layer: 3/10
- Benchmark readiness: 2/10
- Overall: 5/10

## Main Gaps

### 1. Missing Motion Compound Layer

The biggest missing layer is a semantic motion compiler above the kernel.

AI should be able to request:

- `fadeIn(element, duration, delay)`
- `rise(element, direction, distance, duration, delay)`
- `pan(element, from, to, duration)`
- `pop(element, scale, duration)`
- `stagger(elements, eachDelay)`
- `entranceSequence(group, preset)`

These compounds should compile into pure kernel timelines.

This directly addresses the benchmark failure where models cannot reliably translate motion labels such as rise, pan, fade, or tumble into precise keyframes.

### 2. Weak Component Grounding Layer

The benchmark says grounding is the core failure in animation generation.

Sketchmark should make grounding explicit:

- Every visible element should have a stable ID.
- Groups should have meaningful names.
- The editor should expose element bounds, previews, and thumbnails.
- AI-facing prompts should include element IDs, types, bounding boxes, hierarchy, and maybe cropped previews.
- Future project files should preserve semantic names separately from kernel IDs.

Goal: AI should never need to guess which visual region is "component 3".

### 3. No Benchmark Harness

Sketchmark cannot yet measure itself against animation benchmarks.

Needed:

- A small local benchmark set of animated documents.
- Render sampled frames from each document.
- Ask an AI/model/compiler to regenerate or classify animation.
- Score element count, element identity, start time, duration, motion type, final position, and visual fidelity.

Do not rely only on SSIM/LPIPS-style image metrics. The benchmark notes that pixel metrics are weak for structured design tasks. Sketchmark should use structure-aware metrics.

### 4. Editor Is Too Small For Real Timing Work

The editor is enough for experiments, but not yet good for real motion design.

Needed:

- Layer timeline with one row per element.
- Visible keyframe markers per property.
- Copy/paste keyframes.
- Multi-select keyframe editing.
- Better graph editor.
- Snap-to-frame / snap-to-second controls.
- Editable delay/duration fields.
- Easier curve presets.
- Element thumbnails or bounding boxes in the layer list.

This matters because the benchmark shows small timing errors are common. Manual correction needs to be fast.

### 5. No Motion Vocabulary

Sketchmark needs a small canonical vocabulary before AI authoring becomes predictable.

Start with a minimal set:

- `fade`
- `rise`
- `pan`
- `scale`
- `rotate`
- `wipe`
- `blur`
- `flicker`
- `pop`
- `stagger`

Avoid adding too many motion labels at once. The benchmark's 32-class motion taxonomy appears hard for current models. A smaller vocabulary with precise compiler definitions is more useful.

### 6. No Project Layer Yet

The kernel should stay frozen, but real editing needs source truth.

A future `.project` layer should preserve:

- Rectangles, circles, lines, charts, diagrams, callouts, and other compounds.
- Semantic motion compounds.
- Editor-only state such as locks, selections, guides, and snapping.
- Original source objects before compilation.
- Human-authored names and descriptions.

The `.project` layer compiles down to `.visual.json`.

### 7. Limited Animation Quality Model

Current keyframes can animate, but "natural" motion still needs higher-level timing knowledge.

Needed above the kernel:

- Preset curves for entrance/exit/attention motions.
- Overshoot and settle helpers.
- Optional anticipation/follow-through helpers.
- Motion duration defaults by distance and element type.
- Stagger defaults for groups.
- Warnings for unnatural timing, such as all elements moving with identical curves.

These should not become kernel fields. They should compile into explicit keyframes and curves.

## Recommended Next Milestones

### Milestone 1: Motion Compounds

Build a small compound compiler:

- Input: semantic motion calls.
- Output: pure Sketchmark timelines.
- Include `fade`, `rise`, `pan`, `scale`, `rotate`, `pop`, and `stagger`.
- Add examples and tests.

### Milestone 2: AI-Facing Structured Prompt Format

Create a compact JSON summary that AI can consume:

- element ID
- type
- bbox
- parent group
- current timeline tracks
- visible text label if any
- available motion compounds

This should be separate from the kernel.

### Milestone 3: Editor Timeline Improvements

Improve the editor for correcting AI output:

- layer timeline
- property rows
- keyframe editing
- curve preset picker
- delay/duration controls

### Milestone 4: Local Animation Benchmark

Create a tiny benchmark inspired by Section 7:

- keyframe ordering
- motion type classification
- start time extraction
- duration extraction
- compound-to-kernel generation

Use this to measure Sketchmark improvements over time.

## Design Rule Going Forward

Do not expand the kernel for AI convenience.

If AI needs a concept like "rise", "dog walk", "spider walk", "stagger", or "hero reveal", it belongs in a compound/project layer.

The kernel should remain:

- renderable
- strict
- explicit
- editor-targetable
- easy to validate
- easy to compile into

The benchmark confirms this direction: AI needs more structure, not more freedom.
