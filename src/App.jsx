// ============================================================
// src/App.jsx
// React UI 루트 컴포넌트
//
// 책임:
//   - uiStore.currentScene 구독 → 씬별 HUD / Screen 렌더링
//   - SceneManager(prop) 에 전환 요청 브리지
//   - 전투 결과(ResultScreen), 게임오버, 부활 프롬프트 처리
//   - SyncManager 초기화 후 WorldMapScene / BattleScene 에 주입
//
// 파일 경로 패턴:
//   Three.js 씬 접근:  sceneManager.scenes['worldmap'] 등
//   store 접근:        useUiStore, useGameStore, usePlayerStore 훅
// ============================================================

import React, { useEffect, useRef } from 'react';

// ── 스토어 ────────────────────────────────────────────────
import { useUiStore }     from './stores/uiStore.js';
import { useGameStore }   from './stores/gameStore.js';
import { usePlayerStore } from './stores/playerStore.js';

// ── 네트워크 ──────────────────────────────────────────────
import { PeerManager }  from './network/PeerManager.js';
import { HostManager }  from './network/HostManager.js';
import { SyncManager }  from './network/SyncManager.js';

// ── UI 스크린 (씬 전체 오버레이) ─────────────────────────
import { MainMenuScreen }  from './ui/screens/MainMenuScreen.jsx';
import { LobbyScreen }     from './ui/screens/LobbyScreen.jsx';
import { ResultScreen }    from './ui/screens/ResultScreen.jsx';

// ── HUD 컴포넌트 ──────────────────────────────────────────
import { HPBar }       from './ui/hud/HPBar.jsx';
import { HandUI }      from './ui/hud/HandUI.jsx';
import { WorldHUD }    from './ui/hud/WorldHUD.jsx';
import { TokenRollUI } from './ui/hud/TokenRollUI.jsx';
import { InventoryUI } from './ui/hud/InventoryUI.jsx';

// ── 공통 모달 ──────────────────────────────────────────────
import { Modal, Button }          from './ui/common/Modal.jsx';
import { CharacterSelectScreen }  from './ui/screens/CharacterSelectScreen.jsx';
import { ShopUI }                 from './ui/common/ShopUI.jsx';
import { CharacterStatUI }        from './ui/common/CharacterStatUI.jsx';
import { QuestUI }                from './ui/common/QuestUI.jsx';
import { RandomEventModal }       from './ui/common/RandomEventModal.jsx';
import { QuestInteractionModal }  from './ui/common/QuestInteractionModal.jsx';

// ── 씬 상수 ───────────────────────────────────────────────
const SCENE = {
  MAIN_MENU:        'MAIN_MENU',
  LOBBY:            'LOBBY',
  CHARACTER_SELECT: 'CHARACTER_SELECT',
  WORLD_MAP:        'WORLD_MAP',
  BATTLE:           'BATTLE',
  DUNGEON:          'DUNGEON',
  RESULT:           'RESULT',
};

