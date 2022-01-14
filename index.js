const { fs, log, selectors, util } = require('vortex-api');
const { getFileVersion, getFileVersionLocalized } = require('exe-version');
const path = require('path');

const GAME_ID = 'enderalspecialedition';
const STEAMAPP_ID = '976620';

const ENDERAL_ESM = 'Enderal - Forgotten Stories.esm';
const SKYUI_ESP = 'SkyUI_SE.esp';

// Files needed for Enderal to run correctly.
// const requiredFiles = [
//     'SkyrimSE.exe',
//     'skse64_loader.exe',
//     'Enderal Launcher.exe',
//     path.join('Data', 'Enderal - Forgotten Stories.esm'),
//     path.join('Data', 'Skyrim.esm'),
//     path.join('Data', 'SkyUI_SE.esp'),
//     path.join('Data', 'SKSE', 'Plugins', 'JContainers64.dll'),
//     path.join('Data', 'SKSE', 'Plugins', 'FlatMapMarkersSSE.dll'),
// ];

const fileChecks = {
    'skse64_loader.exe': {
        relPath: 'skse64_loader.exe',
        url: 'https://skse.silverlock.org/',
        name: 'Skyrim Script Extender 64 (Current SE Build 2.0.19+)'
    },
    'Enderal - Forgotten Stories.esm': {
        relPath: path.join('Data', 'Enderal - Forgotten Stories.esm'),
        url: 'https://www.nexusmods.com/enderalspecialedition/mods/1',
        name: 'Enderal Special Edition'
    },
    'SkyUI_SE.esp': {
        relPath: path.join('Data', 'SkyUI_SE.esp'),
        url: 'https://www.nexusmods.com/skyrimspecialedition/mods/12604',
        name: 'SkyUI Special Edition'
    },
    'JContainers64.dll': {
        relPath: path.join('Data', 'SKSE', 'Plugins', 'JContainers64.dll'),
        url: 'https://www.nexusmods.com/skyrimspecialedition/mods/16495',
        name: 'JContainers64'
    },
    'FlatMapMarkersSSE.dll': {
        relPath: path.join('Data', 'SKSE', 'Plugins', 'FlatMapMarkersSSE.dll'),
        url: 'https://www.nexusmods.com/skyrimspecialedition/mods/22122',
        name: 'FlatMapMarkers'
    }
}

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
        logo: 'launcher-icon.png',
        relative: true,
        exclusive: true
    }
];

function findGame() {
    return util.GameStoreHelper.findByAppId([STEAMAPP_ID])
        .then(game => game.gamePath);
}

function missingModsModal(api, missingDependencies, dismiss) {
    api.showDialog('warn', 'Enderal Dependencies Missing', {
        bbcode: 'Enderal Special Edition requires several mods to be installed before it will work correctly. Vortex detected the following mods as missing: <br /><br />'+
        missingDependencies.map(mod => `- [url=${mod.url}]${mod.name}[/url]<br />`).join('<br/>')+
        '<br /><br />You will not be able to start playing Enderal until these mods have been installed.'
    },[
        {
            label: 'Check again',
            action: () => testMissingMods(api, undefined),
        },
        {
            label: 'Close',
            action: () => dismiss(),
        }
    ])
}

function testMandatoryPlugins(api) {
    // Ensure that Enderal and SkyUI plugins are enabled.
    const state = api.store.getState();

    // Wrong game.
    if (selectors.activeGameId(state) !== GAME_ID) return Promise.resolve(undefined);

    const pluginInfo = util.getSafe(state, ['session', 'plugins', 'pluginInfo'], {});

    if (!pluginInfo) return Promise.resolve(undefined);

    const enderalMaster = util.getSafe(pluginInfo, [ENDERAL_ESM.toLowerCase()], undefined);
    const skyUIPlugin = util.getSafe(pluginInfo, [SKYUI_ESP.toLowerCase()], undefined);

    if (enderalMaster && !enderalMaster.enabled) {
        log('info', 'Force-enabling required plugin', ENDERAL_ESM);
        api.store.dispatch({ type: 'SET_PLUGIN_ENABLED', payload: {
            pluginName: ENDERAL_ESM.toLowerCase(), 
            enabled: true}
        });
    }

    if (skyUIPlugin && !skyUIPlugin.enabled) {
        log('info', 'Force-enabling required plugin', SKYUI_ESP);
        api.store.dispatch({ type: 'SET_PLUGIN_ENABLED', payload: {
            pluginName: SKYUI_ESP.toLowerCase(), 
            enabled: true}
        });
    }

    return Promise.resolve(undefined);

}

