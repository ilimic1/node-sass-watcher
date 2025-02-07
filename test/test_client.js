const assert = require('assert');
const path = require('path');
const fs = require('fs');
const exec = require('child_process').exec;
const Client = require('../lib/client');
const version = require('../package').version;
const clientPath = path.join('bin', 'node-sass-watcher');

function testCommand(command, message, check) {
  it(message + ' (command: ' + command + ')', function (done) {
    exec(command, function (err, stdout, stderr) {
      check(err, stdout, stderr);
      done();
    });
  });
}

function testCommandAsync(command, message, check) {
  it(message + ' (command: ' + command + ')', function (done) {
    const subprocess = exec(command);
    check(subprocess, done);
  });
}

function checkOutputFilePath(filePath) {
  checkOutputFilePath.cache = checkOutputFilePath.cache || {};

  if (filePath in checkOutputFilePath.cache) {
    throw new Error(
      'Use other output file path, this one is used: ' + filePath,
    );
  }

  checkOutputFilePath.cache[filePath] = true;

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  return filePath;
}

function checkHelpMessage(output) {
  assert.equal(
    output.split('\n')[0],
    'Usage: node-sass-watcher <input> [options]',
  );
  assert.ok(output.indexOf('Error:') == -1);
}

describe('CLI', function () {
  // expect tests to be slow, due to nature of the CLI (invoking sub-processes)
  this.slow(500);
  this.timeout(5000);

  before(function () {
    if (!fs.existsSync('test/build/')) {
      fs.mkdirSync('test/build/');
    }
  });

  describe('Arguments validation', function () {
    testCommand(
      'node ' + clientPath,
      'shows help message if there are no arguments',
      function (err, stdout, stderr) {
        checkHelpMessage(stderr);
      },
    );

    testCommand(
      'node ' + clientPath + ' --help',
      "shows help message if there is '--help' argument",
      function (err, stdout) {
        checkHelpMessage(stdout);
      },
    );

    testCommand(
      'node ' + clientPath + ' -v -h',
      "shows help message if there is '-h' argument, even if arguments are invalid",
      function (err, stdout) {
        checkHelpMessage(stdout);
      },
    );

    testCommand(
      'node ' + clientPath + ' --version',
      "shows version if there is '--version' argument",
      function (err, stdout) {
        assert.equal(stdout, version + '\n');
      },
    );

    testCommand(
      'node ' + clientPath + ' -v -V',
      "shows version if there is '-V' argument, even if arguments are invalid",
      function (err, stdout) {
        assert.equal(stdout, version + '\n');
      },
    );

    testCommand(
      'node ' + clientPath + ' -v',
      'expects at least one input path',
      function (err, stdout, stderr) {
        assert.equal(stderr, Client.messages.NO_INPUT_PATH + '\n');
      },
    );

    testCommand(
      'node ' + clientPath + ' input-1.scss input-2.scss',
      'expects no more than one input path',
      function (err, stdout, stderr) {
        const lines = stderr.split('\n').filter((line) => line.length > 0);
        assert.equal(lines[lines.length - 1], 'Unknown argument: input-2.scss');
      },
    );

    testCommand(
      'node ' + clientPath + ' input.scss -o output-1.css -o output-2.css',
      'expects no more than one output path',
      function (err, stdout, stderr) {
        assert.equal(stderr, Client.messages.EXTRA_OUTPUT_PATH + '\n');
      },
    );

    testCommand(
      'node ' + clientPath + ' input.scss -r one/ -r two/',
      'expects no more than one root dir',
      function (err, stdout, stderr) {
        assert.equal(stderr, Client.messages.EXTRA_ROOT_DIR + '\n');
      },
    );

    testCommand(
      'node ' + clientPath + ' input.scss -c "grep A" -c "grep B"',
      'expects no more than one command',
      function (err, stdout, stderr) {
        assert.equal(stderr, Client.messages.EXTRA_COMMAND + '\n');
      },
    );
  });

  describe('Simple run', function () {
    // No command, output to stout
    (function () {
      const inputPath = 'test/resources/simple.scss';

      testCommandAsync(
        'node ' + clientPath + ' ' + inputPath,
        'outputs input file contents to stdout',
        function (subprocess, done) {
          // file content should appear in the stdout
          subprocess.stdout.on('data', function (data) {
            assert.equal(
              data.toString(),
              fs.readFileSync(inputPath).toString(),
            );
            subprocess.kill();
            done();
          });
        },
      );
    })();

    // No command, output to file
    (function () {
      const inputPath = 'test/resources/simple.scss';
      const outputPath = checkOutputFilePath(
        'test/build/simple-wo-command.css',
      );

      testCommandAsync(
        'node ' + clientPath + ' ' + inputPath + ' -o ' + outputPath,
        'outputs input file contents to output file',
        function (subprocess, done) {
          const interval = setInterval(function () {
            if (fs.existsSync(outputPath) && fs.statSync(outputPath)['size']) {
              assert.equal(
                fs.readFileSync(inputPath).toString(),
                fs.readFileSync(outputPath).toString(),
              );
              clearInterval(interval);
              done();
            }
          }, 20);
        },
      );
    })();

    // With command, output to stout
    (function () {
      const inputPath = 'test/resources/simple.scss';

      testCommandAsync(
        'node ' + clientPath + ' ' + inputPath + ' -c "sed s/red/orange/"',
        'outputs command results to stdout',
        function (subprocess, done) {
          // file content should appear in the stdout
          subprocess.stdout.on('data', function (data) {
            assert.equal(
              data.toString().replace(/\r\n/g, '\n'),
              fs
                .readFileSync(inputPath)
                .toString()
                .replace('red', 'orange')
                .replace(/\r\n/g, '\n'),
            );
            subprocess.kill();
            done();
          });
        },
      );
    })();

    // With command, output to file
    (function () {
      const inputPath = 'test/resources/simple.scss';
      const outputPath = checkOutputFilePath('test/build/simple-w-command.css');

      testCommandAsync(
        'node ' +
          clientPath +
          ' ' +
          inputPath +
          ' -c "sed s/red/orange/" -o ' +
          outputPath,
        'outputs command results to output file',
        function (subprocess, done) {
          const interval = setInterval(function () {
            if (fs.existsSync(outputPath) && fs.statSync(outputPath)['size']) {
              assert.equal(
                fs
                  .readFileSync(inputPath)
                  .toString()
                  .replace('red', 'orange')
                  .replace(/\r\n/g, '\n'),
                fs.readFileSync(outputPath).toString().replace(/\r\n/g, '\n'),
              );
              clearInterval(interval);
              done();
            }
          }, 20);
        },
      );
    })();
  });

  describe('Complex run', function () {
    // Pipe
    (function () {
      const inputPath = 'test/resources/simple.scss';

      testCommandAsync(
        'node ' +
          clientPath +
          ' ' +
          inputPath +
          ' -c "sed s/red/orange/ | sed s/orange/green/"',
        'outputs command results to stdout, using | in the command',
        function (subprocess, done) {
          // file content should appear in the stdout
          subprocess.stdout.on('data', function (data) {
            assert.equal(
              data.toString().replace(/\r\n/g, '\n'),
              fs
                .readFileSync(inputPath)
                .toString()
                .replace('red', 'green')
                .replace(/\r\n/g, '\n'),
            );
            subprocess.kill();
            done();
          });
        },
      );
    })();

    // Output redirect
    (function () {
      const inputPath = 'test/resources/simple.scss';
      const outputPath = checkOutputFilePath('test/build/simple-redirect.css');

      testCommandAsync(
        'node ' +
          clientPath +
          ' ' +
          inputPath +
          ' -c "sed s/red/orange/ | sed s/orange/green/ > ' +
          outputPath +
          '"',
        'outputs command results to a file, using > in the command',
        function (subprocess, done) {
          const interval = setInterval(function () {
            if (fs.existsSync(outputPath) && fs.statSync(outputPath)['size']) {
              assert.equal(
                fs
                  .readFileSync(inputPath)
                  .toString()
                  .replace('red', 'green')
                  .replace(/\r\n/g, '\n'),
                fs.readFileSync(outputPath).toString().replace(/\r\n/g, '\n'),
              );
              clearInterval(interval);
              done();
            }
          }, 20);
        },
      );
    })();
  });
});