// ============================================================
export default function App({ sceneManager }) {
  // ── 씬 상태 구독 ────────────────────────────────────────
  const currentScene = useUiStore((s) => s.currentScene);

  // ── 전투/UI 상태 구독 ───────────────────────────────────
  const isMyTurn         = useUiStore((s) => s.isMyTurn);
  const lobbyPlayers     = useUiStore((s) => s.lobbyPlayers);
  const pendingNickname  = useUiStore((s) => s.pendingNickname);
  const myTurnPlayerId   = useUiStore((s) => s.myTurnPlayerId);
  const localPlayerId    = usePlayerStore((s) => s.localPlayerId);
  const isRolling     = useUiStore((s) => s.isRolling);
  const resultPayload = useUiStore((s) => s.resultPayload);
  const gameOverReason= useUiStore((s) => s.gameOverReason);
  const showingRevive = useUiStore((s) => s.showingRevivePrompt);
  const inventoryOpen        = useUiStore((s) => s.inventoryOpen);
  const villagePayload       = useUiStore((s) => s.villagePayload);
  const characterOpen        = useUiStore((s) => s.characterOpen);
  const questOpen            = useUiStore((s) => s.questOpen);
  const randomEventPayload   = useUiStore((s) => s.randomEventPayload);
  const questInteractionPayload = useUiStore((s) => s.questInteractionPayload);
  const toasts               = useUiStore((s) => s.toasts);

  // ── 네트워크 인스턴스 (앱 전체 싱글턴) ─────────────────
  const peerRef = useRef(null);
  const hostRef = useRef(null);
  const syncRef = useRef(null);

  useEffect(() => {
    // PeerManager / HostManager / SyncManager 한 번만 초기화
    peerRef.current = new PeerManager();
    hostRef.current = new HostManager(peerRef.current);
    syncRef.current = new SyncManager(peerRef.current, hostRef.current);

    // 씬에 SyncManager 주입
    const wm = sceneManager.scenes['worldmap'];
    const bt = sceneManager.scenes['battle'];
    if (wm?.setSyncManager) wm.setSyncManager(syncRef.current);
    if (bt?.setSyncManager) bt.setSyncManager(syncRef.current);
  }, [sceneManager]);

  // ── 씬 전환 헬퍼 ───────────────────────────────────────
  const goTo = (key, payload) => sceneManager.goTo(key.toLowerCase().replace('_', ''), payload);

  // ── 전투 종료 후 복귀 ───────────────────────────────────
  const handleContinue = ({ nickname } = {}) => {
    if (nickname?.trim()) useUiStore.getState().setPendingNickname?.(nickname.trim());
    useUiStore.getState().clearResult?.();
    const returnTo = useGameStore.getState().pendingReturnTo ?? 'worldmap';
    useGameStore.getState().clearPendingReturnTo?.();
    sceneManager.goTo(returnTo);
  };

  const handleGameRestart = () => {
    useUiStore.getState().clearGameOver();
    useUiStore.getState().clearResult();
    sceneManager.goTo('mainmenu');
  };

  // ── 부활 스크롤 사용 ────────────────────────────────────
  const handleRevive = () => {
    useUiStore.getState().hideRevivePrompt();
    // 가장 최근 사망 플레이어 부활 처리는 CombatEngine에서
    const bt = sceneManager.scenes['battle'];
    bt?._combatEngine?.reviveWithScroll?.();
    bt?._processTurn?.();
  };

  // ── 인벤토리 BattleScene 연결 ───────────────────────────
  const handleUseCard = (instanceId, targetId) => {
    sceneManager.scenes['battle']?.useCard?.(instanceId, targetId);
  };
  const handleRegisterPassive = (instanceId) => {
    sceneManager.scenes['battle']?.registerPassive?.(instanceId);
  };
  const handleEndTurn = () => {
    sceneManager.scenes['battle']?.endPlayerTurn?.();
  };
  const handleEndWorldTurn = () => {
    sceneManager.scenes['worldmap']?.endWorldTurn?.();
  };

  // ============================================================
  // 렌더
  // ============================================================
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>

      {/* ── 씬별 전체화면 스크린 ────────────────────────── */}
      {currentScene === SCENE.MAIN_MENU && (
        <FullScreen>
          <MainMenuScreen
            onNewGame={({ nickname } = {}) => {
              const name = nickname?.trim() || '모험가';
              useUiStore.getState().setPendingNickname?.(name);
              useUiStore.getState().setLobbyPlayers([{
                peerId: peerRef.current?.id ?? 'host',
                playerName: name,
                ready: false,
                isHost: true,
              }]);
              useUiStore.getState().goToScene(SCENE.LOBBY);
            }}
            onJoinGame={({ nickname, code } = {}) => {
              const name = nickname?.trim() || '모험가';
              useUiStore.getState().setPendingNickname?.(name);
              useUiStore.getState().setLobbyCode?.(code ?? '');
              useUiStore.getState().setLobbyPlayers([{
                peerId: peerRef.current?.id ?? 'host',
                playerName: name,
                ready: false,
                isHost: true,
              }]);
              useUiStore.getState().goToScene(SCENE.LOBBY);
            }}
          />
        </FullScreen>
      )}

      {currentScene === SCENE.LOBBY && (
        <FullScreen>
          <LobbyScreen
            mode="new"
            joinCode={useUiStore.getState().lobbyCode || null}
            lobbyList={lobbyPlayers}
            myPeerId={peerRef.current?.id ?? 'host'}
            isHost={true}
            initialNickname={pendingNickname}
            onReady={(charData) => {
              if (!charData) {
                // 준비 취소 — 자신 슬롯을 ready:false로 되돌림
                const pid = peerRef.current?.id ?? 'host';
                useUiStore.getState().updateLobbyPlayer(pid, { ready: false, classType: null, finalStats: null });
                return;
              }
              // 1. 플레이어 초기화
              usePlayerStore.getState().initPlayers([charData]);
              // 2. lobbyPlayers 슬롯 갱신 (ready:true + finalStats 저장)
              const pid = peerRef.current?.id ?? 'host';
              useUiStore.getState().updateLobbyPlayer(pid, {
                playerName: charData.name,
                classType:  charData.classType,
                finalStats: charData.finalStats ?? {},
                ready:      true,
              });
            }}
            onStartGame={() => sceneManager.goTo('worldmap', { newGame: true })}
            onLeave={() => {
              useUiStore.getState().setLobbyPlayers([]);
              useUiStore.getState().goToScene(SCENE.MAIN_MENU);
            }}
          />
        </FullScreen>
      )}

      {/* ── G-1: 캐릭터 선택 (GDD §4.3) ────────────────── */}
      {currentScene === SCENE.CHARACTER_SELECT && (
        <FullScreen>
          <CharacterSelectScreen
            playerId={peerRef.current?.id ?? 'p1'}
            takenChars={usePlayerStore.getState().players.map((p) => p.name)}
            onConfirm={(charData) => {
              usePlayerStore.getState().initPlayers([charData]);
              sceneManager.goTo('worldmap', { newGame: true });
            }}
            onCancel={() => useUiStore.getState().goToScene(SCENE.LOBBY)}
          />
        </FullScreen>
      )}

      {/* ── 월드맵 HUD ──────────────────────────────────── */}
      {currentScene === SCENE.WORLD_MAP && (
        <>
          <HPBar />
          <WorldHUD onEndTurn={handleEndWorldTurn} />
          {inventoryOpen && (
            <HUDOverlay>
              <InventoryUI playerId={localPlayerId} onClose={() => useUiStore.getState().closeInventory()} />
            </HUDOverlay>
          )}
          {/* G-2: 마을 ShopUI (GDD §21) */}
          {villagePayload && (
            <HUDOverlay>
              <ShopUI
                village={villagePayload}
                onClose={() => useUiStore.getState().closeVillage?.()}
              />
            </HUDOverlay>
          )}
          {/* G-3: 캐릭터 정보 패널 (GDD §6) */}
          {characterOpen && (
            <HUDOverlay>
              <CharacterStatUI
                onClose={() => useUiStore.getState().closeCharacter?.()}
              />
            </HUDOverlay>
          )}
          {/* G-4: 퀘스트 패널 (GDD §25) */}
          {questOpen && (
            <HUDOverlay>
              <QuestUI
                onClose={() => useUiStore.getState().closeQuest?.()}
              />
            </HUDOverlay>
          )}
        </>
      )}

      {/* ── 전투 HUD ────────────────────────────────────── */}
      {currentScene === SCENE.BATTLE && (
        <>
          <HPBar />
          {isMyTurn && (
            <HandUI
              playerId={myTurnPlayerId ?? localPlayerId}
              isMyTurn={isMyTurn}
              onUseCard={handleUseCard}
              onRegisterPassive={handleRegisterPassive}
              onEndTurn={handleEndTurn}
            />
          )}
          {isRolling && <TokenRollUI />}
          {inventoryOpen && (
            <HUDOverlay>
              <InventoryUI playerId={localPlayerId} onClose={() => useUiStore.getState().closeInventory()} />
            </HUDOverlay>
          )}
        </>
      )}

      {/* ── 던전 HUD ────────────────────────────────────── */}
      {currentScene === SCENE.DUNGEON && (
        <>
          <HPBar />
          {inventoryOpen && (
            <HUDOverlay>
              <InventoryUI playerId={localPlayerId} onClose={() => useUiStore.getState().closeInventory()} />
            </HUDOverlay>
          )}
        </>
      )}

      {/* ── 전투 결과 모달 (씬 무관) ────────────────────── */}
      {resultPayload && (
        <FullScreen style={{ background: 'rgba(0,0,0,0.75)' }}>
          <ResultScreen
            result={resultPayload.result}
            rewards={resultPayload.rewards}
            reason={resultPayload.reason}
            onContinue={handleContinue}
            onRetry={handleGameRestart}
            onMainMenu={handleGameRestart}
          />
        </FullScreen>
      )}

      {/* ── 게임오버 (드래곤이 성 점령 등) ─────────────── */}
      {gameOverReason && !resultPayload && (
        <FullScreen style={{ background: 'rgba(0,0,0,0.85)' }}>
          <div style={styles.centeredBox}>
            <h1 style={{ color: '#e03020', fontSize: 48, marginBottom: 16 }}>GAME OVER</h1>
            <p style={{ color: '#c0a080', fontSize: 18, marginBottom: 32 }}>{gameOverReason}</p>
            <Button variant="danger" onClick={handleGameRestart}>메인 메뉴로</Button>
          </div>
        </FullScreen>
      )}

      {/* ── 부활 스크롤 프롬프트 ────────────────────────── */}
      {showingRevive && (
        <FullScreen style={{ background: 'rgba(0,0,0,0.7)' }}>
          <Modal
            title="전멸 위기"
            onClose={() => useUiStore.getState().hideRevivePrompt()}
          >
            <p style={{ color: '#c0a080', marginBottom: 24 }}>
              부활 스크롤을 사용하겠습니까?
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <Button variant="primary" onClick={handleRevive}>사용</Button>
              <Button variant="danger" onClick={() => {
                useUiStore.getState().hideRevivePrompt();
                useUiStore.getState().showResult({ result: 'GAME_OVER', reason: '파티가 전멸했습니다.' });
              }}>포기</Button>
            </div>
          </Modal>
        </FullScreen>
      )}

      {/* ── G-5: 랜덤 이벤트 모달 — 씬 무관 (GDD §18.6) ── */}
      {randomEventPayload && (
        <FullScreen style={{ background: 'rgba(0,0,0,0.7)' }}>
          <RandomEventModal
            event={randomEventPayload}
            onClose={() => useUiStore.getState().clearRandomEvent?.()}
          />
        </FullScreen>
      )}

      {/* ── G-6: 퀘스트 상호작용 모달 — 씬 무관 (GDD §25) ─ */}
      {questInteractionPayload && (
        <FullScreen style={{ background: 'rgba(0,0,0,0.7)' }}>
          <QuestInteractionModal
            quest={questInteractionPayload}
            onClose={() => useUiStore.getState().clearQuestInteraction?.()}
          />
        </FullScreen>
      )}

      {/* ── 토스트 알림 ─────────────────────────────────── */}
      <ToastLayer toasts={toasts} />
    </div>
  );
}

