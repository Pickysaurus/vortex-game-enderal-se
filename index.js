const { util } = require('vortex-api');
const path = require('path');

const GAME_ID = 'enderalspecialedition';
const STEAMAPP_ID = '976620';

// Files needed for Enderal to run correctly.
const requiredFiles = [
    'SkyrimSE.exe',
    'skse64_loader.exe',
    'Enderal Launcher.exe',
    path.join('Data', 'Enderal - Forgotten Stories.esm'),
    path.join('Data', 'Skyrim.esm'),
    path.join('Data', 'SkyUI_SE.esp'),
    path.join('Data', 'SKSE', 'Plugins', 'JContainers64.dll'),
    path.join('Data', 'SKSE', 'Plugins', 'FlatMapMarkersSSE.dll'),
];

const tools = [
    {
        id: 'skse64-enderal',
        name: 'Skyrim Script Extender 64',
        shortName: 'SKSE64',
        executable: () => 'skse64_loader.exe',
        requiredFiles: [
            'skse64_loader.exe',
            'SkyrimSE.exe',
        ],
        relative: true,
        exclusive: true,
        defaultPrimary: true,
    },
    {
        id: 'enderal-se-launcher',
        name: 'Launcher',
        executable: () => 'Enderal Launcher.exe',
        requiredFiles: [
            'Enderal Launcher.exe' 
        ],
        relative: true,
        exclusive: true
    }
];

const gamebyroData = (api) => {
    const state = api.store.getState();
    const gamePath = util.getSafe(state, ['settings', 'gameMode', 'discovered', 'enderalspecialedition', 'path'], undefined);
    if (!gamePath) return undefined;
    const skyrimInstall = gamePath.toLowerCase().includes('skyrim');
    
    // gamebyro-plugin-management data
    const pluginData = {
        appDataPath: skyrimInstall ? 'Skyrim Special Edition' : 'Enderal Special Edition',
        pluginTXTFormat: 'fallout4',
        nativePlugins: [
            'skyrim.esm',
            'update.esm',
            'dawnguard.esm',
            'hearthfires.esm',
            'dragonborn.esm',
        ]
    }

    // gamebyro-savegame-management data
    const saveData = {
        mygamesPath: skyrimInstall ? 'Skyrim Special Edition' : 'Enderal Special Edition',
        iniName: skyrimInstall ? 'Skyrim.ini' : 'Enderal.ini',
        prefIniName: skyrimInstall ? 'SkyrimPrefs.ini' : 'EnderalPrefs.ini',
        saveFiles: (input) => {
            const coSaveExt = 'skse';
            return input.reduce((cur, prev) => {
                const ext = path.extname(cur);
                const coSave = `${path.basename(cur, ext)}.${coSaveExt}`;
                prev.push([save, coSave]);
                return prev;
            }, []);
        }
    }
    return { pluginData, saveData };
}

function findGame() {
    return util.GameStoreHelper.findByAppId([STEAMAPP_ID])
        .then(game => game.gamePath);
}

function prepareForModding(discovery, api) {
    // console.log(gamebyroData(api));
    const state = api.store.getState();

    const enderalPath = discovery.path;
    const ssePath = util.getSafe(state, ['settings', 'gameMode', 'discovered', 'skyrimse', 'path'], undefined);

    if (ssePath && pathCompare(enderalPath, ssePath)) {
        return Promise.reject('Vortex can only manage Enderal Special Edition when installed via Steam. To use the non-Steam version, please create a profile for Skyrim Special Edition');
    }
    else return Promise.resolve(); 
}

function main(context) {
    // We need Vortex 1.4.3+
    context.requireVersion('^1.4.3');

    context.registerGame({
        id: GAME_ID,
        name: 'Enderal Special Edition',
        supportedTools: tools,
        shortName: 'Enderal SE',
        mergeMods: true,
        queryPath: findGame,
        setup: (discovery) => prepareForModding(discovery, context.api),
        queryModPath: () => 'data',
        logo: 'gameart.jpg',
        executable: () => 'SkyrimSE.exe',
        requiredFiles: requiredFiles,
        compatible: {
            symlinks: false
        },
        details: {
            steamAppId: STEAMAPP_ID
        }
    });

    return true;

}

function pathCompare(enderal, sse) {
    // Check if the Enderal and SSE paths are the same, if they are we want to reject the game setup.
    const e = enderal.toLowerCase();
    const s = sse.toLowerCase();
    if (e == s) return true;
    else if (e.includes(s) || s.includes(e)) return true;
    else return false;
}

module.exports = {
    default: main
};