import Chip8 from "./src/Chip8";

const displayCanvas = document.querySelector('canvas');
const roms = document.querySelector('#roms') as HTMLSelectElement;

let chip8 = new Chip8(displayCanvas);

const KEY_MAPPING: { [key: string]: number } = {
  '1': 0x0, '2': 0x1, '3': 0x2, '4': 0x3,
  'q': 0x4, 'w': 0x5, 'e': 0x6, 'r': 0x7,
  'a': 0x8, 's': 0x9, 'd': 0xA, 'f': 0xB,
  'z': 0xC, 'x': 0xD, 'c': 0xE, 'v': 0xF
};

function prepareRomBuffer(buf: ArrayBuffer) {
  let view = new Uint8Array(buf);
  const bufArray = Array.from(view);

  return bufArray
    .map((val, i, all) => {
      if (i % 2 === 0) {
        return [val, all[i + 1]];
      }
    })
    .filter(Boolean)
    .reduce((all, pair) => all.concat(pair), [])
    .filter(f => typeof f === 'number');
}

document.body.onkeydown = (ev: KeyboardEvent) => {
  if (KEY_MAPPING.hasOwnProperty(ev.key)) {
    chip8.keyDown(KEY_MAPPING[ev.key]);
  }
};
document.body.onkeyup = (ev: KeyboardEvent) => {
  if (KEY_MAPPING.hasOwnProperty(ev.key)) {
    chip8.keyUp(KEY_MAPPING[ev.key]);
  }
};
Array.from(document.querySelectorAll('button[data-c]'))
  .forEach((button: HTMLButtonElement) => {
    const key = parseInt(button.dataset['c'], 16);
    console.log('bound', key);
    button.onmousedown = () => chip8.keyDown(key);
    button.onmouseup = () => chip8.keyUp(key);
  });

roms.onchange = () => {
  chip8.destroy();
  chip8 = new Chip8(displayCanvas);
  playSelectedRom();
};

async function playSelectedRom() {
  const rom = roms.value;
  const response = await fetch(`roms/${rom}`);

  chip8.load(prepareRomBuffer(await response.arrayBuffer()));
  chip8.start();
}

playSelectedRom()
  .catch(e => {
    alert('Caught an error, check console');
    console.error(e);
  });
