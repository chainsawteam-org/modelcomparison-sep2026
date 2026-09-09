import * as T from "three";
export const COLORS = {
  player: 0x9bf0d0,
  orange: 0xff9155,
  red: 0xee5b55,
  blue: 0x6abce0,
};
const materials = new Map<number, T.MeshStandardMaterial>();
export function mat(color: number) {
  if (!materials.has(color))
    materials.set(
      color,
      new T.MeshStandardMaterial({ color, roughness: 0.68, metalness: 0.28 }),
    );
  return materials.get(color)!;
}
export function box(
  w: number,
  h: number,
  d: number,
  color: number,
  x = 0,
  y = 0,
  z = 0,
) {
  const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
export function glow(color: number) {
  return new T.MeshBasicMaterial({ color });
}
export function ring(radius: number, color: number) {
  const m = new T.Mesh(
    new T.RingGeometry(radius - 0.035, radius, 64),
    glow(color),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.04;
  return m;
}
export type Obstacle = { x: number; z: number; w: number; d: number };
export class World {
  scene = new T.Scene();
  camera = new T.OrthographicCamera();
  renderer: T.WebGLRenderer;
  root = new T.Group();
  obstacles: Obstacle[] = [];
  ray = new T.Raycaster();
  plane = new T.Plane(new T.Vector3(0, 1, 0), -0.72);
  aim = new T.Vector3();
  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new T.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.setClearColor(0x0d191f);
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.scene.fog = new T.FogExp2(0x101c23, 0.012);
    this.scene.add(new T.HemisphereLight(0xc7e9e1, 0x23303b, 2.2));
    const sun = new T.DirectionalLight(0xffdbb4, 3.2);
    sun.position.set(-12, 24, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
      left: -25,
      right: 25,
      top: 25,
      bottom: -25,
      far: 65,
    });
    sun.shadow.bias = -0.001;
    this.scene.add(sun);
    this.scene.add(this.root);
    this.scene.add(box(43, 1, 33, 0x28383d, 0, -0.65, 0));
    this.scene.add(box(41, 0.16, 31, 0x39464a, 0, -0.08, 0));
    const grid = new T.GridHelper(40, 20, 0x647271, 0x47595b);
    grid.position.y = 0.012;
    grid.scale.z = 0.75;
    this.scene.add(grid);
    const center = ring(4.5, 0x6b7975);
    this.scene.add(center);
    this.scene.add(ring(4.25, 0x546763));
    for (const z of [-15.6, 15.6]) {
      this.scene.add(box(42, 0.8, 0.45, 0x647373, 0, 0, z));
      this.scene.add(box(40, 0.055, 0.07, 0xe4a169, 0, 0.44, z));
    }
    for (const x of [-20.6, 20.6]) {
      this.scene.add(box(0.45, 0.8, 32, 0x647373, x, 0, 0));
      this.scene.add(box(0.07, 0.055, 30, 0xe4a169, x, 0.44, 0));
    }
    for (const [x, z, w, d] of [
      [-9, -5, 3.6, 2.4],
      [9, 5, 3.6, 2.4],
      [-9, 6, 2.4, 3.6],
      [9, -6, 2.4, 3.6],
    ]) {
      this.obstacles.push({ x, z, w, d });
      this.scene.add(box(w + 0.25, 0.22, d + 0.25, 0x192c32, x, 0.11, z));
      this.scene.add(box(w, 1.35, d, 0x566763, x, 0.78, z));
      this.scene.add(box(w - 0.15, 0.1, d - 0.15, 0x758079, x, 1.5, z));
      this.scene.add(box(w, 0.12, 0.08, 0xe3a773, x, 1.25, z + d / 2 + 0.01));
      for (let i = -1; i <= 1; i++)
        this.scene.add(
          box(0.1, 0.65, 0.05, 0x283f45, x + i * 0.65, 0.7, z + d / 2 + 0.025),
        );
    }
    for (const x of [-21, 21])
      for (const z of [-15.6, 15.6]) {
        this.scene.add(box(1.3, 2, 1.3, 0x4b5c5d, x, 0.9, z));
        this.scene.add(box(1.4, 0.1, 1.4, 0xf0a36d, x, 2, z));
      }
    for (let i = 0; i < 12; i++) {
      this.scene.add(box(0.5, 0.02, 0.12, 0xc4a471, -3 + i * 0.55, 0.03, -13));
      this.scene.add(box(0.5, 0.02, 0.12, 0xc4a471, -3 + i * 0.55, 0.03, 13));
    }
    const label = (text: string, x: number, z: number, size: number) => {
      const c = document.createElement("canvas");
      c.width = 1024;
      c.height = 128;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#82908a";
      ctx.font = "bold 70px Arial";
      ctx.textAlign = "center";
      ctx.fillText(text, 512, 90);
      const tex = new T.CanvasTexture(c);
      const mesh = new T.Mesh(
        new T.PlaneGeometry(size, size / 8),
        new T.MeshBasicMaterial({
          map: tex,
          transparent: true,
          depthWrite: false,
          opacity: 0.45,
        }),
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(x, 0.026, z);
      this.scene.add(mesh);
    };
    label("RELAY / 00", 0, -10, 12);
    label("EMBER SYSTEMS", 0, 10.5, 9);
    this.camera.position.set(0, 33, 26);
    this.camera.lookAt(0, 0, 0);
    window.addEventListener("resize", () => this.resize());
    this.resize();
  }
  resize() {
    const a = innerWidth / innerHeight;
    const half = Math.max(19, 25 / a);
    this.camera.left = -half * a;
    this.camera.right = half * a;
    this.camera.top = half;
    this.camera.bottom = -half;
    this.camera.near = 0.1;
    this.camera.far = 150;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
  }
  pointer(x: number, y: number) {
    this.ray.setFromCamera(
      new T.Vector2((x / innerWidth) * 2 - 1, (-y / innerHeight) * 2 + 1),
      this.camera,
    );
    this.ray.ray.intersectPlane(this.plane, this.aim);
    return this.aim;
  }
  render(shake = 0) {
    this.camera.position.x = (Math.random() - 0.5) * shake;
    this.camera.position.z = 26 + (Math.random() - 0.5) * shake;
    this.renderer.render(this.scene, this.camera);
  }
}
export function actor(type: string) {
  const g = new T.Group();
  const c =
    type === "player"
      ? COLORS.player
      : type === "ranger"
        ? COLORS.blue
        : type === "charger"
          ? COLORS.orange
          : type === "boss"
            ? 0xc6b4a0
            : COLORS.red;
  if (type === "player") {
    g.add(box(0.68, 0.75, 0.58, 0xd7ded0, 0, 0.85, 0));
    g.add(box(0.46, 0.36, 0.46, 0x344d51, 0, 1.4, 0));
    g.add(box(0.38, 0.12, 0.08, COLORS.player, 0, 1.42, 0.25));
    g.add(box(0.22, 0.32, 0.9, 0x243d42, 0.4, 0.92, 0.5));
    g.add(box(0.12, 0.12, 0.25, COLORS.player, 0.4, 0.95, 1));
    g.add(box(0.23, 0.38, 0.3, 0x22373c, -0.2, 0.3, 0));
    g.add(box(0.23, 0.38, 0.3, 0x22373c, 0.2, 0.3, 0));
  } else {
    const boss = type === "boss";
    const body = new T.Mesh(
      new T.CylinderGeometry(
        boss ? 1.3 : 0.45,
        boss ? 1.7 : 0.7,
        boss ? 1.6 : 0.65,
        type === "charger" ? 3 : 6,
      ),
      mat(c),
    );
    body.position.y = boss ? 1.2 : 0.65;
    g.add(body);
    g.add(
      box(
        boss ? 0.9 : 0.34,
        boss ? 0.4 : 0.24,
        boss ? 0.7 : 0.3,
        0x20353a,
        0,
        boss ? 2.15 : 1.12,
        0,
      ),
    );
    g.add(
      box(
        boss ? 0.8 : 0.28,
        0.1,
        0.08,
        0xffedbd,
        0,
        boss ? 2.2 : 1.15,
        boss ? 0.39 : 0.19,
      ),
    );
    for (const x of [-1, 1])
      g.add(
        box(
          boss ? 0.55 : 0.18,
          0.25,
          boss ? 1.7 : 0.65,
          0x253c40,
          x * (boss ? 1.4 : 0.55),
          0.25,
          0,
        ),
      );
    if (type === "ranger") g.add(box(0.18, 0.2, 1, 0x315965, 0, 0.9, 0.5));
  }
  if (type === "charger") {
    const warning = new T.Mesh(
      new T.PlaneGeometry(0.22, 9),
      new T.MeshBasicMaterial({
        color: 0xff9b5c,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      }),
    );
    warning.rotation.x = -Math.PI / 2;
    warning.position.set(0, 0.06, 4.6);
    warning.name = "warning";
    warning.visible = false;
    g.add(warning);
  }
  g.add(ring(type === "boss" ? 1.9 : 0.7, c));
  return g;
}
