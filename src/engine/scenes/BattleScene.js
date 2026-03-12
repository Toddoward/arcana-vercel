// ============================================================
// src/engine/scenes/BattleScene.js
// 전투 씬 — 파티 등 뒤 3인칭 시점, Front/Back 포지션 배치
// ============================================================
import * as THREE from 'three';
import { BaseScene } from '../SceneManager.js';
import { assetManager } from '../AssetManager.js';
import { POSITION, COLOR } from '../../constants/constants.js';

// ── 포지션별 Z 좌표 ──────────────────────────────────────────
const POSITION_Z = {
  [POSITION.FRONT]: -1.5,
  [POSITION.BACK]:  -3.5,
};

// ── 슬롯 X 좌표 (최대 4인) ────────────────────────────────
const ALLY_X_SLOTS  = [-2.25, -0.75,  0.75, 2.25];
const ENEMY_X_SLOTS = [-2.25, -0.75,  0.75, 2.25];

export class BattleScene extends BaseScene {
  constructor(sm) {
    super(sm);
    this._allyMeshes   = {};  // { playerId: THREE.Group }
    this._enemyMeshes  = {};  // { enemyId:  THREE.Mesh  }
    this._cameraTarget = new THREE.Vector3(0, 1, -2);
  }

  // ── 초기화 (1회) ─────────────────────────────────────────
  init() {
    // 카메라: 파티 등 뒤 3인칭
    this.camera = new THREE.PerspectiveCamera(
      55,
      window.innerWidth / window.innerHeight,
      0.1,
      100,
    );
    this.camera.position.set(0, 3, 5);
    this.camera.lookAt(this._cameraTarget);

    // 조명
    this.scene.add(new THREE.AmbientLight(0x201828, 3.0));
    const dirLight = new THREE.DirectionalLight(0xfff0d0, 1.5);
    dirLight.position.set(5, 10, 5);
    dirLight.castShadow = true;
    this.scene.add(dirLight);

    const rimLight = new THREE.PointLight(0x4020a0, 2.0, 20);
    rimLight.position.set(-5, 4, -5);
    this.scene.add(rimLight);

    // 바닥
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      new THREE.MeshStandardMaterial({
        color:     0x0e0c14,
        roughness: 0.95,
        metalness: 0.0,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Front / Back 구분선
    const divider = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 0.03),
      new THREE.MeshBasicMaterial({
        color:       0x3a3050,
        transparent: true,
        opacity:     0.6,
        depthWrite:  false,
      }),
    );
    divider.rotation.x = -Math.PI / 2;
    divider.position.set(0, 0.01, -2.5);
    this.scene.add(divider);

    // 배경
    this.scene.background = new THREE.Color(0x0a0810);
    this.scene.fog = new THREE.Fog(0x0a0810, 15, 30);
  }

  // ── 씬 진입 ──────────────────────────────────────────────
  onEnter(payload = {}) {
    const { allies = [], enemies = [] } = payload;
    this._spawnAllies(allies);
    this._spawnEnemies(enemies);
  }

  // ── 씬 퇴장 ──────────────────────────────────────────────
  onExit() {
    Object.values(this._allyMeshes).forEach((m)  => this.scene.remove(m));
    Object.values(this._enemyMeshes).forEach((m) => this.scene.remove(m));
    this._allyMeshes  = {};
    this._enemyMeshes = {};
  }

  // ── 아군 메시 생성 ────────────────────────────────────────
  _spawnAllies(allies) {
    Object.values(this._allyMeshes).forEach((m) => this.scene.remove(m));
    this._allyMeshes = {};

    allies.forEach((player, i) => {
      const color  = COLOR[player.classType] ?? 0xc9a84c;
      const group  = assetManager.createCharacterMesh(color);
      const posX   = ALLY_X_SLOTS[i] ?? 0;
      const posZ   = POSITION_Z[player.position] ?? POSITION_Z[POSITION.FRONT];

      group.position.set(posX, 0, posZ);
      group.rotation.y = 0;
      group.userData   = { playerId: player.id };

      this.scene.add(group);
      this._allyMeshes[player.id] = group;
    });
  }

  // ── 적 메시 생성 ──────────────────────────────────────────
  _spawnEnemies(enemies) {
    Object.values(this._enemyMeshes).forEach((m) => this.scene.remove(m));
    this._enemyMeshes = {};

    enemies.forEach((enemy, i) => {
      const mesh = assetManager.createMonsterMesh(enemy.template ?? 'MEDIUM');
      const posX = ENEMY_X_SLOTS[i] ?? 0;
      const posZ = enemy.position === POSITION.BACK ? -10 : -8;

      mesh.position.set(posX, 0.5, posZ);
      mesh.rotation.y = Math.PI;
      mesh.userData   = { enemyId: enemy.id };

      this.scene.add(mesh);
      this._enemyMeshes[enemy.id] = mesh;
    });
  }

  // ── 퍼블릭 메서드 ─────────────────────────────────────────

  // 현재 행동 캐릭터 등 뒤로 카메라 이동
  moveCameraToPlayer(playerId) {
    const mesh = this._allyMeshes[playerId];
    if (!mesh) return;
    this._cameraTarget.set(mesh.position.x, 1.2, mesh.position.z);
  }

  // 포지션 전환 시 메시 위치 갱신
  updateAllyPosition(playerId, newPosition) {
    const mesh = this._allyMeshes[playerId];
    if (!mesh) return;
    mesh.position.z = POSITION_Z[newPosition] ?? POSITION_Z[POSITION.FRONT];
  }

  // 드래곤 컷씬 (추후 구현)
  startDragonCutscene(dragonWorldPos, onComplete) {
    if (typeof onComplete === 'function') onComplete();
  }

  // ── 매 프레임 ─────────────────────────────────────────────
  update(delta) {
    // 카메라 부드러운 추적
    this.camera.position.lerp(
      new THREE.Vector3(
        this._cameraTarget.x,
        this._cameraTarget.y + 3,
        this._cameraTarget.z + 5,
      ),
      delta * 3,
    );
    this.camera.lookAt(this._cameraTarget);

    // MAGIC 타입 적 부유 애니메이션
    const t = Date.now() * 0.002;
    Object.values(this._enemyMeshes).forEach((mesh) => {
      if (mesh.userData.template === 'MAGIC') {
        mesh.position.y = 0.5 + Math.sin(t) * 0.15;
      }
    });
  }

  // ── 해제 ──────────────────────────────────────────────────
  dispose() {
    this.onExit();
    super.dispose();
  }
}