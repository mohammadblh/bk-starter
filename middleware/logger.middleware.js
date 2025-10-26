const blhLog = (key, value = '') => {
  console.log(
    `┌────── ${key} ────────────────────────────────────────────────────────\n`
  );
  console.log(value);
  console.log('|\n');
  console.log(
    '└───────────────────────────────────────────────────────────────────────\n'
  );
};

module.exports = blhLog;
