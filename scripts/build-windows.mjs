import {execFileSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import {join} from 'node:path';

if (process.platform !== 'win32') throw Error('Build the Windows bridge on Windows.');
const framework = join(process.env.WINDIR, 'Microsoft.NET', 'Framework64', 'v4.0.30319');
const reference = join(process.env['ProgramFiles(x86)'], 'Reference Assemblies', 'Microsoft', 'Framework', '.NETFramework', 'v4.8');
mkdirSync('windows/build', {recursive: true});
execFileSync(join(framework, 'csc.exe'), [
  '/nologo', '/target:exe', '/out:' + join('windows', 'build', 'AsterBridge.exe'),
  '/reference:' + join(reference, 'System.Speech.dll'),
  '/reference:' + join(reference, 'System.Web.Extensions.dll'),
  join('windows', 'Bridge.cs'),
], {stdio: 'inherit'});
