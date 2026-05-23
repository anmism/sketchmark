import type { RenderOptions, VisualDocument } from "../types";
import { lowerVisualDocument } from "../kernel";

const DEFAULT_THREE_RUNTIME = "https://cdn.jsdelivr.net/npm/three@0.184.0/build/three.module.js";

export function renderToThreeHtml(document: VisualDocument, options: RenderOptions = {}): string {
  const width = document.canvas.width;
  const height = document.canvas.height;
  const background = options.transparent ? "transparent" : (document.canvas.background ?? "#ffffff");
  const kernel = lowerVisualDocument(document);
  const elements = JSON.stringify(kernel.elements ?? []);
  const initialTime = Number(options.time ?? 0);
  const threeRuntime = options.threeRuntime ?? DEFAULT_THREE_RUNTIME;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Sketchmark Three</title>
  <style>
    html, body {
      margin: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: ${background};
      display: grid;
      place-items: center;
    }
    main { width: min(100vw, ${width}px); }
    canvas {
      display: block;
      width: min(100vw, ${width}px);
      height: auto;
      aspect-ratio: ${width} / ${height};
      background: transparent;
    }
  </style>
</head>
<body>
<main><canvas id="stage"></canvas></main>
<script>
window.__SKETCHMARK_ERROR__ = "";
window.addEventListener("error", (event) => {
  window.__SKETCHMARK_ERROR__ = event.message || String(event.error || "Unknown script error");
});
window.addEventListener("unhandledrejection", (event) => {
  window.__SKETCHMARK_ERROR__ = event.reason && event.reason.message ? event.reason.message : String(event.reason || "Unhandled promise rejection");
});
</script>
<script type="module">
import * as THREE from ${JSON.stringify(threeRuntime)};

const width = ${JSON.stringify(width)};
const height = ${JSON.stringify(height)};
const background = ${JSON.stringify(background)};
const elements = ${elements};
const canvas = document.getElementById("stage");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setSize(width, height, false);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

const scene = new THREE.Scene();
if (background !== "transparent") scene.background = new THREE.Color(background);

const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
camera.position.set(6, 4, 8);
camera.lookAt(0, 0, 0);

const objects = [];
let hasLight = false;
for (const element of elements) {
  const object = createObject(element);
  if (!object) continue;
  bindObject(object, element);
  scene.add(object);
  objects.push(object);
  if (element.type === "light") hasLight = true;
}

if (!hasLight) {
  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambient);
  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(5, 8, 5);
  scene.add(light);
}

function createObject(element) {
  if (element.type === "mesh3d") {
    const vertices = Array.isArray(element.vertices) ? element.vertices.flatMap((point) => vector(point, [0, 0, 0])) : [];
    const indices = Array.isArray(element.indices) ? element.indices.map((value) => Number(value) || 0) : [];
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    if (indices.length) geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const material = materialFor(element);
    const mesh = new THREE.Mesh(geometry, material);
    applyPosition(mesh, element.position);
    return mesh;
  }

  if (element.type === "line3d") {
    const points = [new THREE.Vector3(...vector(element.from, [0, 0, 0])), new THREE.Vector3(...vector(element.to, [0, 0, 0]))];
    return new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: element.stroke || "#111827" }));
  }

  if (element.type === "point3d") {
    const object = new THREE.Object3D();
    applyPosition(object, element.position);
    return object;
  }

  if (element.type === "group3d") {
    const group = new THREE.Group();
    for (const child of element.children || []) {
      const childObject = createObject(child);
      if (childObject) group.add(childObject);
    }
    applyPosition(group, element.position);
    return group;
  }

  if (element.type === "text3d") {
    const textCanvas = document.createElement("canvas");
    textCanvas.width = 512;
    textCanvas.height = 128;
    const ctx = textCanvas.getContext("2d");
    ctx.clearRect(0, 0, textCanvas.width, textCanvas.height);
    ctx.fillStyle = element.fill || "#111827";
    ctx.font = "700 48px Inter, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(element.text || "", 256, 64);
    const texture = new THREE.CanvasTexture(textCanvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: number(element.opacity, 1) }));
    const scale = number(element.fontSize, 1);
    sprite.scale.set(scale * 4, scale, 1);
    applyPosition(sprite, element.position);
    return sprite;
  }

  if (element.type === "light") {
    const kind = element.kind || "ambient";
    const intensity = number(element.intensity, kind === "ambient" ? 0.6 : 1);
    const light = kind === "directional"
      ? new THREE.DirectionalLight(0xffffff, intensity)
      : kind === "point"
        ? new THREE.PointLight(0xffffff, intensity)
        : new THREE.AmbientLight(0xffffff, intensity);
    applyPosition(light, element.position);
    return light;
  }

  return undefined;
}

function materialFor(element) {
  const opacity = number(element.opacity, 1);
  return new THREE.MeshStandardMaterial({
    color: element.fill || element.stroke || "#2563eb",
    roughness: 0.45,
    transparent: opacity < 1,
    opacity
  });
}

