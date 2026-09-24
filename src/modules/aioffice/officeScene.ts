// The 3D open-plan office behind the AI Ofis page (approved mockup, ported).
// Six agents sit at their desks typing; `play(event)` turns one
// agent_events record into visible movement — the Hisobchi robot walking
// to a colleague, a report flying to the Telegram screen, the warehouse
// agent carrying a box to the shelf. Plain three.js, no React inside.
import * as THREE from "three";

export type AgentId = "it" | "sales" | "fin" | "prod" | "wh" | "bot" | "hr";

export type AgentEvent = {
  id: string;
  agent: AgentId;
  kind: "report" | "alert" | "question" | "answer" | "proposed" | "action" | "cancelled";
  text: string;
  bubble?: string;
  visit?: AgentId | null;
  detail?: { direction?: "in" | "out"; item?: string; quantity?: number; kind?: string } | null;
  source?: string;
  created_at: string;
};

export const AGENT_NAMES: Record<AgentId, string> = {
  it: "IT hodim",
  sales: "Sotuv nazoratchisi",
  fin: "Moliyachi",
  prod: "Ishlab chiqarish",
  wh: "Omborchi",
  bot: "Hisobchi",
  hr: "HR (Kadrlar)",
};

type AgentDef = {
  id: AgentId; x: number; z: number; shirt: string; skin: string; hair: string;
  hat: "headset" | "tie" | "glasses" | "cap" | "robot" | "hardhat" | "bun"; zone: string; zoneColor: string;
};

type Agent = AgentDef & {
  root: THREE.Group; body: THREE.Group; legs: THREE.Group[]; arms: THREE.Group[]; head: THREE.Group;
  robot: boolean; antenna?: THREE.Mesh; pos: THREE.Vector3; rot: number; targetRot: number;
  path: THREE.Vector3[]; resolve: (() => void) | null; sitting: boolean; phase: number;
  carrying: THREE.Mesh | null; state: "work" | "walk" | "wait" | "done"; alert: boolean;
  sayUntil: number; tagEl: HTMLDivElement; sayEl: HTMLDivElement;
};

const BACK = -4.7;
const FRONT = 2.8;
const LANE = 0.35;
const W = 24;
const D = 16;
const FONT = '"Manrope", "Inter", system-ui, sans-serif';

const AGENT_DEFS: AgentDef[] = [
  { id: "it", x: -7.5, z: BACK, shirt: "#2a9d8f", skin: "#f1c7a0", hair: "#2b1d16", hat: "headset", zone: "SERVER XONASI", zoneColor: "#1d3b4f" },
  { id: "sales", x: -1.2, z: BACK, shirt: "#3b6fb6", skin: "#e3ae84", hair: "#3b2a20", hat: "tie", zone: "SOTUV BO'LIMI", zoneColor: "#2b5c86" },
  { id: "hr", x: 3.4, z: BACK, shirt: "#d9577a", skin: "#f3c9a8", hair: "#3a2418", hat: "bun", zone: "KADRLAR BO'LIMI", zoneColor: "#8a3a5c" },
  { id: "fin", x: 7.5, z: BACK, shirt: "#8e5bb5", skin: "#f5d0b0", hair: "#6b3b24", hat: "glasses", zone: "BUXGALTERIYA", zoneColor: "#4a3f7a" },
  { id: "prod", x: -6.5, z: FRONT, shirt: "#e07a3f", skin: "#d9a178", hair: "#1e1511", hat: "cap", zone: "ISHLAB CHIQARISH", zoneColor: "#8a4b2a" },
  { id: "bot", x: 0.8, z: FRONT, shirt: "#9fb3c1", skin: "#c7d5de", hair: "#c7d5de", hat: "robot", zone: "QABULXONA", zoneColor: "#1d6a7d" },
  { id: "wh", x: 7, z: FRONT, shirt: "#5a8f3c", skin: "#eab893", hair: "#2e2019", hat: "hardhat", zone: "OMBOR", zoneColor: "#4b6a33" },
];

