import Display from "./Display";
import Audio from "./Audio";
import font from "./Font";
import {fromMemory} from "./Opcode";
import timeout from "./utils/timeout";
import {dumpList, prettyHex} from "./utils/debug";

export default class Chip8 {
  private display: Display;
  private audio = new Audio();
  private running = false;
  private timersRunning = false;
  private didDraw = false;
  private didDumpMemory = false;

  private tickrate = 0;
  private timerTickrate = 1000 / 60;
  private resolveWaitingForKey: any;

  // Registers
  private V: number[] = new Array(16).fill(0);
  private I: number = 0;

  private DELAY: number = 0;
  private SOUND: number = 0;

  private PC: number = 0x200;
  private SP: number = 0;

  private memory: number[] = new Array(4096).fill(0);
  private STACK: number[] = new Array(16).fill(0);
  private GFX: number[] = new Array(64 * 32).fill(0);
  private KEYS: number[] = new Array(16).fill(0);

  constructor(canvas: HTMLCanvasElement) {
    this.display = new Display(canvas);
  }

  start() {
    this.run();
    this.runTimers();
  }

  stop() {
    this.running = false;
    this.timersRunning = false;
  }

  destroy(){
    this.stop();
  }

  load(program: number[]) {
    // fill memory 0x000 to 0x1FF with font data
    font.forEach((f, idx) =>
      this.memory[idx] = f);

    // insert program after 512
    program.forEach((v, idx) =>
      this.memory[idx + 512] = v);
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

      await timeout(this.timerTickrate);
    }
  }

  async run() {
    this.running = true;

    while (this.running) {
      for (let i = 0; i < 10; i++) {
        await this.step();
      }
      await timeout(this.tickrate);
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
    const op = fromMemory(this.memory, this.PC);
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

  unknown(opcode: number) {
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

  waitForKey(): Promise<number> {
    return new Promise(resolve => {
      this.resolveWaitingForKey = resolve;
    });
  }

  keyDown(keyIdx: number) {
    console.log('down', keyIdx);
    this.KEYS[keyIdx] = 1;
    if (this.resolveWaitingForKey) {
      this.resolveWaitingForKey(keyIdx);
      this.resolveWaitingForKey = undefined;
    }
  }

  keyUp(keyIdx: number) {
    console.log('up', keyIdx);
    this.KEYS[keyIdx] = 0;
  }

  dump() {
    if (!this.didDumpMemory) {
      (document.querySelector('#memory') as HTMLDivElement).innerText = dumpList(this.memory, 28);
      this.didDumpMemory = true;
    }

    (document.querySelector('#data') as HTMLDivElement).innerText = `PC: ${prettyHex(this.PC)}
SP: ${prettyHex(this.SP)}

I: ${prettyHex(this.I)}
DELAY: ${(this.DELAY + '').padStart(3, '0')} SOUND: ${(this.SOUND + '').padStart(3, '0')}

KEYS: ${dumpList(this.KEYS, 4)}

V: ${dumpList(this.V, 8)}

STACK: ${dumpList(this.STACK, 8)}
`;
  }
}
