export function prettyHex(number: number, prefix = '0x') {
  return prefix + number.toString(16).padStart(5, '0');
}

export function dumpList(list: number[], wrap: number = 32) {
  return list
    .map((h) => h.toString(16).padStart(2, '0'))
    .map((str, i) => i % wrap === 0 ? `\n${str}` : str)
    .join(' ')
}
