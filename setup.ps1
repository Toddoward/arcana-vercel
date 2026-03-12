# arcana-vercel 폴더 안에서 실행하세요
# PowerShell에서 해당 폴더로 이동 후: cd arcana-vercel

$files = @(
    "public/assets/models/.gitkeep",
    "public/assets/textures/.gitkeep",
    "public/assets/audio/.gitkeep",

    "src/main.jsx",
    "src/App.jsx",

    "src/constants/constants.js",

    "src/stores/gameStore.js",
    "src/stores/playerStore.js",
    "src/stores/uiStore.js",

    "src/engine/SceneManager.js",
    "src/engine/AudioManager.js",
    "src/engine/AssetManager.js",
    "src/engine/scenes/MainMenuScene.js",
    "src/engine/scenes/WorldMapScene.js",
    "src/engine/scenes/BattleScene.js",
    "src/engine/scenes/DungeonScene.js",
    "src/engine/primitives/CharacterMesh.js",
    "src/engine/primitives/MonsterMesh.js",
    "src/engine/primitives/TileMesh.js",
    "src/engine/primitives/ItemMesh.js",

    "src/game/world/HexGrid.js",
    "src/game/world/WorldGenerator.js",
    "src/game/world/DragonAI.js",
    "src/game/battle/Initiative.js",
    "src/game/battle/CombatEngine.js",
    "src/game/battle/TokenRoll.js",
    "src/game/battle/EnemyAI.js",
    "src/game/deck/DeckBuilder.js",
    "src/game/deck/CardEffect.js",
    "src/game/deck/PassiveManager.js",
    "src/game/data/cards.js",
    "src/game/data/items.js",
    "src/game/data/enemies.js",
    "src/game/data/quests.js",

    "src/network/PeerManager.js",
    "src/network/HostManager.js",
    "src/network/SyncManager.js",

    "src/ui/screens/MainMenuScreen.jsx",
    "src/ui/screens/LobbyScreen.jsx",
    "src/ui/screens/CharacterSelectScreen.jsx",
    "src/ui/screens/ResultScreen.jsx",
    "src/ui/hud/HPBar.jsx",
    "src/ui/hud/HandUI.jsx",
    "src/ui/hud/CardUI.jsx",
    "src/ui/hud/InventoryUI.jsx",
    "src/ui/hud/TokenRollUI.jsx",
    "src/ui/hud/WorldHUD.jsx",
    "src/ui/common/Modal.jsx",
    "src/ui/common/Button.jsx",
    "src/ui/common/ShopUI.jsx",

    "api/signal.js",

    "index.html",
    "vite.config.js",
    "vercel.json"
)

foreach ($file in $files) {
    $dir = Split-Path $file -Parent
    if ($dir -and !(Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    if (!(Test-Path $file)) {
        New-Item -ItemType File -Path $file -Force | Out-Null
    }
}

Write-Host "✅ Project structure created!" -ForegroundColor Green