const { getContext } = require('./context');

// Вихід можна підмінити (тести перехоплюють рядки й перевіряють наявність processId).
let sink = (level, line) => (level === 'ERROR' ? console.error(line) : console.log(line));

function setSink(fn) {
  sink = fn;
}

function write(level, message, meta) {
  const { processId = '-', userId } = getContext();
  const user = userId ? ` user=${userId}` : '';
  const extra = meta === undefined ? '' : ` ${JSON.stringify(meta)}`;
  sink(level, `[${processId}]${user} ${level} ${message}${extra}`);
}

module.exports = {
  setSink,
  info: (message, meta) => write('INFO', message, meta),
  warn: (message, meta) => write('WARN', message, meta),
  error: (message, meta) => write('ERROR', message, meta),
};
