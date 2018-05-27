define("src/Audio", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class Audio {
        constructor() {
            this.running = false;
            // create web audio api context
            this.ctx = new AudioContext();
        }
        start() {
            if (!this.running) {
                // create Oscillator node
                this.oscillator = this.ctx.createOscillator();
                this.oscillator.type = 'sine';
                this.oscillator.frequency.setValueAtTime(220, this.ctx.currentTime); // value in hertz
                this.oscillator.connect(this.ctx.destination);
                this.oscillator.start();
                this.running = true;
            }
        }
        stop() {
            if (this.running) {
                this.oscillator.stop();
                this.running = false;
            }
        }
    }
    exports.default = Audio;
});
/* global fx */
define("src/Display", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class Display {
        constructor(canvas) {
            this.canvas = canvas;
            this.scale = 8;
            this.ctx = canvas.getContext('2d');
            if (!canvas.classList.contains('display--scaled')) {
                canvas.width *= this.scale;
                canvas.height *= this.scale;
                canvas.classList.add('display--scaled');
            }
        }
        dot(x, y, on = false) {
            this.ctx.fillStyle = on ? '#fff' : '#000';
            const scaledX = x * this.scale;
            const scaledY = y * this.scale;
            const [r, g, b] = this.ctx.getImageData(scaledX, scaledY, 1, 1).data;
            const isWhite = r === 255 && g === 255 && b === 255;
            const isBlack = !isWhite;
            // 0..255
            if (isWhite && !on) {
                this.ctx.fillRect(scaledX, scaledY, this.scale, this.scale);
            }
            else if (isBlack && on) {
                this.ctx.fillRect(scaledX, scaledY, this.scale, this.scale);
            }
        }
    }
    exports.default = Display;
});
define("src/Font", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const font = [
        0xF0, 0x90, 0x90, 0x90, 0xF0,
        0x20, 0x60, 0x20, 0x20, 0x70,
        0xF0, 0x10, 0xF0, 0x80, 0xF0,
        0xF0, 0x10, 0xF0, 0x10, 0xF0,
        0x90, 0x90, 0xF0, 0x10, 0x10,
        0xF0, 0x80, 0xF0, 0x10, 0xF0,
        0xF0, 0x80, 0xF0, 0x90, 0xF0,
        0xF0, 0x10, 0x20, 0x40, 0x40,
        0xF0, 0x90, 0xF0, 0x90, 0xF0,
        0xF0, 0x90, 0xF0, 0x10, 0xF0,
        0xF0, 0x90, 0xF0, 0x90, 0x90,
        0xE0, 0x90, 0xE0, 0x90, 0xE0,
        0xF0, 0x80, 0x80, 0x80, 0xF0,
        0xE0, 0x90, 0x90, 0x90, 0xE0,
        0xF0, 0x80, 0xF0, 0x80, 0xF0,
        0xF0, 0x80, 0xF0, 0x80, 0x80 // F
    ];
    exports.default = font;
});
define("src/Opcode", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    function fromMemory(memory, PC) {
        const v = (memory[PC] << 8) | memory[PC + 1];
        return {
            v,
            x: (v & 0x0F00) >> 8,
            y: (v & 0x00F0) >> 4,
            N: (v & 0x000F),
            NN: (v & 0x00FF),
            NNN: (v & 0x0FFF),
        };
    }
    exports.fromMemory = fromMemory;
});
define("src/utils/timeout", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    function timeout(n) {
        return new Promise((resolve) => {
            setTimeout(resolve, n);
        });
    }
    exports.default = timeout;
});
define("src/utils/debug", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    function prettyHex(number, prefix = '0x') {
        return prefix + number.toString(16).padStart(5, '0');
    }
    exports.prettyHex = prettyHex;
    function dumpList(list, wrap = 32) {
        return list
            .map((h) => h.toString(16).padStart(2, '0'))
            .map((str, i) => i % wrap === 0 ? `\n${str}` : str)
            .join(' ');
    }
    exports.dumpList = dumpList;
});
define("src/Chip8", ["require", "exports", "src/Display", "src/Audio", "src/Font", "src/Opcode", "src/utils/timeout", "src/utils/debug"], function (require, exports, Display_1, Audio_1, Font_1, Opcode_1, timeout_1, debug_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    /*
    https://github.com/JamesGriffin/CHIP-8-Emulator/blob/master/src/chip8.cpp
    https://en.wikipedia.org/wiki/CHIP-8#Opcode_table
    via http://devernay.free.fr/hacks/chip8/C8TECH10.HTM
     */
    class Chip8 {
        constructor(canvas) {
            this.audio = new Audio_1.default();
            this.running = false;
            this.timersRunning = false;
            this.didDraw = false;
            this.didDumpMemory = false;
            this.tickrate = 0;
            this.timerTickrate = 1000 / 60;
            // Registers
            this.V = new Array(16).fill(0);
            this.I = 0;
            this.DELAY = 0;
            this.SOUND = 0;
            this.PC = 0x200;
            this.SP = 0;
            this.memory = new Array(4096).fill(0);
            this.STACK = new Array(16).fill(0);
            this.GFX = new Array(64 * 32).fill(0);
            this.KEYS = new Array(16).fill(0);
            this.display = new Display_1.default(canvas);
        }
        start() {
            this.run();
            this.runTimers();
        }
        stop() {
            this.running = false;
            this.timersRunning = false;
        }
        destroy() {
            this.stop();
        }
        load(program) {
            // fill memory 0x000 to 0x1FF with font data
            Font_1.default.forEach((f, idx) => this.memory[idx] = f);
            // insert program after 512
            program.forEach((v, idx) => this.memory[idx + 512] = v);
        }
        async runTimers() {
            this.timersRunning = true;
            while (this.timersRunning) {
                if (this.SOUND > 0) {
                    this.audio.start();
                    this.SOUND--;
                }
                if (this.DELAY > 0) {
                    this.DELAY--;
                }
                if (this.SOUND <= 0) {
                    this.audio.stop();
                }
                await timeout_1.default(this.timerTickrate);
            }
        }
        async run() {
            this.running = true;
            while (this.running) {
                for (let i = 0; i < 10; i++) {
                    await this.step();
                }
                await timeout_1.default(this.tickrate);
            }
        }
        async step() {
            this.dump();
            await this.cycle();
            if (this.didDraw) {
                this.draw();
            }
        }
        async cycle() {
            const op = Opcode_1.fromMemory(this.memory, this.PC);
            this.didDraw = false;
            this.PC += 2;
            switch (op.v & 0xF000) {
                case 0x0000:
                    switch (op.v) {
                        case 0x00E0:
                            this.GFX.fill(0);
                            this.didDraw = true;
                            break;
                        case 0x00EE:
                            this.SP--;
                            this.PC = this.STACK[this.SP];
                            break;
                        default:
                            this.unknown(op.v);
                    }
                    break;
                case 0x1000:
                    this.PC = (op.v & 0x0FFF);
                    break;
                case 0x2000:
                    this.STACK[this.SP] = this.PC;
                    this.SP++;
                    this.PC = op.v & 0x0FFF;
                    break;
                case 0x3000: {
                    if (this.V[op.x] === op.NN) {
                        this.PC += 2;
                    }
                    break;
                }
                case 0x4000: {
                    if (this.V[op.x] !== op.NN) {
                        this.PC += 2;
                    }
                    break;
                }
                case 0x5000: {
                    if (this.V[op.x] === this.V[op.y]) {
                        this.PC += 2;
                    }
                    break;
                }
                case 0x6000: {
                    this.V[op.x] = (op.v & 0x00FF);
                    break;
                }
                case 0x7000: {
                    this.V[op.x] += op.NN;
                    this.V[op.x] &= 0xFF;
                    break;
                }
                case 0x8000:
                    switch (op.v & 0x000F) {
                        case 0x0000: {
                            this.V[op.x] = this.V[op.y];
                            break;
                        }
                        case 0x0001: {
                            this.V[op.x] |= this.V[op.y];
                            break;
                        }
                        case 0x0002: {
                            this.V[op.x] &= this.V[op.y];
                            break;
                        }
                        case 0x0003: {
                            this.V[op.x] ^= this.V[op.y];
                            break;
                        }
                        case 0x0004:
                            this.V[op.x] += this.V[op.y];
                            this.V[0xF] = +(this.V[op.x] > 0xFF);
                            this.V[op.x] &= 0xFF;
                            break;
                        case 0x0005: {
                            this.V[0xF] = +(this.V[op.x] > this.V[op.y]);
                            this.V[op.x] -= this.V[op.y];
                            this.V[op.x] &= 0xFF;
                            break;
                        }
                        case 0x0006: {
                            this.V[0xF] = this.V[op.x] & 0x1;
                            this.V[op.x] >>= 1;
                            this.V[op.x] &= 0xFF;
                            break;
                        }
                        case 0x000E: {
                            this.V[0xF] = +(this.V[op.x] & 0x80);
                            this.V[op.x] <<= 1;
                            this.V[op.x] &= 0xFF;
                            break;
                        }
                        default:
                            this.unknown(op.v);
                    }
                    break;
                case 0x9000:
                    if (this.V[op.x] !== this.V[op.y]) {
                        this.PC += 2;
                    }
                    break;
                case 0xA000:
                    this.I = op.v & 0x0FFF;
                    break;
                case 0xB000:
                    this.PC = this.V[0] + op.NNN;
                    break;
                case 0xC000:
                    this.V[op.x] = Math.floor(Math.random() * 0xFF) & op.NN;
                    break;
                case 0xD000:
                    this.V[0xF] = 0;
                    const x = this.V[op.x];
                    const y = this.V[op.y];
                    const height = op.N;
                    let sprite;
                    for (let yline = 0; yline < height; yline++) {
                        sprite = this.memory[this.I + yline];
                        for (let xline = 0; xline < 8; xline++) {
                            if ((sprite & (0x80 >> xline)) !== 0) {
                                if (this.GFX[(x + xline + ((y + yline) * 64))] === 1) {
                                    this.V[0xf] = 1;
                                }
                                this.GFX[x + xline + ((y + yline) * 64)] ^= 1;
                            }
                        }
                    }
                    this.didDraw = true;
                    break;
                case 0xE000: {
                    switch (op.v & 0x00FF) {
                        case 0x009E: {
                            if (this.KEYS[this.V[op.x]]) {
                                this.PC += 2;
                            }
                            break;
                        }
                        case 0x00A1: {
                            if (!this.KEYS[this.V[op.x]]) {
                                this.PC += 2;
                            }
                            break;
                        }
                        default: {
                            this.unknown(op.v);
                        }
                    }
                    break;
                }
                case 0xF000: {
                    switch (op.v & 0x00FF) {
                        case 0x0007: {
                            this.V[op.x] = this.DELAY;
                            break;
                        }
                        case 0x000A: {
                            this.V[op.x] = await this.waitForKey();
                            break;
                        }
                        case 0x0015: {
                            this.DELAY = this.V[op.x];
                            break;
                        }
                        case 0x0018: {
                            this.SOUND = this.V[op.x];
                            break;
                        }
                        case 0x001E: {
                            this.I += this.V[op.x];
                            this.I &= 0xFFFF;
                            break;
                        }
                        case 0x0029: {
                            this.I = this.V[op.x] * 0x05;
                            this.I &= 0xFFFF;
                            break;
                        }
                        case 0x0033: {
                            this.memory[this.I] = Math.floor(this.V[op.x] / 100);
                            this.memory[this.I + 1] = (Math.floor(this.V[op.x] / 10)) % 10;
                            this.memory[this.I + 2] = this.V[op.x] % 10;
                            break;
                        }
                        case 0x0055: {
                            for (let i = 0; i <= op.x; i++) {
                                this.memory[this.I + i] = this.V[i];
                            }
                            break;
                        }
                        case 0x0065: {
                            for (let i = 0; i <= op.x; i++) {
                                this.V[i] = this.memory[this.I + i];
                            }
                            break;
                        }
                        default:
                            this.unknown(op.v);
                    }
                    break;
                }
                default: {
                    this.unknown(op.v);
                }
            }
        }
        unknown(opcode) {
            console.log('unknown opcode:', '0x' + opcode.toString(16));
            this.running = false;
        }
        draw() {
            this.GFX.forEach((on, i) => {
                const x = i % 64;
                const y = Math.floor(i / 64);
                this.display.dot(x, y, on > 0);
            });
        }
        waitForKey() {
            return new Promise(resolve => {
                this.resolveWaitingForKey = resolve;
            });
        }
        keyDown(keyIdx) {
            console.log('down', keyIdx);
            this.KEYS[keyIdx] = 1;
            if (this.resolveWaitingForKey) {
                this.resolveWaitingForKey(keyIdx);
                this.resolveWaitingForKey = undefined;
            }
        }
        keyUp(keyIdx) {
            console.log('up', keyIdx);
            this.KEYS[keyIdx] = 0;
        }
        dump() {
            if (!this.didDumpMemory) {
                document.querySelector('#memory').innerText = debug_1.dumpList(this.memory, 28);
                this.didDumpMemory = true;
            }
            document.querySelector('#data').innerText = `PC: ${debug_1.prettyHex(this.PC)}
SP: ${debug_1.prettyHex(this.SP)}

I: ${debug_1.prettyHex(this.I)}
DELAY: ${(this.DELAY + '').padStart(3, '0')} SOUND: ${(this.SOUND + '').padStart(3, '0')}

KEYS: ${debug_1.dumpList(this.KEYS, 4)}

V: ${debug_1.dumpList(this.V, 8)}

STACK: ${debug_1.dumpList(this.STACK, 8)}
`;
        }
    }
    exports.default = Chip8;
});
define("index", ["require", "exports", "src/Chip8"], function (require, exports, Chip8_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const displayCanvas = document.querySelector('canvas');
    const roms = document.querySelector('#roms');
    let chip8 = new Chip8_1.default(displayCanvas);
    const KEY_MAPPING = {
        '1': 0x0, '2': 0x1, '3': 0x2, '4': 0x3,
        'q': 0x4, 'w': 0x5, 'e': 0x6, 'r': 0x7,
        'a': 0x8, 's': 0x9, 'd': 0xA, 'f': 0xB,
        'z': 0xC, 'x': 0xD, 'c': 0xE, 'v': 0xF
    };
    function prepareRomBuffer(buf) {
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
    document.body.onkeydown = (ev) => {
        if (KEY_MAPPING.hasOwnProperty(ev.key)) {
            chip8.keyDown(KEY_MAPPING[ev.key]);
        }
    };
    document.body.onkeyup = (ev) => {
        if (KEY_MAPPING.hasOwnProperty(ev.key)) {
            chip8.keyUp(KEY_MAPPING[ev.key]);
        }
    };
    Array.from(document.querySelectorAll('button[data-c]'))
        .forEach((button) => {
        const key = parseInt(button.dataset['c'], 16);
        console.log('bound', key);
        button.onmousedown = () => chip8.keyDown(key);
        button.onmouseup = () => chip8.keyUp(key);
    });
    roms.onchange = () => {
        chip8.destroy();
        chip8 = new Chip8_1.default(displayCanvas);
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
});
//# sourceMappingURL=crap-8.js.map