const STATE_LABEL: Record<Agent["state"], [string, string]> = {
  work: ["Ishlamoqda", ""],
  walk: ["Yurmoqda", "walk"],
  wait: ["Tasdiq kutmoqda", "wait"],
  done: ["Bajardi", "done"],
};

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class OfficeScene {
  onChange: () => void = () => {};
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
  private orbit = { theta: 0.5, phi: 0.9, r: 27 };
  private goal = { theta: 0.5, phi: 0.9, r: 27 };
  private target = new THREE.Vector3(0, 0, 0.3);
  private agents = {} as Record<AgentId, Agent>;
  private workLights = {} as Record<AgentId, { light: THREE.PointLight; logo: THREE.Mesh }>;
  private leds: THREE.Mesh[] = [];
  private planes: { m: THREE.Mesh; from: THREE.Vector3; to: THREE.Vector3; t: number; dur: number; res: () => void }[] = [];
  private printer = new THREE.Group();
  private pile = new THREE.Group();
  private shelf = new THREE.Group();
  private shelfSlots: { y: number; z: number; mesh: THREE.Mesh | null }[] = [];
  private palletBoxes: THREE.Mesh[] = [];
  private printingUntil = 0;
  private channel: { from: string; text: string; me: boolean }[] = [];
  private redrawScreen: () => void = () => {};
  private screenPos = new THREE.Vector3(3.4, 2.1, -D / 2 + 0.3);
  private pallet = new THREE.Vector3(10.6, 0, 6.8);
  private clock = new THREE.Clock();
  private raf = 0;
  private ro: ResizeObserver;
  private drag: { x: number; y: number } | null = null;
  private reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  private disposed = false;
  private proj = new THREE.Vector3();

  constructor(private stage: HTMLElement, private overlay: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    stage.prepend(this.renderer.domElement);
    this.scene.background = new THREE.Color("#cfe6ee");
    this.buildRoom();
    this.buildAgents();
    this.buildProps();
    this.bindControls();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(stage);
    this.resize();
    this.tick();
  }

  // ── public API ────────────────────────────────────────────
  get walkingCount() {
    return Object.values(this.agents).filter((a) => a.state === "walk").length;
  }

  setAlert(id: AgentId, on: boolean) {
    const a = this.agents[id];
    if (!a) return;
    a.alert = on;
    a.tagEl.classList.toggle("alert", on);
    this.onChange();
  }

  setView(view: "3d" | "top") {
    if (view === "top") Object.assign(this.goal, { phi: 0.02, theta: 0 });
    else Object.assign(this.goal, { phi: 0.9, theta: 0.5 });
  }

  zoom(delta: number) {
    this.goal.r = Math.min(60, Math.max(16, this.goal.r + delta));
  }

  seedChannel(messages: { from: string; text: string; me?: boolean }[]) {
    this.channel = messages.slice(-8).map((m) => ({ from: m.from, text: m.text, me: Boolean(m.me) }));
    this.redrawScreen();
  }

  async play(ev: AgentEvent) {
    const a = this.agents[ev.agent];
    if (!a || this.disposed) return;
    const bubble = ev.bubble || ev.text;
    const bot = this.agents.bot;
    switch (ev.kind) {
      case "report":
      case "alert": {
        this.say(a, bubble, 4200, ev.kind === "alert");
        await sleep(700);
        this.setAlert(ev.agent, ev.kind === "alert");
        await this.flyPlane(this.headPos(a), this.screenPos);
        this.postChannel(AGENT_NAMES[ev.agent], ev.text);
        break;
      }
      case "question": {
        this.postChannel(ev.source === "web" ? "Sayt" : "Kanal", ev.text, true);
        await this.flyPlane(this.screenPos, this.headPos(bot));
        this.say(bot, `«${bubble}»`, 3000);
        this.setState(bot, "work");
        break;
      }
      case "answer": {
        const v = ev.visit ? this.agents[ev.visit] : null;
        if (v && v !== bot) {
          this.say(bot, `${AGENT_NAMES[v.id]}dan so'rab kelaman`, 2400);
          await this.leaveDesk(bot);
          await this.goVisit(bot, v);
          this.standUp(v, 0);
          await sleep(700);
          this.say(v, "Mana, hisob tayyor", 2000);
          this.carry(v, "paper");
          await sleep(1100);
          this.carry(v, null);
          this.carry(bot, "paper");
          v.sitting = true;
          await this.backToDesk(bot);
          this.carry(bot, null);
        }
        this.say(bot, bubble, 4200);
        this.setState(bot, "done");
        await this.flyPlane(this.headPos(bot), this.screenPos);
        this.postChannel("Hisobchi", ev.text);
        await sleep(1200);
        this.setState(bot, "work");
        break;
      }
      case "proposed": {
        this.say(bot, bubble, 0);
        this.setState(bot, "wait");
        await this.flyPlane(this.headPos(bot), this.screenPos);
        this.postChannel("Hisobchi", `${ev.text} — tasdiqlaysizmi?`);
        break;
      }
      case "cancelled": {
        this.say(bot, "Bekor qilindi", 2400);
        this.setState(bot, "work");
        this.postChannel("Hisobchi", "❌ Bekor qilindi");
        break;
      }
      case "action": {
        await this.playAction(ev);
        break;
      }
    }
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    for (const a of Object.values(this.agents)) {
      a.tagEl.remove();
      a.sayEl.remove();
    }
  }

  // ── actions ───────────────────────────────────────────────
  private async playAction(ev: AgentEvent) {
    const bot = this.agents.bot;
    const v = ev.visit ? this.agents[ev.visit] : null;
    this.say(bot, "Tasdiqlandi, bajaraman", 2200);
    this.setState(bot, "work");
    if (v && v.id === "prod") {
      this.carry(bot, "paper");
      await this.leaveDesk(bot);
      await this.goVisit(bot, v);
      this.carry(bot, null);
      this.carry(v, "paper");
      this.standUp(v, -Math.PI / 2);
      this.say(v, "Qabul qildim!", 1800);
      await sleep(600);
      const botBack = this.backToDesk(bot);
      await this.walk(v, [new THREE.Vector3(-8.4, 0, v.z)]);
      v.targetRot = -Math.PI / 2;
      this.carry(v, null);
      this.printingUntil = performance.now() + 2400;
      this.say(v, "Bajarilmoqda…", 2400);
      await sleep(2500);
      this.addToPile();
      this.say(v, "Tayyor ✅", 2400);
      await this.walk(v, [new THREE.Vector3(v.x, 0, v.z)]);
      v.targetRot = 0;
      v.sitting = true;
      this.setState(v, "work");
      await botBack;
    } else if (v && v.id === "wh") {
      await this.flyPlane(this.headPos(bot), this.headPos(v));
      this.standUp(v);
      if (ev.detail?.direction === "out") {
        this.say(v, `Chiqim: ${ev.detail.item || "material"}`, 2400);
        await this.walk(v, [new THREE.Vector3(v.x + 1.5, 0, v.z), new THREE.Vector3(10.1, 0, 2.0)]);
        v.targetRot = Math.PI / 2;
        await sleep(500);
        this.takeFromShelf();
        this.carry(v, "box");
        // hand the material over to production, next to the prod desk
        await this.walk(v, [new THREE.Vector3(9.4, 0, LANE), new THREE.Vector3(-4.9, 0, LANE), new THREE.Vector3(-4.9, 0, FRONT)]);
        v.targetRot = -Math.PI / 2;
        this.carry(v, null);
        this.say(v, "Sexga topshirdim", 1800);
        await sleep(600);
        await this.walk(v, [new THREE.Vector3(-4.9, 0, LANE), new THREE.Vector3(v.x + 1.5, 0, LANE), new THREE.Vector3(v.x + 1.5, 0, v.z), new THREE.Vector3(v.x, 0, v.z)]);
      } else {
        this.say(v, "Yuk keldi, qabul qilaman!", 2200);
        await this.walk(v, [new THREE.Vector3(v.x + 1.5, 0, v.z), new THREE.Vector3(9.4, 0, 5.6), new THREE.Vector3(this.pallet.x - 0.9, 0, this.pallet.z - 0.7)]);
        v.targetRot = Math.PI / 2;
        await sleep(500);
        this.takeFromPallet();
        this.carry(v, "box");
        await this.walk(v, [new THREE.Vector3(9.4, 0, 5.6), new THREE.Vector3(10.1, 0, 2.0)]);
        v.targetRot = Math.PI / 2;
        await sleep(500);
        this.carry(v, null);
        this.putOnShelf();
        this.say(v, ev.detail?.quantity ? `+${ev.detail.quantity} ${ev.detail.item || ""} ✅` : "Joylandi ✅", 2600);
        await this.walk(v, [new THREE.Vector3(9.4, 0, v.z), new THREE.Vector3(v.x + 1.5, 0, v.z), new THREE.Vector3(v.x, 0, v.z)]);
      }
      v.targetRot = 0;
      v.sitting = true;
      this.setState(v, "work");
    } else if (v) {
      // fin (payments, expenses, supplier invoices) and anyone else: hand over the paper
      this.carry(bot, "paper");
      await this.leaveDesk(bot);
      await this.goVisit(bot, v);
      this.standUp(v, 0);
      this.carry(bot, null);
      this.carry(v, "paper");
      this.say(v, "Yozib qo'ydim ✅", 2200);
      await sleep(1200);
      this.carry(v, null);
      v.sitting = true;
      await this.backToDesk(bot);
    }
    this.say(bot, ev.bubble || "Bajarildi ✅", 3200);
    this.setState(bot, "done");
    await this.flyPlane(this.headPos(bot), this.screenPos);
    this.postChannel("Hisobchi", `✅ ${ev.text}`);
    await sleep(1200);
    this.setState(bot, "work");
  }

  // ── building the world ────────────────────────────────────
  private mat(color: string, o: THREE.MeshStandardMaterialParameters = {}) {
    return new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, ...o });
  }

  private mesh(geo: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D = this.scene, x = 0, y = 0, z = 0) {
    const me = new THREE.Mesh(geo, m);
    me.position.set(x, y, z);
    me.castShadow = true;
    me.receiveShadow = true;
    parent.add(me);
    return me;
  }

  private box(w: number, h: number, d: number, color: string | THREE.Material, parent: THREE.Object3D = this.scene, x = 0, y = 0, z = 0) {
    return this.mesh(new THREE.BoxGeometry(w, h, d), typeof color === "string" ? this.mat(color) : color, parent, x, y, z);
  }

  private canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const g = c.getContext("2d")!;
    const redraw = () => {
      draw(g, w, h);
      tex.needsUpdate = true;
    };
    redraw();
    return { tex, redraw };
  }

  private buildRoom() {
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8a9aa6, 2.1));
    const sun = new THREE.DirectionalLight(0xfff0d8, 2.2);
    sun.position.set(9, 20, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 12, bottom: -12, near: 1, far: 50 });
    this.scene.add(sun);

    const floorTex = this.canvasTex(1024, 683, (g, w, h) => {
      g.fillStyle = "#d8b98c";
      g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 34) {
        g.fillStyle = (y / 34) % 2 ? "#d3b284" : "#dcbe93";
        g.fillRect(0, y, w, 34);
        g.fillStyle = "rgba(120, 84, 48, .25)";
        g.fillRect(0, y, w, 2);
        for (let x = ((y / 34) % 3) * 90; x < w; x += 260) g.fillRect(x, y, 2, 34);
      }
    });
    const floor = this.mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: floorTex.tex, roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2;
    floor.castShadow = false;
    this.box(W + 0.6, 0.3, D + 0.6, "#8f9ea6", this.scene, 0, -0.16, 0);
    const wallMat = this.mat("#eef2f0");
    this.box(W + 0.3, 3.4, 0.3, wallMat, this.scene, 0, 1.7, -D / 2 - 0.15);
    this.box(0.3, 3.4, D + 0.3, wallMat, this.scene, -W / 2 - 0.15, 1.7, 0);
    const glass = this.mat("#a9dcef", { emissive: "#6fb6d6", emissiveIntensity: 0.35 });
    for (const x of [-9.5, 9.5]) {
      this.box(3.2, 1.6, 0.06, glass, this.scene, x, 2, -D / 2 + 0.02);
      this.box(3.4, 0.12, 0.12, "#6b7a82", this.scene, x, 1.15, -D / 2 + 0.06);
    }
    for (const z of [-4, 3]) this.box(0.06, 1.6, 3.2, glass, this.scene, -W / 2 + 0.02, 2, z);

    const sign = this.canvasTex(1024, 128, (g, w, h) => {
      g.fillStyle = "#0f2a36";
      g.fillRect(0, 0, w, h);
      g.fillStyle = "#ffd27a";
      g.font = `700 60px ${FONT}`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText("VODIY PRINT · AI OFIS", w / 2, h / 2 + 4);
    });
    this.mesh(new THREE.PlaneGeometry(6.4, 0.8), new THREE.MeshBasicMaterial({ map: sign.tex }), this.scene, -4.6, 2.95, -D / 2 + 0.02);

    // Telegram channel screen on the back wall — messages really appear on it
    const wrap = (g: CanvasRenderingContext2D, text: string, maxW: number) => {
      const lines: string[] = [];
      let line = "";
      for (const word of text.split(" ")) {
        const t = line ? `${line} ${word}` : word;
        if (g.measureText(t).width > maxW && line) {
          lines.push(line);
          line = word;
        } else line = t;
      }
      if (line) lines.push(line);
      return lines.slice(0, 4);
    };
    const screen = this.canvasTex(768, 460, (g, w, h) => {
      g.fillStyle = "#dfeef7";
      g.fillRect(0, 0, w, h);
      g.fillStyle = "#2aa3df";
      g.fillRect(0, 0, w, 64);
      g.fillStyle = "#fff";
      g.font = `700 30px ${FONT}`;
      g.textBaseline = "middle";
      g.textAlign = "left";
      g.fillText("✈  IT hisobot kanali", 22, 33);
      let y = h - 14;
      for (const m of [...this.channel].reverse()) {
        g.font = `600 21px ${FONT}`;
        const lines = wrap(g, m.text, 470);
        const bh = 34 + lines.length * 26;
        y -= bh;
        if (y < 72) break;
        const bx = m.me ? w - 530 : 18;
        g.fillStyle = m.me ? "#c9f0c7" : "#ffffff";
        g.beginPath();
        g.roundRect(bx, y, 512, bh - 8, 14);
        g.fill();
        g.fillStyle = m.me ? "#2f7d3a" : "#2a7fb8";
        g.font = `700 18px ${FONT}`;
        g.fillText(m.from, bx + 14, y + 16);
        g.fillStyle = "#13262f";
        g.font = `600 21px ${FONT}`;
        lines.forEach((l, i) => g.fillText(l, bx + 14, y + 42 + i * 26));
        y -= 6;
      }
    });
    this.redrawScreen = screen.redraw;
    this.box(5.4, 3.3, 0.14, "#0f2a36", this.scene, 3.4, 2.0, -D / 2 + 0.08);
    this.mesh(new THREE.PlaneGeometry(5.1, 3.05), new THREE.MeshBasicMaterial({ map: screen.tex }), this.scene, 3.4, 2.0, -D / 2 + 0.16).castShadow = false;
  }

  private floorLabel(text: string, x: number, z: number, color: string) {
    const t = this.canvasTex(512, 96, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.fillStyle = color;
      g.beginPath();
      g.roundRect(4, 8, w - 8, h - 16, 40);
      g.fill();
      g.fillStyle = "#fff";
      g.font = `700 42px ${FONT}`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(text, w / 2, h / 2 + 3);
    });
    const m = this.mesh(new THREE.PlaneGeometry(3.4, 0.64), new THREE.MeshBasicMaterial({ map: t.tex, transparent: true }), this.scene, x, 0.02, z);
    m.rotation.x = -Math.PI / 2;
    m.castShadow = false;
  }

  private makeDesk(id: AgentId, x: number, zSeat: number, color: string) {
    const g = new THREE.Group();
    g.position.set(x, 0, zSeat + 1.15);
    this.scene.add(g);
    this.box(2.4, 0.08, 1.1, color, g, 0, 0.76, 0);
    for (const [dx, dz] of [[-1.1, -0.45], [1.1, -0.45], [-1.1, 0.45], [1.1, 0.45]]) this.box(0.08, 0.76, 0.08, "#7d5431", g, dx, 0.38, dz);
    this.box(0.8, 0.04, 0.55, "#b9c4ca", g, 0, 0.82, -0.05);
    const lid = new THREE.Group();
    lid.position.set(0, 0.84, 0.2);
    lid.rotation.x = 0.35;
    g.add(lid);
    this.box(0.8, 0.52, 0.03, "#c9d4da", lid, 0, 0.26, 0);
    const logo = this.box(0.1, 0.1, 0.01, this.mat("#9aa9b1", { emissive: "#8ff0d8", emissiveIntensity: 0 }), lid, 0, 0.27, 0.02);
    const light = new THREE.PointLight(0x8ff0d8, 0, 2.8);
    light.position.set(0, 1.25, -0.55);
    g.add(light);
    this.workLights[id] = { light, logo };
    const c = new THREE.Group();
    c.position.set(x, 0, zSeat - 0.05);
    this.scene.add(c);
    this.box(0.62, 0.08, 0.6, "#2c3e48", c, 0, 0.46, 0);
    this.box(0.62, 0.72, 0.08, "#2c3e48", c, 0, 0.84, -0.3);
    this.mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.42, 8), this.mat("#5d6a71"), c, 0, 0.21, 0);
  }

  private buildPerson(a: AgentDef) {
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);
    const pivot = (x: number, y: number, z: number) => {
      const p = new THREE.Group();
      p.position.set(x, y, z);
      body.add(p);
      return p;
    };
    const robot = a.hat === "robot";
    const legs: THREE.Group[] = [];
    let antenna: THREE.Mesh | undefined;
    if (robot) {
      this.mesh(new THREE.CylinderGeometry(0.28, 0.36, 0.5, 16), this.mat("#7d93a3", { metalness: 0.4 }), body, 0, 0.3, 0);
      this.mesh(new THREE.TorusGeometry(0.3, 0.06, 8, 20), this.mat("#3b4b55"), body, 0, 0.08, 0).rotation.x = Math.PI / 2;
    } else {
      for (const s of [-1, 1]) {
        const p = pivot(s * 0.13, 0.62, 0);
        this.box(0.18, 0.6, 0.2, "#2d3a44", p, 0, -0.3, 0);
        this.box(0.2, 0.08, 0.3, "#1a2228", p, 0, -0.6, 0.05);
        legs.push(p);
      }
    }
    this.mesh(new THREE.CylinderGeometry(0.3, 0.33, 0.72, 16), this.mat(a.shirt, robot ? { metalness: 0.45, roughness: 0.4 } : {}), body, 0, 0.98, 0);
    const arms: THREE.Group[] = [];
    for (const s of [-1, 1]) {
      const p = pivot(s * 0.42, 1.28, 0);
      this.box(0.14, 0.56, 0.14, a.shirt, p, 0, -0.26, 0);
      this.mesh(new THREE.SphereGeometry(0.08, 10, 8), this.mat(a.skin), p, 0, -0.57, 0);
      arms.push(p);
    }
    const head = pivot(0, 1.58, 0);
    if (robot) {
      this.box(0.54, 0.46, 0.46, this.mat("#c7d5de", { metalness: 0.3, roughness: 0.4 }), head, 0, 0.02, 0);
      this.box(0.42, 0.2, 0.02, this.mat("#16323f"), head, 0, 0.04, 0.235);
      for (const s of [-1, 1]) this.box(0.08, 0.1, 0.02, this.mat("#8ff0d8", { emissive: "#8ff0d8", emissiveIntensity: 1 }), head, s * 0.1, 0.04, 0.25);
      this.mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.24, 6), this.mat("#6d8494"), head, 0, 0.36, 0);
      antenna = this.mesh(new THREE.SphereGeometry(0.06, 10, 8), this.mat("#ff7a59", { emissive: "#ff5a36", emissiveIntensity: 1 }), head, 0, 0.5, 0);
      this.box(0.3, 0.2, 0.02, this.mat("#8ff0d8", { emissive: "#8ff0d8", emissiveIntensity: 0.6 }), body, 0, 1.05, 0.33);
    } else {
      this.mesh(new THREE.SphereGeometry(0.27, 20, 16), this.mat(a.skin), head, 0, 0, 0);
      this.mesh(new THREE.SphereGeometry(0.285, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2.1), this.mat(a.hair), head, 0, 0.02, -0.01);
      for (const s of [-1, 1]) this.mesh(new THREE.SphereGeometry(0.035, 8, 6), this.mat("#1d2a33"), head, s * 0.1, 0.02, 0.25);
      this.mesh(new THREE.TorusGeometry(0.07, 0.015, 6, 12, Math.PI), this.mat("#7a3b2a"), head, 0, -0.08, 0.25).rotation.z = Math.PI;
      if (a.hat === "headset") {
        this.mesh(new THREE.TorusGeometry(0.29, 0.03, 8, 20, Math.PI), this.mat("#1d2b33"), head, 0, 0.02, 0).rotation.y = Math.PI / 2;
        for (const s of [-1, 1]) this.box(0.08, 0.16, 0.12, "#1d2b33", head, s * 0.29, -0.02, 0);
      }
      if (a.hat === "glasses") {
        for (const s of [-1, 1]) this.mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 14), this.mat("#2c1f3a"), head, s * 0.1, 0.02, 0.27);
        this.mesh(new THREE.SphereGeometry(0.11, 12, 10), this.mat(a.hair), head, 0, 0.28, -0.08);
      }
      if (a.hat === "cap") {
        this.mesh(new THREE.SphereGeometry(0.3, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2.2), this.mat("#d6452f"), head, 0, 0.03, 0);
        this.box(0.36, 0.03, 0.24, "#b8341f", head, 0, 0.06, 0.3);
      }
      if (a.hat === "hardhat") {
        this.mesh(new THREE.SphereGeometry(0.31, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2.1), this.mat("#f2c230", { roughness: 0.4 }), head, 0, 0.04, 0);
        this.mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.03, 20), this.mat("#d9a916"), head, 0, 0.05, 0.02);
      }
      if (a.hat === "tie") this.box(0.07, 0.34, 0.02, "#c23b4a", body, 0, 1.06, 0.33);
      if (a.hat === "bun") {
        this.mesh(new THREE.SphereGeometry(0.12, 12, 10), this.mat(a.hair), head, 0, 0.2, -0.2);
        this.box(0.16, 0.2, 0.02, "#ffffff", body, 0.12, 1.02, 0.33); // staff badge
      }
    }
    this.scene.add(root);
    return { root, body, legs, arms, head, robot, antenna };
  }

  private buildAgents() {
    for (const def of AGENT_DEFS) {
      const r = this.box(def.id === "hr" ? 3.4 : 4.6, 0.02, 3.6, def.id === "bot" ? "#bfe0e6" : "#e8dcc6", this.scene, def.x, 0.012, def.z + 0.55);
      r.castShadow = false;
      this.floorLabel(def.zone, def.x, def.z + (def.z === BACK ? 2.45 : 2.55), def.zoneColor);
      this.makeDesk(def.id, def.x, def.z, def.id === "bot" ? "#e9eef1" : "#c98b4f");
      const parts = this.buildPerson(def);
      const tagEl = document.createElement("div");
      tagEl.className = "ao-tag";
      tagEl.innerHTML = `<span class="nm"><span class="bang">!</span>${AGENT_NAMES[def.id]}</span><span class="st">Ishlamoqda</span>`;
      const sayEl = document.createElement("div");
      sayEl.className = "ao-say";
      this.overlay.append(tagEl, sayEl);
      this.agents[def.id] = {
        ...def,
        ...parts,
        pos: new THREE.Vector3(def.x, 0, def.z),
        rot: 0,
        targetRot: 0,
        path: [],
        resolve: null,
        sitting: true,
        phase: Math.random() * 6,
        carrying: null,
        state: "work",
        alert: false,
        sayUntil: 0,
        tagEl,
        sayEl,
      };
    }
  }

  private buildProps() {
    // IT: server rack with blinking LEDs
    const rack = new THREE.Group();
    rack.position.set(-10.4, 0, -6.2);
    this.scene.add(rack);
    this.box(1, 2.4, 0.8, "#0e1e27", rack, 0, 1.2, 0);
    for (let i = 0; i < 6; i++) {
      this.box(0.8, 0.26, 0.02, "#1b303b", rack, 0, 0.45 + i * 0.34, 0.41);
      this.leds.push(this.box(0.07, 0.07, 0.02, this.mat("#5df2a8", { emissive: i % 2 ? "#5df2a8" : "#f5c542", emissiveIntensity: 1 }), rack, -0.28, 0.45 + i * 0.34, 0.43));
    }
    // Sales: whiteboard
    const board = this.canvasTex(512, 320, (g, w) => {
      g.fillStyle = "#f7f9fa";
      g.fillRect(0, 0, w, 320);
      const rows: [string, string, number][] = [["Lidlar", "#6fb3e6", 440], ["Bog'lanildi", "#f2a541", 300], ["Buyurtma", "#43c690", 150]];
      rows.forEach(([txt, c, bw], i) => {
        g.fillStyle = c;
        g.fillRect((w - bw) / 2, 40 + i * 90, bw, 64);
        g.fillStyle = "#13262f";
        g.font = `700 30px ${FONT}`;
        g.textAlign = "center";
        g.fillText(txt, w / 2, 82 + i * 90);
      });
    });
    const b = new THREE.Group();
    b.position.set(-3.9, 0, -7.2);
    this.scene.add(b);
    this.box(2.3, 1.5, 0.08, "#9aa9b1", b, 0, 1.7, 0);
    this.mesh(new THREE.PlaneGeometry(2.1, 1.32), new THREE.MeshBasicMaterial({ map: board.tex }), b, 0, 1.7, 0.05).castShadow = false;
    // Finance: safe
    const safe = new THREE.Group();
    safe.position.set(10.3, 0, -6.2);
    this.scene.add(safe);
    this.box(1.1, 1.3, 0.9, this.mat("#58626b", { metalness: 0.5, roughness: 0.45 }), safe, 0, 0.65, 0);
    this.mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 20), this.mat("#8b969e", { metalness: 0.6 }), safe, 0, 0.72, 0.46).rotation.x = Math.PI / 2;
    this.box(0.08, 0.3, 0.06, "#c9a24a", safe, 0.35, 0.7, 0.47);
    // Production: printing machine + pile of finished orders
    this.printer.position.set(-10.2, 0, 2.6);
    this.scene.add(this.printer);
    this.box(1.6, 1.1, 1.3, this.mat("#5d6a71", { metalness: 0.3 }), this.printer, 0, 0.55, 0);
    ["#e07a3f", "#f2c230", "#2aa3df"].forEach((c, i) => {
      this.mesh(new THREE.CylinderGeometry(0.11, 0.11, 1.35, 12), this.mat(c), this.printer, -0.5 + i * 0.5, 1.15, 0).rotation.x = Math.PI / 2;
    });
    this.box(0.9, 0.05, 0.7, "#2b353b", this.printer, 0.95, 0.62, 0);
    this.pile.position.set(-10.2, 0, 4.7);
    this.scene.add(this.pile);
    for (let i = 0; i < 2; i++) this.box(0.7, 0.4, 0.5, "#c69a5b", this.pile, i * 0.75 - 0.35, 0.2, 0);
    // Warehouse: shelves + delivery pallet by the door
    this.shelf.position.set(11, 0, 0.8);
    this.scene.add(this.shelf);
    for (const z of [-1.1, 1.1]) this.box(0.08, 2.4, 0.08, "#6b4a33", this.shelf, 0, 1.2, z);
    [0.5, 1.2, 1.9].forEach((y, i) => {
      this.box(0.7, 0.06, 2.3, "#8a6443", this.shelf, 0, y, 0);
      for (const z of [-0.7, 0, 0.7]) {
        const filled = i === 0 || (i === 2 && z !== 0.7);
        this.shelfSlots.push({ y: y + 0.2, z, mesh: filled ? this.box(0.5, 0.34, 0.5, "#d8ae6c", this.shelf, 0, y + 0.2, z) : null });
      }
    });
    this.box(1.4, 0.14, 1.1, "#8a6443", this.scene, this.pallet.x, 0.07, this.pallet.z);
    for (const dx of [-0.3, 0.3]) this.palletBoxes.push(this.box(0.55, 0.4, 0.5, "#e3c08a", this.scene, this.pallet.x + dx, 0.34, this.pallet.z));
    for (const [x, z] of [[-11, 7], [4.4, -7.2], [-11, -1.2]]) {
      this.mesh(new THREE.CylinderGeometry(0.3, 0.24, 0.5, 12), this.mat("#c9693f"), this.scene, x, 0.25, z);
      this.mesh(new THREE.SphereGeometry(0.5, 12, 10), this.mat("#4f9a55"), this.scene, x, 0.95, z);
    }
  }

  private addToPile() {
    const n = this.pile.children.length;
    if (n >= 6) {
      while (this.pile.children.length > 2) this.pile.remove(this.pile.children[this.pile.children.length - 1]);
    }
    const i = this.pile.children.length;
    this.box(0.7, 0.4, 0.5, "#e3c08a", this.pile, (i % 2) * 0.75 - 0.35, 0.2 + Math.floor(i / 2) * 0.4, 0);
  }

  private takeFromPallet() {
    const b = this.palletBoxes.find((x) => x.visible);
    if (b) b.visible = false;
    if (!this.palletBoxes.some((x) => x.visible)) setTimeout(() => this.palletBoxes.forEach((x) => (x.visible = true)), 4000);
  }

  private putOnShelf() {
    let slot = this.shelfSlots.find((s) => !s.mesh);
    if (!slot) {
      // shelf full: clear the top row so it keeps working
      for (const s of this.shelfSlots.slice(6)) if (s.mesh) (this.shelf.remove(s.mesh), (s.mesh = null));
      slot = this.shelfSlots.find((s) => !s.mesh)!;
    }
    slot.mesh = this.box(0.5, 0.34, 0.5, "#e3c08a", this.shelf, 0, slot.y, slot.z);
  }

  private takeFromShelf() {
    const slot = [...this.shelfSlots].reverse().find((s) => s.mesh);
    if (slot && slot.mesh) {
      this.shelf.remove(slot.mesh);
      slot.mesh = null;
    }
  }

  // ── movement + overlay ────────────────────────────────────
  private setState(a: Agent, s: Agent["state"]) {
    a.state = s;
    const st = a.tagEl.querySelector(".st") as HTMLElement;
    st.textContent = STATE_LABEL[s][0];
    st.className = `st ${STATE_LABEL[s][1]}`;
    this.onChange();
  }

  private say(a: Agent, text: string, ms = 3600, warn = false) {
    a.sayEl.textContent = text;
    a.sayEl.classList.add("show");
    a.sayEl.classList.toggle("warn", warn);
    a.sayUntil = ms ? performance.now() + ms : Infinity;
  }

  private postChannel(from: string, text: string, me = false) {
    this.channel.push({ from, text, me });
    if (this.channel.length > 8) this.channel.shift();
    this.redrawScreen();
  }

  private walk(a: Agent, points: THREE.Vector3[]) {
    return new Promise<void>((res) => {
      a.sitting = false;
      a.path = points.map((p) => p.clone());
      a.resolve = res;
      this.setState(a, "walk");
    });
  }

  private leaveDesk(a: Agent) {
    return this.walk(a, [new THREE.Vector3(a.x + 1.5, 0, a.z), new THREE.Vector3(a.x + 1.5, 0, LANE)]);
  }

  private async backToDesk(a: Agent) {
    await this.walk(a, [
      new THREE.Vector3(a.pos.x, 0, LANE),
      new THREE.Vector3(a.x + 1.5, 0, LANE),
      new THREE.Vector3(a.x + 1.5, 0, a.z),
      new THREE.Vector3(a.x, 0, a.z),
    ]);
    a.targetRot = 0;
    a.sitting = true;
    this.setState(a, "work");
  }

  private async goVisit(a: Agent, t: Agent) {
    const spot = t.z === BACK ? { p: new THREE.Vector3(t.x + 0.3, 0, -2.35), rot: Math.PI } : { p: new THREE.Vector3(t.x - 1.35, 0, t.z), rot: Math.PI / 2 };
    await this.walk(a, [new THREE.Vector3(spot.p.x, 0, LANE), spot.p]);
    a.targetRot = spot.rot;
    this.setState(a, "work");
  }

  private standUp(a: Agent, rot?: number) {
    a.sitting = false;
    if (rot !== undefined) a.targetRot = rot;
  }

  private carry(a: Agent, kind: "box" | "paper" | null) {
    if (a.carrying) a.root.remove(a.carrying);
    a.carrying = kind === "box" ? this.box(0.5, 0.36, 0.45, "#d8ae6c", a.root, 0, 2.15, 0) : kind === "paper" ? this.box(0.32, 0.02, 0.24, "#ffffff", a.root, 0, 1.2, 0.45) : null;
  }

  private headPos(a: Agent) {
    return a.root.position.clone().add(new THREE.Vector3(0, 1.9, 0));
  }

  private flyPlane(from: THREE.Vector3, to: THREE.Vector3, dur = 1100) {
    return new Promise<void>((res) => {
      if (this.reduced || this.disposed) return res();
      const m = this.mesh(new THREE.ConeGeometry(0.14, 0.45, 3), this.mat("#ffffff", { emissive: "#bfe6ff", emissiveIntensity: 0.4 }), this.scene, from.x, from.y, from.z);
      this.planes.push({ m, from: from.clone(), to: to.clone(), t: 0, dur, res });
    });
  }

  private bindControls() {
    const s = this.stage;
    s.addEventListener("pointerdown", (e) => {
      if ((e.target as HTMLElement).closest("button")) return;
      this.drag = { x: e.clientX, y: e.clientY };
      s.setPointerCapture(e.pointerId);
    });
    s.addEventListener("pointermove", (e) => {
      if (!this.drag) return;
      this.goal.theta -= (e.clientX - this.drag.x) * 0.008;
      this.goal.phi = Math.min(1.3, Math.max(0.02, this.goal.phi - (e.clientY - this.drag.y) * 0.006));
      this.drag = { x: e.clientX, y: e.clientY };
    });
    s.addEventListener("pointerup", () => (this.drag = null));
    s.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        this.zoom(e.deltaY * 0.02);
      },
      { passive: false },
    );
  }

  private resize() {
    const w = this.stage.clientWidth;
    const h = this.stage.clientHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.goal.r = Math.max(this.goal.r, w < 560 ? 42 : 26);
    this.camera.updateProjectionMatrix();
  }

  private tick = () => {
    if (this.disposed) return;
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.elapsedTime;
    for (const k of ["theta", "phi", "r"] as const) this.orbit[k] += (this.goal[k] - this.orbit[k]) * Math.min(1, dt * 5);
    const { theta, phi, r } = this.orbit;
    this.camera.position.set(this.target.x + r * Math.sin(phi) * Math.sin(theta), r * Math.cos(phi), this.target.z + r * Math.sin(phi) * Math.cos(theta));
    this.camera.lookAt(this.target);

    const w = this.stage.clientWidth;
    const h = this.stage.clientHeight;
    for (const a of Object.values(this.agents)) {
      if (a.path.length) {
        const next = a.path[0];
        const d = next.clone().sub(a.pos);
        d.y = 0;
        const dist = d.length();
        const step = (a.robot ? 3.2 : 2.7) * dt;
        if (dist <= step) {
          a.pos.copy(next);
          a.path.shift();
          if (!a.path.length && a.resolve) {
            const res = a.resolve;
            a.resolve = null;
            this.setState(a, "work");
            res();
          }
        } else {
          a.pos.add(d.multiplyScalar(step / dist));
          a.targetRot = Math.atan2(next.x - a.pos.x, next.z - a.pos.z);
        }
      }
      let dr = a.targetRot - a.rot;
      dr = Math.atan2(Math.sin(dr), Math.cos(dr));
      a.rot += dr * Math.min(1, dt * 9);
      a.root.position.set(a.pos.x, 0, a.pos.z);
      a.root.rotation.y = a.rot;

      const moving = a.path.length > 0;
      const sit = a.sitting && !moving;
      const sw = moving ? Math.sin(t * 10 + a.phase) : 0;
      a.body.position.y = sit ? -0.16 : moving ? Math.abs(sw) * 0.05 : 0;
      a.legs.forEach((l, i) => (l.rotation.x = sit ? -Math.PI / 2 : sw * 0.6 * (i ? -1 : 1)));
      const boxOverHead = a.carrying && (a.carrying.geometry as THREE.BoxGeometry).parameters.height > 0.1;
      a.arms.forEach((arm, i) => {
        if (boxOverHead) arm.rotation.x = -2.9;
        else if (a.carrying) arm.rotation.x = i ? -1.2 : sw * 0.4;
        else if (sit) arm.rotation.x = -1.15 + Math.sin(t * 16 + a.phase + i * 1.6) * (this.reduced ? 0 : 0.09);
        else arm.rotation.x = moving ? -sw * 0.5 * (i ? -1 : 1) : 0;
      });
      a.head.rotation.y = sit ? Math.sin(t * 0.7 + a.phase) * 0.25 : 0;
      if (a.antenna) (a.antenna.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.5 + Math.abs(Math.sin(t * 3));
      const wl = this.workLights[a.id];
      wl.light.intensity = sit ? 2.4 + Math.sin(t * 7 + a.phase) * 0.3 : 0;
      (wl.logo.material as THREE.MeshStandardMaterial).emissiveIntensity = sit ? 1 : 0;

      this.proj.set(a.pos.x, 2.45 + (a.carrying ? 0.4 : 0), a.pos.z).project(this.camera);
      const x = ((this.proj.x + 1) / 2) * w;
      const y = ((1 - this.proj.y) / 2) * h;
      a.tagEl.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
      a.tagEl.style.display = this.proj.z < 1 ? "" : "none";
      a.sayEl.style.left = `${x}px`;
      a.sayEl.style.top = `${y - 36}px`;
      if (performance.now() > a.sayUntil) a.sayEl.classList.remove("show");
    }
    this.leds.forEach((l, i) => ((l.material as THREE.MeshStandardMaterial).emissiveIntensity = Math.sin(t * 6 + i * 1.3) > 0 ? 1.2 : 0.15));
    this.printer.position.x = -10.2 + (performance.now() < this.printingUntil ? Math.sin(t * 60) * 0.03 : 0);

    for (let i = this.planes.length - 1; i >= 0; i--) {
      const p = this.planes[i];
      p.t = Math.min(1, p.t + (dt * 1000) / p.dur);
      const s = p.t;
      const mid = p.from.clone().lerp(p.to, 0.5);
      mid.y += 2.4;
      const a1 = p.from.clone().lerp(mid, s);
      const a2 = mid.clone().lerp(p.to, s);
      const pos = a1.lerp(a2, s);
      p.m.lookAt(pos);
      p.m.position.copy(pos);
      p.m.rotateX(Math.PI / 2);
      if (p.t >= 1) {
        this.scene.remove(p.m);
        this.planes.splice(i, 1);
        p.res();
      }
    }
    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.tick);
  };
}