// ── 레이아웃 헬퍼 컴포넌트 ──────────────────────────────────
function FullScreen({ children, style }) {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      pointerEvents: 'auto',
      ...style,
    }}>
      {children}
    </div>
  );
}

function HUDOverlay({ children }) {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.55)',
      pointerEvents: 'auto',
      zIndex: 50,
    }}>
      {children}
    </div>
  );
}

// ── 토스트 컴포넌트 ─────────────────────────────────────────
function ToastLayer({ toasts }) {
  if (!toasts?.length) return null;
  return (
    <div style={{
      position: 'absolute', bottom: 100, left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex', flexDirection: 'column', gap: 8,
      pointerEvents: 'none',
      zIndex: 200,
    }}>
      {toasts.map((t) => (
        <div key={t.id} style={{
          background: t.type === 'error' ? 'rgba(160,30,20,0.92)'
                    : t.type === 'warn'  ? 'rgba(160,120,10,0.92)'
                    :                      'rgba(20,18,30,0.92)',
          border: '1px solid rgba(200,170,80,0.4)',
          borderRadius: 8,
          padding: '10px 20px',
          color: '#e8dfc8',
          fontSize: 14,
          whiteSpace: 'nowrap',
          boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
        }}>
          {t.message}
        </div>
      ))}
    </div>
  );
}

const styles = {
  centeredBox: {
    position: 'absolute', inset: 0,
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    textAlign: 'center',
    padding: 32,
  },
};