export default class Audio {
  ctx: AudioContext;
  oscillator: OscillatorNode;
  running = false;

  constructor() {
    // create web audio api context
    this.ctx = new AudioContext();
  }

  start(){
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

  stop(){
    if (this.running) {
      this.oscillator.stop();
      this.running = false;
    }
  }
}
