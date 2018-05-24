interface Opcode {
  x: number;
  y: number;
  v: number;
  N: number;
  NN: number;
  NNN: number;
}

export function fromMemory(memory: number[], PC: number): Opcode {
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
