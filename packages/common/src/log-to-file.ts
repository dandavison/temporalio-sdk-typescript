import * as fs from 'fs';
import * as colors from 'ansi-colors';

function colorFn(color: string): (s: string) => string {
  switch (color) {
    case 'red':
      return colors.red;
    case 'green':
      return colors.green;
    case 'blue':
      return colors.blue;
    default:
      return (s: string) => s;
  }
}

export function logToFile(msg: string, prefix: string, color: string) {
  const time: string = new Date().toISOString().slice(11, 23);
  const path = '/tmp/log';

  try {
    const fd = fs.openSync(path, 'a');
    fs.writeSync(fd, colorFn(color)(`${time} ${prefix}: ${msg}\n`));
    fs.fsyncSync(fd);
    fs.closeSync(fd);
  } catch (err) {
    console.error(`logToFile: an error was caught :${err}\n`);
    console.error(`To logToFile from sandboxed code:\nimport { logToFile } from './workflow';`);
  }
}