async function testMissingMods(api) {
    // Clear a previous version of this notification. 
    api.dismissNotification('enderal-missing-mods');

    const state = api.store.getState();
    // Wrong game!
    if (selectors.activeGameId(state) !== GAME_ID) return Promise.resolve(undefined);

    const gamePath = util.getSafe(state, ['settings', 'gameMode', 'discovered', GAME_ID, 'path'], undefined);
    if (!gamePath) return Promise.resolve(undefined);

    const missingDependencies = [];

    const fileKeys = Object.keys(fileChecks);

    for (const key of fileKeys) {
        const check = fileChecks[key];
        const checkPath = path.join(gamePath, check.relPath);
        try {
            const stats = await fs.statAsync(checkPath);
        }
        catch (err) {
            if (err.code === 'ENOENT' && check.type !== 'PLACEHOLDER') {
                log('warn', 'Missing required file for Enderal SE', checkPath);
                missingDependencies.push(check);
            }
            else log('warn', 'Unexpected error processing Enderal SE dependencies', err, checkPath);
        }
    };

    if (missingDependencies.length) {
        api.sendNotification({
            id: 'enderal-missing-mods',
            type: 'warning',
            title: 'Dependencies Missing',
            message: 'Enderal SE is not installed correctly.',
            actions: [
                {
                    title: 'More',
                    action: (dismiss) => missingModsModal(api, missingDependencies, dismiss)
                }
            ]
        })
    }
    
    return Promise.resolve(); 
}

function getGameVersion(gamePath, exePath) {
    // Enderal's "true" version is different, but it's not posted anywhere useful that can be retrieved programatically.
    // We could try to regex the 'Enderal SE v2.0.11 Changelog.txt' file name, but there's no guarantee they won't arbitrarily remove/rename that file. 
    // Really, we only care about the Skyrim SE version for now as it makes a difference for xSE mods. 
    const fullPath = path.join(gamePath, exePath);
    let exeVersion = getFileVersion(fullPath);
    // Skyrim SE 1.5.97 doesn't show its version properly.
    if (exeVersion === '1.0.0.0' && !!getFileVersionLocalized) {
        exeVersion = getFileVersionLocalized(fullPath)
    }

    return Promise.resolve(exeVersion);
}

function main(context) {
    // We need Vortex 1.4.3+
    context.requireVersion('^1.4.3');

    // Require the plugin management extension. 
    context.requireExtension('gamebryo-plugin-management');

    context.registerGame({
        id: GAME_ID,
        name: 'Enderal Special Edition',
        supportedTools: tools,
        shortName: 'Enderal SE',
        mergeMods: true,
        queryPath: findGame,
        queryModPath: () => 'data',
        logo: 'gameart.jpg',
        executable: () => 'SkyrimSE.exe',
        getGameVersion,
        requiredFiles: [
            "SkyrimSE.exe"
        ],
        compatible: {
            symlinks: false
        },
        details: {
            steamAppId: STEAMAPP_ID,
            compatibleDownloads: [
                'skyrimse', 
                'skyrimspecialedition'
            ]
        },
    });

    // Register checks on required plugins when plugins are changed.
    context.registerTest('enderal-se-plugins', 'plugins-changed', () => testMandatoryPlugins(context.api));
    context.registerTest('enderal-se-plugins', 'loot-info-updated', () => testMandatoryPlugins(context.api));

    // Register check on missing mods both when we start managing the game.
    context.registerTest('enderal-se-dependences', 'gamemode-activated', () => testMissingMods(context.api));

    context.once(() => {
        // Check missing mods after deploying.
        context.api.onAsync('did-deploy', () => testMissingMods(context.api));
    });

    return true;

}

module.exports = {
    default: main
};