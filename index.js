const { fs, log, util } = require('vortex-api');
const path = require('path');

const GAME_ID = 'enderalspecialedition';
const STEAMAPP_ID = '976620';

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
        logo: 'launcher-icon.jpg',
        relative: true,
        exclusive: true
    }
];

function findGame() {
    return util.GameStoreHelper.findByAppId([STEAMAPP_ID])
        .then(game => game.gamePath);
}

async function prepareForModding(discovery, api) {

    const enderalPath = discovery.path;

    const missingDependencies = [];

    const fileKeys = Object.keys(fileChecks);

    for (const key of fileKeys) {
        const check = fileChecks[key];
        const checkPath = path.join(enderalPath, check.relPath);
        try {
            await fs.statAsync(checkPath);
        }
        catch (err) {
            log('warn', 'Missing required file for Enderal SE', checkPath)
            missingDependencies.push(check);
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

function missingModsModal(api, missingDependencies, dismiss) {
    api.showDialog('warn', 'Enderal Dependencies Missing', {
        bbcode: 'Enderal Special Edition requires several mods to be installed before it will work correctly. Vortex detected the following mods as missing: <br /><br />'+
        missingDependencies.map(mod => `- [url=${mod.url}]${mod.name}[/url]<br />`).join('<br/>')+
        '<br /><br />You will not be able to start playing Enderal until these mods have been installed.'
    },[
        {
            label: 'Close',
            action: () => dismiss(),
        }
    ])
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
        requiredFiles: [
            "SkyrimSE.exe"
        ],
        compatible: {
            symlinks: false
        },
        details: {
            steamAppId: STEAMAPP_ID
        }
    });

    return true;

}

module.exports = {
    default: main
};