function bindObject(object, element) {
  object.userData.sketchmark = {
    element,
    basePosition: object.position.clone(),
    baseRotation: object.rotation.clone(),
    baseScale: object.scale.clone(),
    baseOpacity: materialOpacity(object),
    baseIntensity: typeof object.intensity === "number" ? object.intensity : undefined
  };
}

function showTime(rawTime = 0) {
  const time = Number.isFinite(Number(rawTime)) ? Number(rawTime) : 0;
  for (const object of objects) applyAnimatedObject(object, time);
  renderer.render(scene, camera);
  return true;
}

function applyAnimatedObject(object, time) {
  const data = object.userData.sketchmark;
  if (!data) return;
  const element = data.element;
  const animation = element.animate || {};

  const basePosition = vector(element.position, [data.basePosition.x, data.basePosition.y, data.basePosition.z]);
  const px = valueAt(animation.positionX, time, basePosition[0]);
  const py = valueAt(animation.positionY, time, basePosition[1]);
  const pz = valueAt(animation.positionZ, time, basePosition[2]);
  object.position.set(px, py, pz);

  const rx = data.baseRotation.x + degrees(valueAt(animation.rotationX, time, number(element.rotationX, 0)));
  const ry = data.baseRotation.y + degrees(valueAt(animation.rotationY, time, number(element.rotationY, 0)));
  const rz = data.baseRotation.z + degrees(valueAt(animation.rotationZ, time, number(element.rotationZ, 0)));
  object.rotation.set(rx, ry, rz);

  const baseScale = data.baseScale;
  const allScale = valueAt(animation.scale, time, number(element.scale, 1));
  const sx = baseScale.x * valueAt(animation.scaleX, time, number(element.scaleX, allScale));
  const sy = baseScale.y * valueAt(animation.scaleY, time, number(element.scaleY, allScale));
  const sz = baseScale.z * valueAt(animation.scaleZ, time, number(element.scaleZ, allScale));
  object.scale.set(sx, sy, sz);

  const opacity = valueAt(animation.opacity, time, number(element.opacity, data.baseOpacity ?? 1));
  setMaterialOpacity(object, opacity);

  if (typeof object.intensity === "number") {
    object.intensity = valueAt(animation.intensity, time, number(element.intensity, data.baseIntensity ?? 1));
  }
}

function valueAt(animation, time, fallback) {
  if (!animation || typeof animation !== "object") return fallback;
  if (Array.isArray(animation.keyframes) && animation.keyframes.length) {
    const frames = animation.keyframes
      .filter((frame) => Array.isArray(frame) && Number.isFinite(Number(frame[0])) && Number.isFinite(Number(frame[1])))
      .map((frame) => [Number(frame[0]), Number(frame[1])])
      .sort((a, b) => a[0] - b[0]);
    if (!frames.length) return fallback;
    if (time <= frames[0][0]) return frames[0][1];
    for (let index = 0; index < frames.length - 1; index += 1) {
      const from = frames[index];
      const to = frames[index + 1];
      if (time > to[0]) continue;
      const span = Math.max(0.000001, to[0] - from[0]);
      const t = easeValue((time - from[0]) / span, animation.ease);
      return from[1] + (to[1] - from[1]) * t;
    }
    return frames[frames.length - 1][1];
  }

  const from = number(animation.from, fallback);
  const to = number(animation.to, fallback);
  const delay = number(animation.delay, 0);
  const duration = Math.max(0.000001, number(animation.duration, 1));
  const t = easeValue((time - delay) / duration, animation.ease);
  if (time <= delay) return from;
  if (time >= delay + duration) return to;
  return from + (to - from) * t;
}

function easeValue(value, kind) {
  const t = clamp(value, 0, 1);
  if (kind === "ease-in") return t * t;
  if (kind === "ease-out") return 1 - (1 - t) * (1 - t);
  if (kind === "ease-in-out") return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  return t;
}

function materialOpacity(object) {
  const material = Array.isArray(object.material) ? object.material[0] : object.material;
  return material && typeof material.opacity === "number" ? material.opacity : 1;
}

function setMaterialOpacity(object, opacity) {
  if (!object.material) return;
  const materials = Array.isArray(object.material) ? object.material : [object.material];
  for (const material of materials) {
    material.opacity = opacity;
    material.transparent = opacity < 1;
    material.needsUpdate = true;
  }
}

function applyPosition(object, position) {
  const p = vector(position, [0, 0, 0]);
  object.position.set(p[0], p[1], p[2]);
}

function vector(value, fallback) {
  return Array.isArray(value) ? fallback.map((item, index) => number(value[index], item)) : fallback;
}

function number(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function degrees(value) {
  return number(value, 0) * Math.PI / 180;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

window.__SKETCHMARK_SHOW_TIME__ = showTime;
window.__SKETCHMARK_READY__ = true;
window.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "sketchmark-show") showTime(data.time || 0);
});
showTime(${JSON.stringify(initialTime)});
</script>
</body>
</html>`;
}
