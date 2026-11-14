import {packager} from '@electron/packager';

if (process.platform !== 'win32' || process.arch !== 'x64') {
  throw Error('Build the Windows preview on 64-bit Windows.');
}
const result = await packager({
  dir: '.',
  out: 'release',
  name: 'Aster',
  platform: 'win32',
  arch: 'x64',
  overwrite: true,
  appVersion: '0.5.0',
  prune: true,
  asar: {unpack: '**/node_modules/**/*'},
  extraResource: ['windows/build/AsterBridge.exe', 'native/voice-model'],
  ignore: [
    /^\/\.git/, /^\/docs/, /^\/release/, /^\/native/, /^\/windows/,
    /^\/tests/, /^\/scripts/, /^\/public/,
    /^\/src\/(?!(commands|control-commands|web-commands|desktop-commands)\.mjs)/,
  ],
});
console.log(result.join('\n'));
